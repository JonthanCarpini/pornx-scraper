-- Migration: Adicionar colunas de controle de etapas de scraping

-- Adicionar colunas de controle para NSFW247
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS videos_scraped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS videos_scraped_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS details_scraped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS details_scraped_at TIMESTAMP;

-- Adicionar colunas de controle para Clube Adulto
ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS videos_scraped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS videos_scraped_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS details_scraped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS details_scraped_at TIMESTAMP;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_models_videos_scraped ON models(videos_scraped);
CREATE INDEX IF NOT EXISTS idx_models_details_scraped ON models(details_scraped);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_videos_scraped ON clubeadulto_models(videos_scraped);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_details_scraped ON clubeadulto_models(details_scraped);

COMMENT ON COLUMN models.videos_scraped IS 'Indica se os vídeos desta modelo já foram coletados';
COMMENT ON COLUMN models.videos_scraped_at IS 'Data/hora da última coleta de vídeos';
COMMENT ON COLUMN models.details_scraped IS 'Indica se os detalhes dos vídeos já foram coletados';
COMMENT ON COLUMN models.details_scraped_at IS 'Data/hora da última coleta de detalhes';

COMMENT ON COLUMN clubeadulto_models.videos_scraped IS 'Indica se os vídeos desta modelo já foram coletados';
COMMENT ON COLUMN clubeadulto_models.videos_scraped_at IS 'Data/hora da última coleta de vídeos';
COMMENT ON COLUMN clubeadulto_models.details_scraped IS 'Indica se os detalhes dos vídeos já foram coletados';
COMMENT ON COLUMN clubeadulto_models.details_scraped_at IS 'Data/hora da última coleta de detalhes';
