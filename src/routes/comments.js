import express from 'express';
import { authenticateToken, requireActiveSubscription, requireAdmin } from '../middleware/auth.js';
import pool from '../database/db.js';

const router = express.Router();

// ===== LISTAR COMENTÁRIOS APROVADOS DE UM VÍDEO (PÚBLICO) =====
router.get('/:source/:videoId', async (req, res) => {
    try {
        const { source, videoId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;

        const validSources = ['xxxfollow', 'clubeadulto', 'nsfw247'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: 'video_source inválido' });
        }

        // Buscar comentários aprovados com informações do usuário
        const result = await pool.query(`
            SELECT 
                c.id,
                c.content,
                c.created_at,
                u.id as user_id,
                u.username,
                u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.video_source = $1 
              AND c.video_id = $2 
              AND c.is_approved = true
            ORDER BY c.created_at DESC
            LIMIT $3 OFFSET $4
        `, [source, parseInt(videoId), limit, offset]);

        // Contar total de comentários aprovados
        const countResult = await pool.query(`
            SELECT COUNT(*) 
            FROM comments 
            WHERE video_source = $1 AND video_id = $2 AND is_approved = true
        `, [source, parseInt(videoId)]);

        const total = parseInt(countResult.rows[0].count);

        res.json({
            comments: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar comentários:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== CRIAR COMENTÁRIO (REQUER AUTENTICAÇÃO E ASSINATURA) =====
router.post('/', authenticateToken, requireActiveSubscription, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { video_source, video_id, content } = req.body;

        // Validações
        if (!video_source || !video_id || !content) {
            return res.status(400).json({ 
                error: 'video_source, video_id e content são obrigatórios' 
            });
        }

        const validSources = ['xxxfollow', 'clubeadulto', 'nsfw247'];
        if (!validSources.includes(video_source)) {
            return res.status(400).json({ error: 'video_source inválido' });
        }

        if (content.trim().length === 0) {
            return res.status(400).json({ error: 'Comentário não pode estar vazio' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ error: 'Comentário muito longo (máximo 1000 caracteres)' });
        }

        // Verificar se vídeo existe
        let videoExists = false;
        if (video_source === 'xxxfollow') {
            const check = await pool.query('SELECT id FROM xxxfollow_videos WHERE id = $1', [video_id]);
            videoExists = check.rows.length > 0;
        } else if (video_source === 'clubeadulto') {
            const check = await pool.query('SELECT id FROM clubeadulto_videos WHERE id = $1', [video_id]);
            videoExists = check.rows.length > 0;
        } else if (video_source === 'nsfw247') {
            const check = await pool.query('SELECT id FROM videos WHERE id = $1', [video_id]);
            videoExists = check.rows.length > 0;
        }

        if (!videoExists) {
            return res.status(404).json({ error: 'Vídeo não encontrado' });
        }

        // Criar comentário (aguardando aprovação)
        const result = await pool.query(`
            INSERT INTO comments (user_id, video_source, video_id, content, is_approved)
            VALUES ($1, $2, $3, $4, false)
            RETURNING id, user_id, video_source, video_id, content, is_approved, created_at
        `, [userId, video_source, video_id, content.trim()]);

        console.log(`✅ Comentário criado: user ${userId}, video ${video_source}:${video_id}`);

        res.status(201).json({
            success: true,
            message: 'Comentário enviado! Aguardando aprovação do administrador.',
            comment: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar comentário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== DELETAR PRÓPRIO COMENTÁRIO =====
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const commentId = parseInt(req.params.id);

        // Verificar se comentário pertence ao usuário
        const result = await pool.query(
            'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
            [commentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Comentário não encontrado ou você não tem permissão para deletá-lo' 
            });
        }

        console.log(`✅ Comentário deletado: user ${userId}, comment ${commentId}`);

        res.json({
            success: true,
            message: 'Comentário deletado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar comentário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN: LISTAR COMENTÁRIOS PENDENTES =====
router.get('/admin/pending', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT 
                c.id,
                c.user_id,
                c.video_source,
                c.video_id,
                c.content,
                c.created_at,
                u.username,
                u.avatar_url,
                CASE 
                    WHEN c.video_source = 'xxxfollow' THEN (
                        SELECT title FROM xxxfollow_videos WHERE id = c.video_id
                    )
                    WHEN c.video_source = 'clubeadulto' THEN (
                        SELECT title FROM clubeadulto_videos WHERE id = c.video_id
                    )
                    WHEN c.video_source = 'nsfw247' THEN (
                        SELECT title FROM videos WHERE id = c.video_id
                    )
                END as video_title
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.is_approved = false
            ORDER BY c.created_at ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM comments WHERE is_approved = false'
        );

        const total = parseInt(countResult.rows[0].count);

        res.json({
            comments: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar comentários pendentes:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN: APROVAR COMENTÁRIO =====
router.post('/admin/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const adminId = req.user.userId;

        const result = await pool.query(`
            UPDATE comments
            SET 
                is_approved = true,
                approved_by_admin_id = $1,
                approved_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND is_approved = false
            RETURNING id, user_id, video_source, video_id
        `, [adminId, commentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Comentário não encontrado ou já foi aprovado' 
            });
        }

        const comment = result.rows[0];

        // TODO: Criar notificação para o usuário
        // await createNotification(comment.user_id, 'comment_approved', ...)

        console.log(`✅ Comentário aprovado: comment ${commentId} by admin ${adminId}`);

        res.json({
            success: true,
            message: 'Comentário aprovado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao aprovar comentário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN: REJEITAR/DELETAR COMENTÁRIO =====
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);

        const result = await pool.query(
            'DELETE FROM comments WHERE id = $1 RETURNING id',
            [commentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comentário não encontrado' });
        }

        console.log(`✅ Comentário deletado pelo admin: comment ${commentId}`);

        res.json({
            success: true,
            message: 'Comentário deletado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar comentário:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN: LISTAR TODOS OS COMENTÁRIOS =====
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;
        const approved = req.query.approved; // 'true', 'false', ou undefined (todos)

        let whereClause = '';
        const params = [limit, offset];

        if (approved === 'true') {
            whereClause = 'WHERE c.is_approved = true';
        } else if (approved === 'false') {
            whereClause = 'WHERE c.is_approved = false';
        }

        const result = await pool.query(`
            SELECT 
                c.id,
                c.user_id,
                c.video_source,
                c.video_id,
                c.content,
                c.is_approved,
                c.created_at,
                c.approved_at,
                u.username,
                u.avatar_url,
                CASE 
                    WHEN c.video_source = 'xxxfollow' THEN (
                        SELECT title FROM xxxfollow_videos WHERE id = c.video_id
                    )
                    WHEN c.video_source = 'clubeadulto' THEN (
                        SELECT title FROM clubeadulto_videos WHERE id = c.video_id
                    )
                    WHEN c.video_source = 'nsfw247' THEN (
                        SELECT title FROM videos WHERE id = c.video_id
                    )
                END as video_title
            FROM comments c
            JOIN users u ON c.user_id = u.id
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT $1 OFFSET $2
        `, params);

        const countQuery = `SELECT COUNT(*) FROM comments c ${whereClause}`;
        const countResult = await pool.query(countQuery);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            comments: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar comentários:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
