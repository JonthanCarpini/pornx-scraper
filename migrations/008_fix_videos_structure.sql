-- Migration 008: Corrigir estrutura das tabelas de vídeos
-- Dropar e recriar VIEWs para permitir alteração de colunas

-- Dropar VIEW que depende das colunas
DROP VIEW IF EXISTS unified_videos CASCADE;

-- ===== CLUBEADULTO_VIDEOS =====
-- Adicionar colunas faltantes
ALTER TABLE clubeadulto_videos ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE clubeadulto_videos ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE clubeadulto_videos ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Converter duration de VARCHAR para INTEGER
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'clubeadulto_videos' 
               AND column_name = 'duration' 
               AND data_type = 'character varying') THEN
        
        ALTER TABLE clubeadulto_videos ADD COLUMN duration_int INTEGER;
        
        UPDATE clubeadulto_videos 
        SET duration_int = CASE 
            WHEN duration ~ '^[0-9]+$' THEN duration::INTEGER 
            ELSE NULL 
        END;
        
        ALTER TABLE clubeadulto_videos DROP COLUMN duration;
        ALTER TABLE clubeadulto_videos RENAME COLUMN duration_int TO duration;
    END IF;
END $$;

-- ===== VIDEOS (NSFW247) =====
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Atualizar valores NULL para 0
UPDATE clubeadulto_videos SET view_count = 0 WHERE view_count IS NULL;
UPDATE clubeadulto_videos SET like_count = 0 WHERE like_count IS NULL;
UPDATE clubeadulto_videos SET comment_count = 0 WHERE comment_count IS NULL;

UPDATE videos SET view_count = 0 WHERE view_count IS NULL;
UPDATE videos SET like_count = 0 WHERE like_count IS NULL;
UPDATE videos SET comment_count = 0 WHERE comment_count IS NULL;

UPDATE xxxfollow_videos SET view_count = 0 WHERE view_count IS NULL;
UPDATE xxxfollow_videos SET like_count = 0 WHERE like_count IS NULL;
UPDATE xxxfollow_videos SET comment_count = 0 WHERE comment_count IS NULL;

-- Recriar VIEW unified_videos
CREATE OR REPLACE VIEW unified_videos AS
SELECT 
    'xxxfollow' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.poster_url,
    v.duration,
    v.view_count,
    v.like_count,
    v.video_url as video_source_url,
    v.model_id,
    m.username as model_name,
    m.avatar_url as model_avatar,
    v.created_at
FROM xxxfollow_videos v
LEFT JOIN xxxfollow_models m ON v.model_id = m.id
WHERE v.status = 'active'

UNION ALL

SELECT 
    'clubeadulto' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.poster_url,
    v.duration,
    v.view_count,
    v.like_count,
    COALESCE(v.video_source_url, v.m3u8_url, v.video_url) as video_source_url,
    v.model_id,
    m.name as model_name,
    m.image_url as model_avatar,
    v.created_at
FROM clubeadulto_videos v
LEFT JOIN clubeadulto_models m ON v.model_id = m.id
WHERE v.status = 'active'

UNION ALL

SELECT 
    'nsfw247' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.poster_url,
    v.duration,
    v.view_count,
    v.like_count,
    v.video_source_url,
    v.model_id,
    m.name as model_name,
    NULL as model_avatar,
    v.created_at
FROM videos v
LEFT JOIN models m ON v.model_id = m.id
WHERE v.status = 'active';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_clubeadulto_videos_view_count ON clubeadulto_videos(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_view_count ON videos(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_videos_view_count ON xxxfollow_videos(view_count DESC);

-- Log
DO $$
BEGIN
    RAISE NOTICE 'Migration 008 concluída: Estrutura de vídeos corrigida e VIEW recriada';
END $$;
