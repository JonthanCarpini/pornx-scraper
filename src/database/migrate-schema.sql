-- Migration: Remove video_count and photo_count columns
-- Executar este script para atualizar o banco de dados existente

ALTER TABLE models DROP COLUMN IF EXISTS video_count;
ALTER TABLE models DROP COLUMN IF EXISTS photo_count;

-- Atualizar comentário da tabela
COMMENT ON TABLE models IS 'Tabela de modelos do site nsfw247.to';
