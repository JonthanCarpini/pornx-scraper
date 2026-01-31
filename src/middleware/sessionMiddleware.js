import pool from '../database/db.js';

// Middleware para verificar se a sessão do usuário é válida
export const validateSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    // Verificar se a sessão existe e está ativa
    const sessionQuery = `
      SELECT 
        us.id,
        us.user_id,
        us.is_active,
        us.last_heartbeat,
        us.expires_at
      FROM user_sessions us
      WHERE us.session_token = $1
      AND us.is_active = TRUE
    `;

    const result = await pool.query(sessionQuery, [token]);

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Sessão inválida ou expirada',
        code: 'SESSION_INVALID'
      });
    }

    const session = result.rows[0];

    // Verificar se a sessão expirou
    if (new Date(session.expires_at) < new Date()) {
      await pool.query(
        'UPDATE user_sessions SET is_active = FALSE WHERE id = $1',
        [session.id]
      );
      return res.status(401).json({ 
        error: 'Sessão expirada',
        code: 'SESSION_EXPIRED'
      });
    }

    // Verificar se o último heartbeat foi há mais de 5 minutos
    const lastHeartbeat = new Date(session.last_heartbeat);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (lastHeartbeat < fiveMinutesAgo) {
      await pool.query(
        'UPDATE user_sessions SET is_active = FALSE WHERE id = $1',
        [session.id]
      );
      return res.status(401).json({ 
        error: 'Sessão inativa',
        code: 'SESSION_INACTIVE'
      });
    }

    // Adicionar informações da sessão ao request
    req.userId = session.user_id;
    req.sessionId = session.id;
    
    next();
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    res.status(500).json({ error: 'Erro ao validar sessão' });
  }
};
