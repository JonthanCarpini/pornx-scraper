-- Migration: Otimizar VIEW unified_videos usando JOINs ao invés de subqueries
-- Data: 2026-01-30
-- Melhora significativa de performance ao carregar 100 vídeos por página

-- Recriar VIEW unified_videos com JOINs otimizados
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
    COALESCE(v.view_count, 0) + COALESCE(vv.view_count, 0) as view_count,
    COALESCE(vl.like_count, 0) as like_count,
    v.created_at
FROM xxxfollow_videos v
LEFT JOIN xxxfollow_models m ON v.model_id = m.id
LEFT JOIN (
    SELECT video_source, video_id, COUNT(*) as view_count
    FROM video_views
    WHERE video_source = 'xxxfollow'
    GROUP BY video_source, video_id
) vv ON vv.video_id = v.id
LEFT JOIN (
    SELECT video_source, video_id, COUNT(*) as like_count
    FROM video_likes
    WHERE video_source = 'xxxfollow'
    GROUP BY video_source, video_id
) vl ON vl.video_id = v.id

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
    COALESCE(v.view_count, 0) + COALESCE(vv.view_count, 0) as view_count,
    COALESCE(vl.like_count, 0) as like_count,
    v.created_at
FROM clubeadulto_videos v
LEFT JOIN clubeadulto_models m ON v.model_id = m.id
LEFT JOIN (
    SELECT video_source, video_id, COUNT(*) as view_count
    FROM video_views
    WHERE video_source = 'clubeadulto'
    GROUP BY video_source, video_id
) vv ON vv.video_id = v.id
LEFT JOIN (
    SELECT video_source, video_id, COUNT(*) as like_count
    FROM video_likes
    WHERE video_source = 'clubeadulto'
    GROUP BY video_source, video_id
) vl ON vl.video_id = v.id

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
    COALESCE(v.view_count, 0) + COALESCE(vv.view_count, 0) as view_count,
    COALESCE(vl.like_count, 0) as like_count,
    v.created_at
FROM videos v
LEFT JOIN models m ON v.model_id = m.id
LEFT JOIN (
    SELECT video_source, video_id, COUNT(*) as view_count
    FROM video_views
    WHERE video_source = 'nsfw247'
    GROUP BY video_source, video_id
) vv ON vv.video_id = v.id
LEFT JOIN (
    SELECT video_source, video_id, COUNT(*) as like_count
    FROM video_likes
    WHERE video_source = 'nsfw247'
    GROUP BY video_source, video_id
) vl ON vl.video_id = v.id;

-- Recriar VIEW unified_models com JOINs otimizados
CREATE OR REPLACE VIEW unified_models AS
-- XXXFollow models
SELECT 
    'xxxfollow' as source,
    m.id,
    m.username as name,
    NULL as profile_url,
    m.avatar_url,
    m.cover_url as banner_url,
    COALESCE(m.cover_url, m.avatar_url) as cover_url,
    m.bio,
    m.gender,
    COALESCE(m.follower_count, 0) + COALESCE(f.follow_count, 0) as follower_count,
    m.like_count,
    m.view_count,
    m.post_count,
    m.video_count,
    m.status,
    m.created_at
FROM xxxfollow_models m
LEFT JOIN (
    SELECT model_source, model_id, COUNT(*) as follow_count
    FROM follows
    WHERE model_source = 'xxxfollow'
    GROUP BY model_source, model_id
) f ON f.model_id = m.id

UNION ALL

-- ClubAdulto models
SELECT 
    'clubeadulto' as source,
    m.id,
    m.name,
    m.profile_url,
    m.image_url as avatar_url,
    m.cover_url as banner_url,
    COALESCE(m.cover_url, m.image_url) as cover_url,
    m.bio,
    m.gender,
    COALESCE(m.follower_count, 0) + COALESCE(f.follow_count, 0) as follower_count,
    m.like_count,
    m.view_count,
    m.post_count,
    m.video_count,
    m.status,
    m.created_at
FROM clubeadulto_models m
LEFT JOIN (
    SELECT model_source, model_id, COUNT(*) as follow_count
    FROM follows
    WHERE model_source = 'clubeadulto'
    GROUP BY model_source, model_id
) f ON f.model_id = m.id

UNION ALL

-- NSFW247 models (tabela: models)
SELECT 
    'nsfw247' as source,
    m.id,
    m.name,
    m.profile_url,
    m.cover_url as avatar_url,
    NULL as banner_url,
    m.cover_url,
    m.bio,
    m.gender,
    COALESCE(m.follower_count, 0) + COALESCE(f.follow_count, 0) as follower_count,
    m.like_count,
    m.view_count,
    m.post_count,
    m.video_count,
    m.status,
    m.created_at
FROM models m
LEFT JOIN (
    SELECT model_source, model_id, COUNT(*) as follow_count
    FROM follows
    WHERE model_source = 'nsfw247'
    GROUP BY model_source, model_id
) f ON f.model_id = m.id;
