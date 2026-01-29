import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 1000;

async function saveVideo(videoData) {
    try {
        const checkQuery = 'SELECT id FROM xxxfollow_videos WHERE xxxfollow_post_id = $1 AND xxxfollow_media_id = $2';
        const checkResult = await pool.query(checkQuery, [videoData.postId, videoData.mediaId]);
        
        if (checkResult.rows.length > 0) {
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        const insertQuery = `
            INSERT INTO xxxfollow_videos (
                model_id, xxxfollow_post_id, xxxfollow_media_id,
                title, description, video_url, sd_url, thumbnail_url, poster_url,
                duration, width, height, like_count, view_count, comment_count,
                has_audio, posted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id;
        `;
        
        const values = [
            videoData.modelId,
            videoData.postId,
            videoData.mediaId,
            videoData.title,
            videoData.description,
            videoData.videoUrl,
            videoData.sdUrl,
            videoData.thumbnailUrl,
            videoData.posterUrl,
            videoData.duration,
            videoData.width,
            videoData.height,
            videoData.likeCount || 0,
            videoData.viewCount || 0,
            videoData.commentCount || 0,
            videoData.hasAudio,
            videoData.postedAt
        ];
        
        const result = await pool.query(insertQuery, values);
        return { id: result.rows[0].id, isNew: true };
    } catch (error) {
        if (error.code === '23505') {
            const checkResult = await pool.query('SELECT id FROM xxxfollow_videos WHERE xxxfollow_post_id = $1', [videoData.postId]);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        console.error(`  ❌ Erro ao salvar vídeo:`, error.message);
        return { id: null, isNew: false };
    }
}

async function fetchVideosFromAPI(modelId, username) {
    try {
        console.log(`\n🎬 Buscando vídeos via API: ${username}`);
        
        let allVideos = [];
        let beforeTime = null;
        let page = 1;
        const limit = 18;
        
        while (true) {
            let apiUrl = `https://www.xxxfollow.com/api/v1/user/${username}/post/public?limit=${limit}&sort_by=recent`;
            
            if (beforeTime) {
                apiUrl += `&before_time=${encodeURIComponent(beforeTime)}`;
            }
            
            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                console.log(`  ❌ API retornou status ${response.status}`);
                break;
            }
            
            const data = await response.json();
            
            console.log(`  📦 API retornou ${Array.isArray(data) ? data.length : 'erro'} itens (página ${page})`);
            
            if (!Array.isArray(data) || data.length === 0) {
                if (!Array.isArray(data)) {
                    console.log(`  ⚠️  Resposta não é array:`, JSON.stringify(data).substring(0, 200));
                }
                break;
            }
            
            // Processar apenas vídeos públicos com source disponível
            let videoCount = 0;
            let filteredReasons = { notVideo: 0, noSource: 0, locked: 0 };
            
            for (const item of data) {
                const post = item.post;
                const media = post?.media?.[0];
                
                // Ignorar se não for vídeo
                if (!media || media.type !== 'video') {
                    filteredReasons.notVideo++;
                    continue;
                }
                
                // Aceitar apenas vídeos gratuitos (access: "free")
                if (post.access !== 'free') {
                    filteredReasons.locked++;
                    continue;
                }
                
                // Buscar melhor source disponível (prioridade: UHD > FHD > SD > URL)
                const videoUrl = media.uhd_url || media.fhd_url || media.sd_url || media.url;
                
                // Debug: log primeiro vídeo de cada página
                if (videoCount === 0 && page === 1) {
                    console.log(`  🔍 DEBUG primeiro vídeo:`);
                    console.log(`     - access: ${post.access}`);
                    console.log(`     - uhd_url: ${media.uhd_url ? 'EXISTS' : 'NULL'}`);
                    console.log(`     - fhd_url: ${media.fhd_url ? 'EXISTS' : 'NULL'}`);
                    console.log(`     - sd_url: ${media.sd_url ? 'EXISTS' : 'NULL'}`);
                    console.log(`     - url: ${media.url ? 'EXISTS' : 'NULL'}`);
                    console.log(`     - videoUrl final: ${videoUrl ? 'EXISTS' : 'NULL'}`);
                }
                
                // Verificar se tem source válido (não pode ser null/undefined)
                if (!videoUrl) {
                    filteredReasons.noSource++;
                    continue;
                }
                
                videoCount++;
                
                allVideos.push({
                    modelId: modelId,
                    postId: post.id,
                    mediaId: media.id,
                    title: post.text || 'Sem título',
                    description: post.text || '',
                    videoUrl: videoUrl,
                    sdUrl: media.sd_url,
                    thumbnailUrl: media.thumb_webp_url || media.thumb_url,
                    posterUrl: media.start_webp_url || media.start_url,
                    duration: media.duration_in_second || 0,
                    width: media.width || 0,
                    height: media.height || 0,
                    likeCount: item.like_count || 0,
                    viewCount: item.view_count || 0,
                    commentCount: item.comment_count || 0,
                    hasAudio: media.has_audio || false,
                    postedAt: post.created_at
                });
            }
            
            console.log(`  📊 Página ${page}: ${videoCount} vídeos aceitos | Filtrados: ${filteredReasons.notVideo} não-vídeo, ${filteredReasons.noSource} sem source, ${filteredReasons.locked} bloqueados`);
            
            // Se retornou menos que o limite, não há mais páginas
            if (data.length < limit) {
                break;
            }
            
            // Pegar o created_at do último item para próxima página
            const lastItem = data[data.length - 1];
            beforeTime = lastItem.post?.created_at;
            
            if (!beforeTime) {
                break;
            }
            
            page++;
            
            // Delay entre requisições
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`  ✓ API retornou ${allVideos.length} vídeos públicos`);
        
        return allVideos;
    } catch (error) {
        console.error(`  ❌ Erro ao buscar API:`, error.message);
        return [];
    }
}

async function scrapeModelVideos(modelId, username) {
    try {
        const videos = await fetchVideosFromAPI(modelId, username);
        
        if (videos.length === 0) {
            console.log(`  ⚠️  Nenhum vídeo público encontrado`);
            await pool.query(
                'UPDATE xxxfollow_models SET videos_scraped = TRUE, videos_scraped_at = CURRENT_TIMESTAMP WHERE id = $1',
                [modelId]
            );
            return { success: true, videosFound: 0, videosSaved: 0 };
        }
        
        let savedCount = 0;
        let skippedCount = 0;
        
        for (const video of videos) {
            const result = await saveVideo(video);
            if (result.isNew) {
                savedCount++;
                console.log(`  ✓ ${video.title.substring(0, 50)}...`);
            } else {
                skippedCount++;
            }
        }
        
        // Marcar como scraped
        await pool.query(
            'UPDATE xxxfollow_models SET videos_scraped = TRUE, videos_scraped_at = CURRENT_TIMESTAMP WHERE id = $1',
            [modelId]
        );
        
        console.log(`  📊 Salvos: ${savedCount} novos, ${skippedCount} duplicados`);
        
        return {
            success: true,
            videosFound: videos.length,
            videosSaved: savedCount
        };
        
    } catch (error) {
        console.error('  ❌ Erro durante o scraping:', error.message);
        return {
            success: false,
            videosFound: 0,
            videosSaved: 0
        };
    }
}

async function scrapeAllModelsVideos() {
    try {
        console.log('\n🎯 Iniciando scraping de vídeos do XXXFollow via API...\n');
        
        const result = await pool.query(`
            SELECT id, username 
            FROM xxxfollow_models 
            WHERE videos_scraped IS NULL OR videos_scraped = false
            ORDER BY id
        `);
        const models = result.rows;
        
        console.log(`📊 Modelos pendentes: ${models.length}\n`);
        
        let processedCount = 0;
        let totalVideos = 0;
        
        for (const model of models) {
            try {
                processedCount++;
                console.log(`[${processedCount}/${models.length}] 👤 ${model.username}`);
                
                const result = await scrapeModelVideos(model.id, model.username);
                
                if (result.success) {
                    totalVideos += result.videosSaved;
                }
                
                await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                
            } catch (error) {
                console.error(`❌ Erro ao processar ${model.username}:`, error.message);
            }
        }
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING - XXXFOLLOW VIDEOS');
        console.log('============================================================');
        console.log(`Modelos processados: ${processedCount}`);
        console.log(`Total de vídeos salvos: ${totalVideos}`);
        console.log('============================================================\n');
        
        console.log('✅ Scraping de vídeos concluído!\n');
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
    } finally {
        process.exit(0);
    }
}

scrapeAllModelsVideos();
