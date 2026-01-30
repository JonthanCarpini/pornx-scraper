import express from 'express';
import bcrypt from 'bcrypt';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import pool from '../database/db.js';

const router = express.Router();

// Todos os endpoints requerem autenticação de admin
router.use(authenticateToken);
router.use(requireAdmin);

// ===== LISTAR USUÁRIOS =====
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role;
        const is_active = req.query.is_active;

        let whereClause = '';
        const whereParams = [];

        if (search) {
            whereClause = 'WHERE (u.username ILIKE $1 OR u.email ILIKE $1)';
            whereParams.push(`%${search}%`);
        }

        if (role) {
            whereClause += (whereClause ? ' AND ' : 'WHERE ') + `u.role = $${whereParams.length + 1}`;
            whereParams.push(role);
        }

        if (is_active !== undefined) {
            whereClause += (whereClause ? ' AND ' : 'WHERE ') + `u.is_active = $${whereParams.length + 1}`;
            whereParams.push(is_active === 'true');
        }

        const selectParams = [...whereParams, limit, offset];

        const result = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.email,
                u.full_name,
                u.avatar_url,
                u.is_active,
                u.role,
                u.created_at,
                u.last_login,
                s.id as subscription_id,
                s.plan_months,
                s.start_date,
                s.end_date,
                s.is_trial,
                s.is_active as subscription_active,
                CASE 
                    WHEN s.is_active AND s.end_date >= CURRENT_TIMESTAMP THEN true
                    ELSE false
                END as subscription_valid
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id AND s.is_active = true
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}
        `, selectParams);

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM users u ${whereClause}
        `, whereParams);

        const total = parseInt(countResult.rows[0].count);

        res.json({
            users: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== CRIAR USUÁRIO =====
router.post('/users', async (req, res) => {
    try {
        const { username, email, password, full_name, role } = req.body;

        // Validações
        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email e senha são obrigatórios' 
            });
        }

        if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
            return res.status(400).json({ 
                error: 'Username inválido' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Senha deve ter no mínimo 6 caracteres' 
            });
        }

        // Verificar duplicatas
        const checkResult = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (checkResult.rows.length > 0) {
            return res.status(409).json({ 
                error: 'Username ou email já existe' 
            });
        }

        // Hash da senha
        const password_hash = await bcrypt.hash(password, 10);

        // Criar usuário
        const result = await pool.query(`
            INSERT INTO users (username, email, password_hash, full_name, role, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id, username, email, full_name, role, created_at
        `, [username, email, password_hash, full_name || null, role || 'user']);

        console.log('✅ Usuário criado pelo admin:', result.rows[0].username);

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== EDITAR USUÁRIO =====
router.put('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { email, full_name, bio, is_active } = req.body;

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            values.push(email);
        }

        if (full_name !== undefined) {
            updates.push(`full_name = $${paramCount++}`);
            values.push(full_name);
        }

        if (bio !== undefined) {
            updates.push(`bio = $${paramCount++}`);
            values.push(bio);
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ 
                error: 'Nenhum campo para atualizar' 
            });
        }

        values.push(userId);

        const result = await pool.query(`
            UPDATE users
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING id, username, email, full_name, bio, is_active, updated_at
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        console.log('✅ Usuário atualizado:', result.rows[0].username);

        res.json({
            success: true,
            message: 'Usuário atualizado com sucesso',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== DELETAR USUÁRIO =====
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Não permitir deletar o próprio usuário
        if (userId === req.user.userId) {
            return res.status(400).json({ 
                error: 'Você não pode deletar sua própria conta' 
            });
        }

        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING username',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        console.log('✅ Usuário deletado:', result.rows[0].username);

        res.json({
            success: true,
            message: 'Usuário deletado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== BLOQUEAR USUÁRIO =====
router.post('/users/:id/block', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const result = await pool.query(
            'UPDATE users SET is_active = false WHERE id = $1 RETURNING username',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        console.log('✅ Usuário bloqueado:', result.rows[0].username);

        res.json({
            success: true,
            message: 'Usuário bloqueado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao bloquear usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== DESBLOQUEAR USUÁRIO =====
router.post('/users/:id/unblock', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const result = await pool.query(
            'UPDATE users SET is_active = true WHERE id = $1 RETURNING username',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        console.log('✅ Usuário desbloqueado:', result.rows[0].username);

        res.json({
            success: true,
            message: 'Usuário desbloqueado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao desbloquear usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== CRIAR/ATIVAR ASSINATURA =====
router.post('/subscriptions', async (req, res) => {
    try {
        const { user_id, plan_months, is_trial } = req.body;

        if (!user_id || (!plan_months && !is_trial)) {
            return res.status(400).json({ 
                error: 'user_id e plan_months (ou is_trial) são obrigatórios' 
            });
        }

        // Verificar se usuário existe
        const userCheck = await pool.query(
            'SELECT id, username FROM users WHERE id = $1',
            [user_id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        // Desativar assinatura anterior se existir
        await pool.query(
            'UPDATE subscriptions SET is_active = false WHERE user_id = $1 AND is_active = true',
            [user_id]
        );

        // Calcular datas
        const start_date = new Date();
        let end_date;

        if (is_trial) {
            // Teste de 1 dia
            end_date = new Date(start_date);
            end_date.setDate(end_date.getDate() + 1);
        } else {
            // Assinatura normal
            end_date = new Date(start_date);
            end_date.setMonth(end_date.getMonth() + parseInt(plan_months));
        }

        // Criar nova assinatura
        const result = await pool.query(`
            INSERT INTO subscriptions (user_id, plan_months, start_date, end_date, is_trial, is_active, created_by_admin_id)
            VALUES ($1, $2, $3, $4, $5, true, $6)
            RETURNING id, user_id, plan_months, start_date, end_date, is_trial
        `, [user_id, is_trial ? 0 : plan_months, start_date, end_date, is_trial || false, req.user.userId]);

        console.log(`✅ Assinatura criada para ${userCheck.rows[0].username}: ${is_trial ? 'Teste 1 dia' : `${plan_months} meses`}`);

        res.status(201).json({
            success: true,
            message: 'Assinatura criada com sucesso',
            subscription: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar assinatura:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== RENOVAR ASSINATURA =====
router.put('/subscriptions/:id/renew', async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const { plan_months } = req.body;

        if (!plan_months) {
            return res.status(400).json({ 
                error: 'plan_months é obrigatório' 
            });
        }

        // Buscar assinatura atual
        const subResult = await pool.query(
            'SELECT * FROM subscriptions WHERE id = $1',
            [subscriptionId]
        );

        if (subResult.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Assinatura não encontrada' 
            });
        }

        const subscription = subResult.rows[0];
        const now = new Date();
        const currentEndDate = new Date(subscription.end_date);

        let newEndDate;

        if (currentEndDate > now && subscription.is_active) {
            // Assinatura ainda ativa: adicionar meses ao end_date atual
            newEndDate = new Date(currentEndDate);
            newEndDate.setMonth(newEndDate.getMonth() + parseInt(plan_months));
        } else {
            // Assinatura expirada: começar de agora
            newEndDate = new Date(now);
            newEndDate.setMonth(newEndDate.getMonth() + parseInt(plan_months));
        }

        const result = await pool.query(`
            UPDATE subscriptions
            SET 
                plan_months = $1,
                end_date = $2,
                is_active = true,
                is_trial = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, user_id, plan_months, start_date, end_date, is_active
        `, [plan_months, newEndDate, subscriptionId]);

        console.log(`✅ Assinatura renovada: +${plan_months} meses`);

        res.json({
            success: true,
            message: 'Assinatura renovada com sucesso',
            subscription: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao renovar assinatura:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== LISTAR ASSINATURAS EXPIRANDO =====
router.get('/subscriptions/expiring', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;

        const result = await pool.query(`
            SELECT 
                s.id,
                s.user_id,
                u.username,
                u.email,
                s.plan_months,
                s.end_date,
                s.is_trial,
                EXTRACT(DAY FROM (s.end_date - CURRENT_TIMESTAMP)) as days_remaining
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.is_active = true
              AND s.end_date BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '${days} days'
            ORDER BY s.end_date ASC
        `);

        res.json({
            subscriptions: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Erro ao listar assinaturas expirando:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
