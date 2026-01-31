-- Migration: Adicionar tabelas de analytics (views, likes, follows)
-- Data: 2026-01-30

-- Tabela de visualizações de vídeos
CREATE TABLE IF NOT EXISTS video_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(50) NOT NULL,
    video_id INTEGER NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_source, video_id)
);

CREATE INDEX idx_video_views_user ON video_views(user_id);
CREATE INDEX idx_video_views_video ON video_views(video_source, video_id);
CREATE INDEX idx_video_views_date ON video_views(viewed_at);

-- Tabela de curtidas de vídeos
CREATE TABLE IF NOT EXISTS video_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(50) NOT NULL,
    video_id INTEGER NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_source, video_id)
);

CREATE INDEX idx_video_likes_user ON video_likes(user_id);
CREATE INDEX idx_video_likes_video ON video_likes(video_source, video_id);

-- Atualizar view unified_videos para incluir contagens reais
DROP VIEW IF EXISTS unified_videos CASCADE;

CREATE VIEW unified_videos AS
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
    m.name as model_name,
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
    m.name as model_name,
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
    m.name as model_name,
    m.cover_url as model_avatar,
    COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'nsfw247' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'nsfw247' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM nsfw247_videos v
LEFT JOIN nsfw247_models m ON v.model_id = m.id;

-- Atualizar view unified_models para incluir contagens reais de seguidores
DROP VIEW IF EXISTS unified_models CASCADE;

CREATE VIEW unified_models AS
-- XXXFollow models
SELECT 
    'xxxfollow' as source,
    m.id,
    m.name,
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
    m.name,
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
    m.name,
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
