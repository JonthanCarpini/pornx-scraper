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

export default router;
