-- Migration: Criar apenas tabelas de analytics (views, likes)
-- Data: 2026-01-30

-- Dropar tabelas se existirem para recriar
DROP TABLE IF EXISTS video_views CASCADE;
DROP TABLE IF EXISTS video_likes CASCADE;

-- Tabela de visualizações de vídeos
CREATE TABLE video_views (
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
CREATE TABLE video_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(50) NOT NULL,
    video_id INTEGER NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_source, video_id)
);

CREATE INDEX idx_video_likes_user ON video_likes(user_id);
CREATE INDEX idx_video_likes_video ON video_likes(video_source, video_id);
