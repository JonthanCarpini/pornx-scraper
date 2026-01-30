-- Migration: Padronizar campos nas tabelas de modelos
-- Adicionar campos: gender, bio, follower_count, like_count, view_count, post_count

-- ===== CLUBEADULTO_MODELS =====
-- Adicionar campos faltantes
ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;

ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS post_count INTEGER DEFAULT 0;

-- Garantir que video_count existe
ALTER TABLE clubeadulto_models 
ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0;


-- ===== MODELS (NSFW247) =====
-- Adicionar campos faltantes
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

ALTER TABLE models 
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE models 
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;

ALTER TABLE models 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

ALTER TABLE models 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

ALTER TABLE models 
ADD COLUMN IF NOT EXISTS post_count INTEGER DEFAULT 0;

-- Garantir que video_count existe (já deve existir)
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0;


-- ===== XXXFOLLOW_MODELS =====
-- Esta tabela já tem todos os campos, mas vamos garantir que existem
ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;

ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS post_count INTEGER DEFAULT 0;

-- Adicionar video_count se não existir (para padronização)
ALTER TABLE xxxfollow_models 
ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0;


-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_gender ON clubeadulto_models(gender);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_follower_count ON clubeadulto_models(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_like_count ON clubeadulto_models(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_view_count ON clubeadulto_models(view_count DESC);

CREATE INDEX IF NOT EXISTS idx_models_gender ON models(gender);
CREATE INDEX IF NOT EXISTS idx_models_follower_count ON models(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_models_like_count ON models(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_models_view_count ON models(view_count DESC);

-- xxxfollow_models já tem índices, mas vamos garantir
CREATE INDEX IF NOT EXISTS idx_xxxfollow_models_gender ON xxxfollow_models(gender);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_models_follower_count ON xxxfollow_models(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_models_like_count ON xxxfollow_models(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_models_view_count ON xxxfollow_models(view_count DESC);
