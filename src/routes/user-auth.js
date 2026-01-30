import express from 'express';
import bcrypt from 'bcrypt';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import pool from '../database/db.js';

const router = express.Router();

// ===== REGISTRO DE NOVO USUÁRIO =====
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, full_name } = req.body;

        // Validações
        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email e senha são obrigatórios' 
            });
        }

        // Validar formato do username (apenas letras, números e underscore)
        if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
            return res.status(400).json({ 
                error: 'Username deve ter entre 3-50 caracteres e conter apenas letras, números e underscore' 
            });
        }

        // Validar formato do email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ 
                error: 'Email inválido' 
            });
        }

        // Validar senha mínima
        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Senha deve ter no mínimo 6 caracteres' 
            });
        }

        // Verificar se username já existe
        const usernameCheck = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (usernameCheck.rows.length > 0) {
            return res.status(409).json({ 
                error: 'Username já está em uso' 
            });
        }

        // Verificar se email já existe
        const emailCheck = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (emailCheck.rows.length > 0) {
            return res.status(409).json({ 
                error: 'Email já está cadastrado' 
            });
        }

        // Hash da senha
        const password_hash = await bcrypt.hash(password, 10);

        // Criar usuário
        const result = await pool.query(`
            INSERT INTO users (username, email, password_hash, full_name, role, is_active)
            VALUES ($1, $2, $3, $4, 'user', true)
            RETURNING id, username, email, full_name, created_at
        `, [username, email, password_hash, full_name || null]);

        const user = result.rows[0];

        console.log('✅ Novo usuário registrado:', user.username);

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('❌ Erro ao registrar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// ===== LOGIN DE USUÁRIO =====
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('🔐 Tentativa de login:', username);

        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username e senha são obrigatórios' 
            });
        }

        // Buscar usuário
        const result = await pool.query(`
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.password_hash, 
                u.full_name,
                u.avatar_url,
                u.is_active,
                u.role,
                s.is_active as subscription_active,
                s.end_date as subscription_end_date,
                s.is_trial
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id AND s.is_active = true
            WHERE u.username = $1
        `, [username]);

        if (result.rows.length === 0) {
            console.log('❌ Usuário não encontrado:', username);
            return res.status(401).json({ 
                error: 'Usuário ou senha incorretos' 
            });
        }

        const user = result.rows[0];

        // Verificar se conta está bloqueada
        if (!user.is_active) {
            console.log('❌ Conta bloqueada:', username);
            return res.status(403).json({ 
                error: 'Conta bloqueada. Entre em contato com o administrador.' 
            });
        }

        // Verificar senha
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            console.log('❌ Senha incorreta para:', username);
            return res.status(401).json({ 
                error: 'Usuário ou senha incorretos' 
            });
        }

        // Atualizar last_login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Gerar token
        const token = generateToken(user.id, user.username, user.role);
        console.log('✅ Token gerado para:', username);

        // Definir cookie
        const cookieName = user.role === 'admin' ? 'adminToken' : 'userToken';
        res.cookie(cookieName, token, {
            httpOnly: true,
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
            sameSite: 'lax',
            path: '/'
        });

        // Verificar status da assinatura
        let hasActiveSubscription = false;
        if (user.subscription_active && user.subscription_end_date) {
            hasActiveSubscription = new Date(user.subscription_end_date) >= new Date();
        }

        console.log('✅ Login bem-sucedido:', username);

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                role: user.role,
                hasActiveSubscription,
                subscription: user.subscription_active ? {
                    end_date: user.subscription_end_date,
                    is_trial: user.is_trial
                } : null
            }
        });

    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ===== LOGOUT =====
router.post('/logout', (req, res) => {
    res.clearCookie('userToken');
    res.clearCookie('adminToken');
    res.json({ 
        success: true, 
        message: 'Logout realizado com sucesso' 
    });
});

// ===== OBTER DADOS DO USUÁRIO LOGADO =====
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.email,
                u.full_name,
                u.avatar_url,
                u.bio,
                u.role,
                u.is_active,
                u.created_at,
                u.last_login,
                s.id as subscription_id,
                s.plan_months,
                s.start_date,
                s.end_date,
                s.is_trial,
                s.is_active as subscription_active
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id AND s.is_active = true
            WHERE u.id = $1
        `, [req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        const user = result.rows[0];

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            bio: user.bio,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            last_login: user.last_login,
            subscription: user.subscription_active ? {
                id: user.subscription_id,
                plan_months: user.plan_months,
                start_date: user.start_date,
                end_date: user.end_date,
                is_trial: user.is_trial,
                is_active: user.subscription_active && new Date(user.end_date) >= new Date()
            } : null
        });

    } catch (error) {
        console.error('❌ Erro ao buscar dados do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
    }
});

export default router;
