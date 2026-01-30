-- Migration: Criar VIEWs unificadas para padronizar estrutura de modelos e vídeos
-- Isso permite que o frontend consuma dados de todas as fontes com uma estrutura consistente

-- ===== DROP VIEWs SE EXISTIREM =====
DROP VIEW IF EXISTS unified_videos CASCADE;
DROP VIEW IF EXISTS unified_models CASCADE;

-- ===== VIEW UNIFIED_MODELS =====
-- Padroniza a estrutura de modelos de todas as fontes
CREATE VIEW unified_models AS
SELECT 
    'xxxfollow' as source,
    id,
    username as name,
    CONCAT('https://xxxfollow.com/', username) as profile_url,
    avatar_url,
    cover_url as banner_url,
    bio,
    gender,
    follower_count,
    like_count,
    view_count,
    post_count,
    video_count,
    status,
    created_at,
    updated_at
FROM xxxfollow_models

UNION ALL

SELECT 
    'nsfw247' as source,
    id,
    name,
    profile_url,
    NULL as avatar_url,
    cover_url as banner_url,
    bio,
    gender,
    follower_count,
    like_count,
    view_count,
    post_count,
    video_count,
    status,
    created_at,
    updated_at
FROM models

UNION ALL

SELECT 
    'clubeadulto' as source,
    id,
    name,
    COALESCE(profile_url, url) as profile_url,
    image_url as avatar_url,
    cover_url as banner_url,
    bio,
    gender,
    follower_count,
    like_count,
    view_count,
    post_count,
    video_count,
    status,
    created_at,
    updated_at
FROM clubeadulto_models;

-- ===== VIEW UNIFIED_VIDEOS =====
-- Padroniza a estrutura de vídeos de todas as fontes
-- Campos normalizados:
--   - page_url: URL da página do vídeo (para abrir no site original)
--   - video_source_url: URL do arquivo de vídeo (MP4, M3U8, etc)
--   - sd_url: URL de qualidade SD (quando disponível)
CREATE VIEW unified_videos AS
SELECT 
    'xxxfollow' as source,
    v.id,
    v.model_id,
    m.username as model_name,
    m.avatar_url as model_avatar,
    v.title,
    v.description,
    v.video_url as page_url,           -- XXXFollow: video_url é o arquivo direto
    v.video_url as video_source_url,   -- Mesma URL para reprodução
    v.sd_url,
    v.thumbnail_url,
    v.poster_url,
    v.duration::text as duration,      -- Converter para texto para padronizar
    v.width,
    v.height,
    v.like_count,
    v.view_count,
    v.comment_count,
    v.has_audio,
    v.posted_at,
    v.status,
    v.created_at,
    v.updated_at
FROM xxxfollow_videos v
LEFT JOIN xxxfollow_models m ON v.model_id = m.id

UNION ALL

SELECT 
    'nsfw247' as source,
    v.id,
    v.model_id,
    m.name as model_name,
    NULL as model_avatar,
    v.title,
    NULL as description,
    v.video_url as page_url,                    -- NSFW247: video_url é a página
    v.video_source_url as video_source_url,     -- video_source_url é o arquivo
    NULL as sd_url,
    v.thumbnail_url,
    v.poster_url,
    NULL as duration,
    NULL as width,
    NULL as height,
    NULL as like_count,
    NULL as view_count,
    NULL as comment_count,
    NULL as has_audio,
    NULL as posted_at,
    v.status,
    v.created_at,
    v.updated_at
FROM videos v
LEFT JOIN models m ON v.model_id = m.id

UNION ALL

SELECT 
    'clubeadulto' as source,
    v.id,
    v.model_id,
    m.name as model_name,
    m.image_url as model_avatar,
    v.title,
    NULL as description,
    v.video_url as page_url,                                    -- Clube Adulto: video_url é a página
    COALESCE(v.m3u8_url, v.video_source_url) as video_source_url,  -- Preferir M3U8, fallback para video_source_url
    NULL as sd_url,
    v.thumbnail_url,
    v.poster_url,
    v.duration,
    NULL as width,
    NULL as height,
    NULL as like_count,
    NULL as view_count,
    NULL as comment_count,
    NULL as has_audio,
    NULL as posted_at,
    v.status,
    v.created_at,
    v.updated_at
FROM clubeadulto_videos v
LEFT JOIN clubeadulto_models m ON v.model_id = m.id;

-- ===== CRIAR ÍNDICES PARA PERFORMANCE =====
-- Nota: VIEWs não podem ter índices diretos, mas as tabelas base já têm índices adequados
-- Se necessário, podemos criar MATERIALIZED VIEWs no futuro para melhor performance

-- ===== COMENTÁRIOS =====
COMMENT ON VIEW unified_models IS 'VIEW unificada que padroniza a estrutura de modelos de todas as fontes (XXXFollow, NSFW247, Clube Adulto)';
COMMENT ON VIEW unified_videos IS 'VIEW unificada que padroniza a estrutura de vídeos de todas as fontes. page_url = URL da página, video_source_url = URL do arquivo de vídeo';
