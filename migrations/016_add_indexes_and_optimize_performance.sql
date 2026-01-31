-- Migration: Adicionar índices compostos para otimizar performance das VIEWs
-- Data: 2026-01-30

-- Criar índices compostos nas tabelas de analytics para otimizar os JOINs
CREATE INDEX IF NOT EXISTS idx_video_views_source_id ON video_views(video_source, video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_source_id ON video_likes(video_source, video_id);

-- Criar índices nas tabelas principais para otimizar ordenação
CREATE INDEX IF NOT EXISTS idx_xxxfollow_videos_created_at ON xxxfollow_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_videos_created_at ON clubeadulto_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

-- Analisar tabelas para atualizar estatísticas do query planner
ANALYZE video_views;
ANALYZE video_likes;
ANALYZE xxxfollow_videos;
ANALYZE clubeadulto_videos;
ANALYZE videos;
