-- Migration: Corrigir VIEWs unified removendo poster_url que não existe em todas as tabelas
-- Data: 2026-01-30

-- Recriar VIEW unified_videos SEM poster_url
CREATE OR REPLACE VIEW unified_videos AS
-- XXXFollow videos
SELECT 
    'xxxfollow' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.video_url,
    NULL as video_source_url,
    v.sd_url,
    v.duration,
    v.model_id,
    m.username as model_name,
    m.avatar_url as model_avatar,
    COALESCE(v.view_count, 0) + COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'xxxfollow' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'xxxfollow' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM xxxfollow_videos v
LEFT JOIN xxxfollow_models m ON v.model_id = m.id

UNION ALL

-- ClubAdulto videos
SELECT 
    'clubeadulto' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.video_url,
    v.m3u8_url as video_source_url,
    NULL as sd_url,
    v.duration,
    v.model_id,
    m.name as model_name,
    m.image_url as model_avatar,
    COALESCE(v.view_count, 0) + COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'clubeadulto' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'clubeadulto' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM clubeadulto_videos v
LEFT JOIN clubeadulto_models m ON v.model_id = m.id

UNION ALL

-- NSFW247 videos (tabelas: videos e models)
SELECT 
    'nsfw247' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.video_url,
    v.video_source_url,
    NULL as sd_url,
    v.duration,
    v.model_id,
    m.name as model_name,
    m.cover_url as model_avatar,
    COALESCE(v.view_count, 0) + COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'nsfw247' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'nsfw247' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM videos v
LEFT JOIN models m ON v.model_id = m.id;
