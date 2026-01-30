-- Migration: Atualizar video_count nas tabelas de modelos com base na contagem real de vídeos

-- ===== XXXFOLLOW =====
-- Atualizar video_count baseado na contagem real de vídeos
UPDATE xxxfollow_models m
SET video_count = (
    SELECT COUNT(*)
    FROM xxxfollow_videos v
    WHERE v.model_id = m.id
);

-- ===== CLUBE ADULTO =====
-- Atualizar video_count baseado na contagem real de vídeos
UPDATE clubeadulto_models m
SET video_count = (
    SELECT COUNT(*)
    FROM clubeadulto_videos v
    WHERE v.model_id = m.id
);

-- ===== NSFW247 =====
-- Atualizar video_count baseado na contagem real de vídeos
UPDATE models m
SET video_count = (
    SELECT COUNT(*)
    FROM videos v
    WHERE v.model_id = m.id
);

-- Verificar resultados
SELECT 
    'xxxfollow' as source,
    COUNT(*) as total_models,
    SUM(video_count) as total_videos,
    AVG(video_count)::int as avg_videos_per_model
FROM xxxfollow_models
UNION ALL
SELECT 
    'clubeadulto' as source,
    COUNT(*) as total_models,
    SUM(video_count) as total_videos,
    AVG(video_count)::int as avg_videos_per_model
FROM clubeadulto_models
UNION ALL
SELECT 
    'nsfw247' as source,
    COUNT(*) as total_models,
    SUM(video_count) as total_videos,
    AVG(video_count)::int as avg_videos_per_model
FROM models;
