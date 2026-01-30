import express from 'express';
import bcrypt from 'bcrypt';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Usuário padrão (em produção, usar banco de dados)
const ADMIN_USER = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '$2b$10$rZ5YhJKvX8qKqKqKqKqKqOqKqKqKqKqKqKqKqKqKqKqKqKqKqKqK' // senha: admin123
};

// Hash da senha padrão "admin123"
const DEFAULT_PASSWORD_HASH = '$2b$10$rZ5YhJKvX8qKqKqKqKqKqOqKqKqKqKqKqKqKqKqKqKqKqKqKqKqK';

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }

        // Verificar usuário
        if (username !== ADMIN_USER.username) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos' });
        }

        // Verificar senha
        let isValidPassword = false;
        
        // Se a senha do env estiver em hash, comparar com bcrypt
        if (ADMIN_USER.password.startsWith('$2b$')) {
            isValidPassword = await bcrypt.compare(password, ADMIN_USER.password);
        } else {
            // Se não estiver em hash, comparar diretamente (desenvolvimento)
            isValidPassword = password === ADMIN_USER.password;
        }

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos' });
        }

        // Gerar token
        const token = generateToken(1, username);

        // Definir cookie
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
            sameSite: 'strict'
        });

        res.json({ 
            success: true, 
            message: 'Login realizado com sucesso',
            username 
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true, message: 'Logout realizado com sucesso' });
});

router.get('/verify', async (req, res) => {
    const token = req.cookies?.adminToken;
    
    if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    try {
        const jwt = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const verified = jwt.default.verify(token, JWT_SECRET);
        
        res.json({ 
            authenticated: true, 
            username: verified.username 
        });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

export default router;
