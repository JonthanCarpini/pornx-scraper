import express from 'express';
import { authenticateToken, requireActiveSubscription } from '../middleware/auth.js';
import pool from '../database/db.js';

const router = express.Router();

// Todos os endpoints requerem autenticação e assinatura ativa
router.use(authenticateToken);
router.use(requireActiveSubscription);

// ===== LISTAR FAVORITOS DO USUÁRIO =====
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;

        // Buscar favoritos com informações dos vídeos
        const result = await pool.query(`
            SELECT 
                f.id,
                f.video_source,
                f.video_id,
                f.created_at,
                CASE 
                    WHEN f.video_source = 'xxxfollow' THEN (
                        SELECT json_build_object(
                            'title', v.title,
                            'thumbnail_url', v.thumbnail_url,
                            'duration', v.duration,
                            'model_id', v.model_id,
                            'model_name', m.username,
                            'model_avatar', m.avatar_url
                        )
                        FROM xxxfollow_videos v
                        LEFT JOIN xxxfollow_models m ON v.model_id = m.id
                        WHERE v.id = f.video_id
                    )
                    WHEN f.video_source = 'clubeadulto' THEN (
                        SELECT json_build_object(
                            'title', v.title,
                            'thumbnail_url', v.thumbnail_url,
                            'duration', v.duration,
                            'model_id', v.model_id,
                            'model_name', m.name,
                            'model_avatar', m.image_url
                        )
                        FROM clubeadulto_videos v
                        LEFT JOIN clubeadulto_models m ON v.model_id = m.id
                        WHERE v.id = f.video_id
                    )
                    WHEN f.video_source = 'nsfw247' THEN (
                        SELECT json_build_object(
                            'title', v.title,
                            'thumbnail_url', v.thumbnail_url,
                            'duration', v.duration,
                            'model_id', v.model_id,
                            'model_name', m.name,
                            'model_avatar', NULL
                        )
                        FROM videos v
                        LEFT JOIN models m ON v.model_id = m.id
                        WHERE v.id = f.video_id
                    )
                END as video_info
            FROM favorites f
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        // Contar total
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM favorites WHERE user_id = $1',
            [userId]
        );

        const total = parseInt(countResult.rows[0].count);

        // Filtrar favoritos com vídeos válidos
        const favorites = result.rows
            .filter(row => row.video_info !== null)
            .map(row => ({
                id: row.id,
                video_source: row.video_source,
                video_id: row.video_id,
                created_at: row.created_at,
                video: row.video_info
            }));

        res.json({
            favorites,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar favoritos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADICIONAR FAVORITO =====
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { video_source, video_id } = req.body;

        // Validações
        if (!video_source || !video_id) {
            return res.status(400).json({ 
                error: 'video_source e video_id são obrigatórios' 
            });
        }

        const validSources = ['xxxfollow', 'clubeadulto', 'nsfw247'];
        if (!validSources.includes(video_source)) {
            return res.status(400).json({ 
                error: 'video_source inválido' 
            });
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
            return res.status(404).json({ 
                error: 'Vídeo não encontrado' 
            });
        }

        // Adicionar favorito (ON CONFLICT para evitar duplicatas)
        const result = await pool.query(`
            INSERT INTO favorites (user_id, video_source, video_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, video_source, video_id) DO NOTHING
            RETURNING id, video_source, video_id, created_at
        `, [userId, video_source, video_id]);

        if (result.rows.length === 0) {
            return res.status(409).json({ 
                error: 'Vídeo já está nos favoritos' 
            });
        }

        console.log(`✅ Favorito adicionado: user ${userId}, video ${video_source}:${video_id}`);

        res.status(201).json({
            success: true,
            message: 'Vídeo adicionado aos favoritos',
            favorite: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao adicionar favorito:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== REMOVER FAVORITO =====
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const favoriteId = parseInt(req.params.id);

        const result = await pool.query(
            'DELETE FROM favorites WHERE id = $1 AND user_id = $2 RETURNING id',
            [favoriteId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Favorito não encontrado' 
            });
        }

        console.log(`✅ Favorito removido: user ${userId}, favorite ${favoriteId}`);

        res.json({
            success: true,
            message: 'Vídeo removido dos favoritos'
        });

    } catch (error) {
        console.error('Erro ao remover favorito:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== REMOVER FAVORITO POR VIDEO =====
router.delete('/video/:source/:videoId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { source, videoId } = req.params;

        const result = await pool.query(
            'DELETE FROM favorites WHERE user_id = $1 AND video_source = $2 AND video_id = $3 RETURNING id',
            [userId, source, parseInt(videoId)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Favorito não encontrado' 
            });
        }

        console.log(`✅ Favorito removido: user ${userId}, video ${source}:${videoId}`);

        res.json({
            success: true,
            message: 'Vídeo removido dos favoritos'
        });

    } catch (error) {
        console.error('Erro ao remover favorito:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== VERIFICAR SE VÍDEO ESTÁ NOS FAVORITOS =====
router.get('/check/:source/:videoId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { source, videoId } = req.params;

        const result = await pool.query(
            'SELECT id FROM favorites WHERE user_id = $1 AND video_source = $2 AND video_id = $3',
            [userId, source, parseInt(videoId)]
        );

        res.json({
            is_favorited: result.rows.length > 0,
            favorite_id: result.rows.length > 0 ? result.rows[0].id : null
        });

    } catch (error) {
        console.error('Erro ao verificar favorito:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
