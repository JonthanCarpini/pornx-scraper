import jwt from 'jsonwebtoken';
import pool from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function authenticateToken(req, res, next) {
    const token = req.cookies?.adminToken || req.cookies?.userToken || req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }
    
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
}

export async function requireActiveSubscription(req, res, next) {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        if (req.user.role === 'admin') {
            return next();
        }

        const result = await pool.query(`
            SELECT u.is_active, s.is_active as subscription_active, s.end_date
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id AND s.is_active = true
            WHERE u.id = $1
        `, [req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Conta bloqueada. Entre em contato com o administrador.' });
        }

        if (!user.subscription_active || new Date(user.end_date) < new Date()) {
            return res.status(403).json({ 
                error: 'Assinatura inativa ou expirada. Renove sua assinatura para continuar.',
                subscription_expired: true
            });
        }

        next();
    } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        res.status(500).json({ error: 'Erro ao verificar assinatura.' });
    }
}

export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
}

export function generateToken(userId, username, role = 'user') {
    return jwt.sign(
        { userId, username, role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}
