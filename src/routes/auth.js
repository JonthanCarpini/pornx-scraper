import express from 'express';
import bcrypt from 'bcrypt';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Usuário padrão (em produção, usar banco de dados)
const ADMIN_USER = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '$2b$10$8mRgUC/lHM6BCT9m1CgAh.V37O4fIVGL4W0yxrp4m.dTdSTdiKV/K' // senha: admin123
};

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('🔐 Tentativa de login:', username);

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }

        // Verificar usuário
        if (username !== ADMIN_USER.username) {
            console.log('❌ Usuário não encontrado:', username);
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
            console.log('❌ Senha incorreta para:', username);
            return res.status(401).json({ error: 'Usuário ou senha incorretos' });
        }

        // Gerar token
        const token = generateToken(1, username);
        console.log('✅ Token gerado para:', username);

        // Definir cookie (sem secure para funcionar em HTTP)
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: false, // Permitir HTTP em desenvolvimento
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
            sameSite: 'lax', // Mudado de strict para lax
            path: '/'
        });

        console.log('✅ Cookie definido para:', username);

        res.json({ 
            success: true, 
            message: 'Login realizado com sucesso',
            username,
            token // Enviar token também no body para debug
        });

    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true, message: 'Logout realizado com sucesso' });
});

router.get('/verify', async (req, res) => {
    console.log('🔍 Verificando autenticação...');
    console.log('Cookies recebidos:', req.cookies);
    
    const token = req.cookies?.adminToken;
    
    if (!token) {
        console.log('❌ Token não encontrado nos cookies');
        return res.status(401).json({ error: 'Não autenticado' });
    }

    console.log('✅ Token encontrado:', token.substring(0, 20) + '...');

    try {
        const jwt = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const verified = jwt.default.verify(token, JWT_SECRET);
        
        console.log('✅ Token válido para:', verified.username);
        
        res.json({ 
            authenticated: true, 
            username: verified.username 
        });
    } catch (error) {
        console.log('❌ Erro ao verificar token:', error.message);
        res.status(401).json({ error: 'Token inválido' });
    }
});

export default router;
