import express from 'express';
import { authenticateToken, requireActiveSubscription } from '../middleware/auth.js';
import pool from '../database/db.js';

const router = express.Router();

// Todos os endpoints requerem autenticação e assinatura ativa
router.use(authenticateToken);
router.use(requireActiveSubscription);

// ===== LISTAR MODELOS SEGUIDAS =====
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;

        // Buscar follows com informações das modelos
        const result = await pool.query(`
            SELECT 
                f.id,
                f.model_source,
                f.model_id,
                f.created_at,
                CASE 
                    WHEN f.model_source = 'xxxfollow' THEN (
                        SELECT json_build_object(
                            'name', m.username,
                            'avatar_url', m.avatar_url,
                            'cover_url', m.cover_url,
                            'bio', m.bio,
                            'follower_count', m.follower_count,
                            'video_count', m.video_count
                        )
                        FROM xxxfollow_models m
                        WHERE m.id = f.model_id
                    )
                    WHEN f.model_source = 'clubeadulto' THEN (
                        SELECT json_build_object(
                            'name', m.name,
                            'avatar_url', m.image_url,
                            'cover_url', m.image_url,
                            'bio', m.bio,
                            'follower_count', m.follower_count,
                            'video_count', m.video_count
                        )
                        FROM clubeadulto_models m
                        WHERE m.id = f.model_id
                    )
                    WHEN f.model_source = 'nsfw247' THEN (
                        SELECT json_build_object(
                            'name', m.name,
                            'avatar_url', m.avatar_url,
                            'cover_url', m.banner_url,
                            'bio', m.bio,
                            'follower_count', m.follower_count,
                            'video_count', m.video_count
                        )
                        FROM models m
                        WHERE m.id = f.model_id
                    )
                END as model_info
            FROM follows f
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        // Contar total
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM follows WHERE user_id = $1',
            [userId]
        );

        const total = parseInt(countResult.rows[0].count);

        // Filtrar follows com modelos válidas
        const follows = result.rows
            .filter(row => row.model_info !== null)
            .map(row => ({
                id: row.id,
                model_source: row.model_source,
                model_id: row.model_id,
                created_at: row.created_at,
                model: row.model_info
            }));

        res.json({
            follows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar follows:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== SEGUIR MODELO =====
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { model_source, model_id } = req.body;

        // Validações
        if (!model_source || !model_id) {
            return res.status(400).json({ 
                error: 'model_source e model_id são obrigatórios' 
            });
        }

        const validSources = ['xxxfollow', 'clubeadulto', 'nsfw247'];
        if (!validSources.includes(model_source)) {
            return res.status(400).json({ 
                error: 'model_source inválido' 
            });
        }

        // Verificar se modelo existe
        let modelExists = false;
        if (model_source === 'xxxfollow') {
            const check = await pool.query('SELECT id FROM xxxfollow_models WHERE id = $1', [model_id]);
            modelExists = check.rows.length > 0;
        } else if (model_source === 'clubeadulto') {
            const check = await pool.query('SELECT id FROM clubeadulto_models WHERE id = $1', [model_id]);
            modelExists = check.rows.length > 0;
        } else if (model_source === 'nsfw247') {
            const check = await pool.query('SELECT id FROM models WHERE id = $1', [model_id]);
            modelExists = check.rows.length > 0;
        }

        if (!modelExists) {
            return res.status(404).json({ 
                error: 'Modelo não encontrada' 
            });
        }

        // Seguir modelo (ON CONFLICT para evitar duplicatas)
        const result = await pool.query(`
            INSERT INTO follows (user_id, model_source, model_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, model_source, model_id) DO NOTHING
            RETURNING id, model_source, model_id, created_at
        `, [userId, model_source, model_id]);

        if (result.rows.length === 0) {
            return res.status(409).json({ 
                error: 'Você já segue esta modelo' 
            });
        }

        console.log(`✅ Follow adicionado: user ${userId}, model ${model_source}:${model_id}`);

        res.status(201).json({
            success: true,
            message: 'Modelo seguida com sucesso',
            follow: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao seguir modelo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== DEIXAR DE SEGUIR MODELO =====
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const followId = parseInt(req.params.id);

        const result = await pool.query(
            'DELETE FROM follows WHERE id = $1 AND user_id = $2 RETURNING id',
            [followId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Follow não encontrado' 
            });
        }

        console.log(`✅ Follow removido: user ${userId}, follow ${followId}`);

        res.json({
            success: true,
            message: 'Deixou de seguir a modelo'
        });

    } catch (error) {
        console.error('Erro ao remover follow:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== DEIXAR DE SEGUIR POR MODELO =====
router.delete('/model/:source/:modelId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { source, modelId } = req.params;

        const result = await pool.query(
            'DELETE FROM follows WHERE user_id = $1 AND model_source = $2 AND model_id = $3 RETURNING id',
            [userId, source, parseInt(modelId)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Follow não encontrado' 
            });
        }

        console.log(`✅ Follow removido: user ${userId}, model ${source}:${modelId}`);

        res.json({
            success: true,
            message: 'Deixou de seguir a modelo'
        });

    } catch (error) {
        console.error('Erro ao remover follow:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== VERIFICAR SE SEGUE MODELO =====
router.get('/check/:source/:modelId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { source, modelId } = req.params;

        const result = await pool.query(
            'SELECT id FROM follows WHERE user_id = $1 AND model_source = $2 AND model_id = $3',
            [userId, source, parseInt(modelId)]
        );

        res.json({
            is_following: result.rows.length > 0,
            follow_id: result.rows.length > 0 ? result.rows[0].id : null
        });

    } catch (error) {
        console.error('Erro ao verificar follow:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
