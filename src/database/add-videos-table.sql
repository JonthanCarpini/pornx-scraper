-- Migration: Adicionar coluna video_count e criar tabela videos

-- Adicionar coluna video_count na tabela models
ALTER TABLE models ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0;

-- Criar tabela videos
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    video_url TEXT NOT NULL UNIQUE,
    thumbnail_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_videos_model_id ON videos(model_id);
CREATE INDEX IF NOT EXISTS idx_videos_video_url ON videos(video_url);

-- Adicionar trigger
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE videos IS 'Tabela de vídeos das modelos do site nsfw247.to';
