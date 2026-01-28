-- Verificar vídeos do Clube Adulto salvos
SELECT 
    COUNT(*) as total_videos,
    COUNT(CASE WHEN poster_url IS NOT NULL THEN 1 END) as com_poster,
    COUNT(CASE WHEN m3u8_url IS NOT NULL THEN 1 END) as com_m3u8,
    COUNT(CASE WHEN poster_url IS NOT NULL AND m3u8_url IS NOT NULL THEN 1 END) as completos
FROM clubeadulto_videos;

-- Ver últimos 10 vídeos processados
SELECT 
    id,
    title,
    CASE 
        WHEN poster_url IS NOT NULL AND m3u8_url IS NOT NULL THEN '✅ Completo'
        WHEN poster_url IS NOT NULL THEN '⚠️ Só poster'
        WHEN m3u8_url IS NOT NULL THEN '⚠️ Só M3U8'
        ELSE '❌ Sem detalhes'
    END as status,
    created_at
FROM clubeadulto_videos
ORDER BY id DESC
LIMIT 10;
