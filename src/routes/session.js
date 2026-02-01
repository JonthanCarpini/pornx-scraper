import express from 'express';
import crypto from 'crypto';
import pool from '../database/db.js';
import { validateSession } from '../middleware/sessionMiddleware.js';

const router = express.Router();

// Criar nova sessão (chamado no login)
router.post('/create', async (req, res) => {
  try {
    const { userId, deviceInfo, ipAddress } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    // Gerar token único para a sessão
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Expiração: 30 dias
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Invalidar todas as sessões ativas anteriores deste usuário
    await pool.query(
      `UPDATE user_sessions 
       SET is_active = FALSE 
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    // Criar nova sessão
    const result = await pool.query(
      `INSERT INTO user_sessions 
       (user_id, session_token, device_info, ip_address, expires_at, last_heartbeat)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, session_token, expires_at`,
      [userId, sessionToken, deviceInfo, ipAddress, expiresAt]
    );

    res.json({
      success: true,
      session: result.rows[0],
      message: 'Sessão criada com sucesso. Sessões anteriores foram invalidadas.'
    });
  } catch (error) {
    console.error('Erro ao criar sessão:', error);
    res.status(500).json({ error: 'Erro ao criar sessão' });
  }
});

// Heartbeat - manter sessão ativa
router.post('/heartbeat', validateSession, async (req, res) => {
  try {
    const { sessionId } = req;

    // Atualizar last_heartbeat
    await pool.query(
      `UPDATE user_sessions 
       SET last_heartbeat = NOW() 
       WHERE id = $1`,
      [sessionId]
    );

    res.json({ 
      success: true,
      message: 'Heartbeat registrado'
    });
  } catch (error) {
    console.error('Erro ao registrar heartbeat:', error);
    res.status(500).json({ error: 'Erro ao registrar heartbeat' });
  }
});

// Verificar status da sessão
router.get('/status', validateSession, async (req, res) => {
  try {
    const { sessionId, userId } = req;

    const result = await pool.query(
      `SELECT 
        id,
        user_id,
        device_info,
        last_heartbeat,
        created_at,
        expires_at,
        is_active
       FROM user_sessions
       WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    res.json({
      success: true,
      session: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao verificar status da sessão:', error);
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

// Logout - invalidar sessão
router.post('/logout', validateSession, async (req, res) => {
  try {
    const { sessionId } = req;

    await pool.query(
      `UPDATE user_sessions 
       SET is_active = FALSE 
       WHERE id = $1`,
      [sessionId]
    );

    res.json({ 
      success: true,
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    res.status(500).json({ error: 'Erro ao fazer logout' });
  }
});

// Limpar sessões expiradas (pode ser chamado por um cron job)
router.post('/cleanup', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE user_sessions
       SET is_active = FALSE
       WHERE is_active = TRUE
       AND (
         expires_at < NOW()
         OR last_heartbeat < NOW() - INTERVAL '5 minutes'
       )
       RETURNING id`
    );

    res.json({
      success: true,
      cleaned: result.rowCount,
      message: `${result.rowCount} sessões expiradas foram limpas`
    });
  } catch (error) {
    console.error('Erro ao limpar sessões:', error);
    res.status(500).json({ error: 'Erro ao limpar sessões' });
  }
});

// Listar usuários online
router.get('/online-users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        us.user_id,
        us.device_info,
        us.last_heartbeat,
        us.created_at as session_started
       FROM user_sessions us
       WHERE us.is_active = TRUE
       AND us.last_heartbeat > NOW() - INTERVAL '5 minutes'
       ORDER BY us.last_heartbeat DESC`
    );

    res.json({
      success: true,
      online_users: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Erro ao listar usuários online:', error);
    res.status(500).json({ error: 'Erro ao listar usuários online' });
  }
});

// Listar todas as sessões ativas com detalhes completos
router.get('/active-sessions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        us.id as session_id,
        us.user_id,
        u.username,
        u.full_name,
        us.device_info,
        us.device_name,
        us.device_model,
        us.os_version,
        us.device_token,
        us.ip_address,
        us.last_heartbeat,
        us.created_at as session_started,
        us.expires_at,
        CASE 
          WHEN us.last_heartbeat > NOW() - INTERVAL '5 minutes' THEN true
          ELSE false
        END as is_online
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.is_active = TRUE
       ORDER BY us.last_heartbeat DESC`
    );

    res.json({
      success: true,
      sessions: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Erro ao listar sessões ativas:', error);
    res.status(500).json({ error: 'Erro ao listar sessões ativas' });
  }
});

// Encerrar sessão de um usuário específico (admin) - FORÇA LOGOUT NO DISPOSITIVO
router.post('/terminate/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Deletar a sessão completamente (não apenas marcar como inativa)
    // Isso força o usuário a fazer login novamente no dispositivo
    const result = await pool.query(
      `DELETE FROM user_sessions 
       WHERE id = $1
       RETURNING user_id, device_info, device_name`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    res.json({ 
      success: true,
      message: 'Sessão encerrada e usuário deslogado do dispositivo',
      session: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao encerrar sessão:', error);
    res.status(500).json({ error: 'Erro ao encerrar sessão' });
  }
});

export default router;
