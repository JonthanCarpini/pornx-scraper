-- Migration: Criar TRIGGERs para atualizar video_count automaticamente
-- Sempre que um vídeo for inserido ou deletado, o video_count da modelo é atualizado

-- ===== FUNÇÃO PARA ATUALIZAR VIDEO_COUNT =====
-- Esta função será chamada pelos triggers
CREATE OR REPLACE FUNCTION update_model_video_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for INSERT ou UPDATE, atualiza a modelo do NEW
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE xxxfollow_models 
        SET video_count = (
            SELECT COUNT(*) 
            FROM xxxfollow_videos 
            WHERE model_id = NEW.model_id
        )
        WHERE id = NEW.model_id;
        
        RETURN NEW;
    END IF;
    
    -- Se for DELETE, atualiza a modelo do OLD
    IF (TG_OP = 'DELETE') THEN
        UPDATE xxxfollow_models 
        SET video_count = (
            SELECT COUNT(*) 
            FROM xxxfollow_videos 
            WHERE model_id = OLD.model_id
        )
        WHERE id = OLD.model_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ===== TRIGGER PARA XXXFOLLOW_VIDEOS =====
DROP TRIGGER IF EXISTS trigger_update_xxxfollow_video_count ON xxxfollow_videos;
CREATE TRIGGER trigger_update_xxxfollow_video_count
    AFTER INSERT OR DELETE OR UPDATE OF model_id
    ON xxxfollow_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_model_video_count();

-- ===== FUNÇÃO PARA CLUBEADULTO =====
CREATE OR REPLACE FUNCTION update_clubeadulto_video_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE clubeadulto_models 
        SET video_count = (
            SELECT COUNT(*) 
            FROM clubeadulto_videos 
            WHERE model_id = NEW.model_id
        )
        WHERE id = NEW.model_id;
        RETURN NEW;
    END IF;
    
    IF (TG_OP = 'DELETE') THEN
        UPDATE clubeadulto_models 
        SET video_count = (
            SELECT COUNT(*) 
            FROM clubeadulto_videos 
            WHERE model_id = OLD.model_id
        )
        WHERE id = OLD.model_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ===== TRIGGER PARA CLUBEADULTO_VIDEOS =====
DROP TRIGGER IF EXISTS trigger_update_clubeadulto_video_count ON clubeadulto_videos;
CREATE TRIGGER trigger_update_clubeadulto_video_count
    AFTER INSERT OR DELETE OR UPDATE OF model_id
    ON clubeadulto_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_clubeadulto_video_count();

-- ===== FUNÇÃO PARA NSFW247 (MODELS/VIDEOS) =====
CREATE OR REPLACE FUNCTION update_nsfw247_video_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE models 
        SET video_count = (
            SELECT COUNT(*) 
            FROM videos 
            WHERE model_id = NEW.model_id
        )
        WHERE id = NEW.model_id;
        RETURN NEW;
    END IF;
    
    IF (TG_OP = 'DELETE') THEN
        UPDATE models 
        SET video_count = (
            SELECT COUNT(*) 
            FROM videos 
            WHERE model_id = OLD.model_id
        )
        WHERE id = OLD.model_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ===== TRIGGER PARA VIDEOS (NSFW247) =====
DROP TRIGGER IF EXISTS trigger_update_nsfw247_video_count ON videos;
CREATE TRIGGER trigger_update_nsfw247_video_count
    AFTER INSERT OR DELETE OR UPDATE OF model_id
    ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_nsfw247_video_count();

-- ===== ATUALIZAR TODOS OS VIDEO_COUNTS EXISTENTES =====
-- Atualizar XXXFollow
UPDATE xxxfollow_models m
SET video_count = (
    SELECT COUNT(*)
    FROM xxxfollow_videos v
    WHERE v.model_id = m.id
);

-- Atualizar Clube Adulto
UPDATE clubeadulto_models m
SET video_count = (
    SELECT COUNT(*)
    FROM clubeadulto_videos v
    WHERE v.model_id = m.id
);

-- Atualizar NSFW247
UPDATE models m
SET video_count = (
    SELECT COUNT(*)
    FROM videos v
    WHERE v.model_id = m.id
);

-- Verificar resultados
SELECT 
    'xxxfollow' as source,
    COUNT(*) as total_models,
    SUM(video_count) as total_videos
FROM xxxfollow_models
UNION ALL
SELECT 
    'clubeadulto' as source,
    COUNT(*) as total_models,
    SUM(video_count) as total_videos
FROM clubeadulto_models
UNION ALL
SELECT 
    'nsfw247' as source,
    COUNT(*) as total_models,
    SUM(video_count) as total_videos
FROM models;
