-- Migration: Adicionar colunas poster_url e video_source_url na tabela videos

ALTER TABLE videos ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_source_url TEXT;

COMMENT ON COLUMN videos.poster_url IS 'URL do poster/capa do vídeo';
COMMENT ON COLUMN videos.video_source_url IS 'URL do source/arquivo do vídeo';
