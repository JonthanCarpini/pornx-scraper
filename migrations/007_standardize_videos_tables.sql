-- Migration 007: Padronizar estrutura das tabelas de vídeos
-- Adicionar colunas faltantes para garantir compatibilidade entre todas as fontes

-- ===== CLUBEADULTO_VIDEOS =====
-- Verificar e adicionar colunas faltantes
DO $$ 
BEGIN
    -- Adicionar view_count se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clubeadulto_videos' AND column_name = 'view_count') THEN
        ALTER TABLE clubeadulto_videos ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;

    -- Adicionar like_count se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clubeadulto_videos' AND column_name = 'like_count') THEN
        ALTER TABLE clubeadulto_videos ADD COLUMN like_count INTEGER DEFAULT 0;
    END IF;

    -- Adicionar comment_count se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clubeadulto_videos' AND column_name = 'comment_count') THEN
        ALTER TABLE clubeadulto_videos ADD COLUMN comment_count INTEGER DEFAULT 0;
    END IF;

    -- Alterar duration para INTEGER se for VARCHAR
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'clubeadulto_videos' 
               AND column_name = 'duration' 
               AND data_type = 'character varying') THEN
        -- Criar nova coluna temporária
        ALTER TABLE clubeadulto_videos ADD COLUMN duration_temp INTEGER;
        
        -- Tentar converter valores existentes
        UPDATE clubeadulto_videos 
        SET duration_temp = CASE 
            WHEN duration ~ '^[0-9]+$' THEN duration::INTEGER 
            ELSE NULL 
        END;
        
        -- Remover coluna antiga e renomear nova
        ALTER TABLE clubeadulto_videos DROP COLUMN duration;
        ALTER TABLE clubeadulto_videos RENAME COLUMN duration_temp TO duration;
    END IF;
END $$;

-- ===== VIDEOS (NSFW247) =====
-- Verificar e adicionar colunas faltantes
DO $$ 
BEGIN
    -- Adicionar duration se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' AND column_name = 'duration') THEN
        ALTER TABLE videos ADD COLUMN duration INTEGER;
    END IF;

    -- Adicionar view_count se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' AND column_name = 'view_count') THEN
        ALTER TABLE videos ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;

    -- Adicionar like_count se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' AND column_name = 'like_count') THEN
        ALTER TABLE videos ADD COLUMN like_count INTEGER DEFAULT 0;
    END IF;

    -- Adicionar comment_count se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' AND column_name = 'comment_count') THEN
        ALTER TABLE videos ADD COLUMN comment_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- ===== XXXFOLLOW_VIDEOS =====
-- Já possui todas as colunas necessárias, apenas garantir defaults
DO $$ 
BEGIN
    -- Garantir que view_count tem default
    ALTER TABLE xxxfollow_videos ALTER COLUMN view_count SET DEFAULT 0;
    
    -- Garantir que like_count tem default
    ALTER TABLE xxxfollow_videos ALTER COLUMN like_count SET DEFAULT 0;
    
    -- Garantir que comment_count tem default
    ALTER TABLE xxxfollow_videos ALTER COLUMN comment_count SET DEFAULT 0;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_clubeadulto_videos_view_count ON clubeadulto_videos(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_view_count ON videos(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_videos_view_count ON xxxfollow_videos(view_count DESC);

-- Atualizar valores NULL para 0
UPDATE clubeadulto_videos SET view_count = 0 WHERE view_count IS NULL;
UPDATE clubeadulto_videos SET like_count = 0 WHERE like_count IS NULL;
UPDATE clubeadulto_videos SET comment_count = 0 WHERE comment_count IS NULL;

UPDATE videos SET view_count = 0 WHERE view_count IS NULL;
UPDATE videos SET like_count = 0 WHERE like_count IS NULL;
UPDATE videos SET comment_count = 0 WHERE comment_count IS NULL;

UPDATE xxxfollow_videos SET view_count = 0 WHERE view_count IS NULL;
UPDATE xxxfollow_videos SET like_count = 0 WHERE like_count IS NULL;
UPDATE xxxfollow_videos SET comment_count = 0 WHERE comment_count IS NULL;

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE 'Migration 007 concluída: Tabelas de vídeos padronizadas';
END $$;
