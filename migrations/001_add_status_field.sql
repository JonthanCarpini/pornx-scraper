-- Migration: Adicionar campo 'status' em todas as tabelas
-- Status possíveis: 'active', 'pending', 'suspended', 'error'

-- Adicionar status em clubeadulto_models
ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Adicionar status em clubeadulto_videos
ALTER TABLE clubeadulto_videos 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Adicionar status em models (NSFW247)
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Adicionar status em videos (NSFW247)
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Adicionar status em xxxfollow_models
ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Adicionar status em xxxfollow_videos
ALTER TABLE xxxfollow_videos 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Atualizar status para 'pending' em vídeos sem URL válida
UPDATE clubeadulto_videos 
SET status = 'pending' 
WHERE (video_url IS NULL OR video_url = '') 
  AND (m3u8_url IS NULL OR m3u8_url = '')
  AND (video_source_url IS NULL OR video_source_url = '');

UPDATE videos 
SET status = 'pending' 
WHERE (video_url IS NULL OR video_url = '') 
  AND (video_source_url IS NULL OR video_source_url = '');

UPDATE xxxfollow_videos 
SET status = 'pending' 
WHERE (video_url IS NULL OR video_url = '') 
  AND (sd_url IS NULL OR sd_url = '');

-- Atualizar status para 'pending' em modelos sem vídeos
UPDATE clubeadulto_models 
SET status = 'pending' 
WHERE video_count = 0 OR video_count IS NULL;

UPDATE models 
SET status = 'pending' 
WHERE video_count = 0 OR video_count IS NULL;

UPDATE xxxfollow_models 
SET status = 'pending' 
WHERE post_count = 0 OR post_count IS NULL;

-- Criar índices para melhorar performance nas consultas por status
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_status ON clubeadulto_models(status);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_videos_status ON clubeadulto_videos(status);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_models_status ON xxxfollow_models(status);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_videos_status ON xxxfollow_videos(status);
