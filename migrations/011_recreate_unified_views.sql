-- Migration: Recriar VIEWs unified_videos e unified_models
-- Data: 2026-01-30

-- Recriar VIEW unified_videos
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
    COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'xxxfollow' AND video_id = v.id), 0) as view_count,
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
    m.username as model_name,
    m.avatar_url as model_avatar,
    COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'clubeadulto' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'clubeadulto' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM clubeadulto_videos v
LEFT JOIN clubeadulto_models m ON v.model_id = m.id

UNION ALL

-- NSFW247 videos
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
    m.username as model_name,
    m.cover_url as model_avatar,
    COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'nsfw247' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'nsfw247' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM nsfw247_videos v
LEFT JOIN nsfw247_models m ON v.model_id = m.id;

-- Recriar VIEW unified_models
CREATE OR REPLACE VIEW unified_models AS
-- XXXFollow models
SELECT 
    'xxxfollow' as source,
    m.id,
    m.username as name,
    m.profile_url,
    m.avatar_url,
    m.banner_url,
    COALESCE(m.banner_url, m.avatar_url) as cover_url,
    m.bio,
    m.gender,
    COALESCE((SELECT COUNT(*) FROM follows WHERE model_source = 'xxxfollow' AND model_id = m.id), 0) as follower_count,
    m.like_count,
    m.view_count,
    m.post_count,
    m.video_count,
    m.status,
    m.created_at
FROM xxxfollow_models m

UNION ALL

-- ClubAdulto models
SELECT 
    'clubeadulto' as source,
    m.id,
    m.username as name,
    m.profile_url,
    m.avatar_url,
    m.banner_url,
    COALESCE(m.banner_url, m.avatar_url) as cover_url,
    m.bio,
    m.gender,
    COALESCE((SELECT COUNT(*) FROM follows WHERE model_source = 'clubeadulto' AND model_id = m.id), 0) as follower_count,
    m.like_count,
    m.view_count,
    m.post_count,
    m.video_count,
    m.status,
    m.created_at
FROM clubeadulto_models m

UNION ALL

-- NSFW247 models
SELECT 
    'nsfw247' as source,
    m.id,
    m.username as name,
    m.profile_url,
    m.cover_url as avatar_url,
    NULL as banner_url,
    m.cover_url,
    m.bio,
    m.gender,
    COALESCE((SELECT COUNT(*) FROM follows WHERE model_source = 'nsfw247' AND model_id = m.id), 0) as follower_count,
    NULL as like_count,
    NULL as view_count,
    NULL as post_count,
    m.video_count,
    m.status,
    m.created_at
FROM nsfw247_models m;
