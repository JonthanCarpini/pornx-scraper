import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 1000;

async function getModelsWithPendingVideos() {
    try {
        const query = `
            SELECT DISTINCT m.id, m.username
            FROM xxxfollow_videos v
            JOIN xxxfollow_models m ON v.model_id = m.id
            WHERE v.video_url LIKE '%xxxfollow.com/%'
            AND v.video_url NOT LIKE '%.mp4'
            ORDER BY m.username
        `;
        
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error('❌ Erro ao buscar modelos:', error.message);
        return [];
    }
}

async function getVideosForModel(username) {
    try {
        const query = `
            SELECT v.id, v.video_url, v.title
            FROM xxxfollow_videos v
            JOIN xxxfollow_models m ON v.model_id = m.id
            WHERE m.username = $1
            AND v.video_url LIKE '%xxxfollow.com/%'
            AND v.video_url NOT LIKE '%.mp4'
            ORDER BY v.id ASC
        `;
        
        const result = await pool.query(query, [username]);
        return result.rows;
    } catch (error) {
        console.error('❌ Erro ao buscar vídeos:', error.message);
        return [];
    }
}

async function updateVideoSource(videoId, sourceUrl, posterUrl = null) {
    try {
        let query, params;
        
        if (posterUrl) {
            query = `
                UPDATE xxxfollow_videos
                SET video_url = $1, poster_url = $2, thumbnail_url = $2
                WHERE id = $3
            `;
            params = [sourceUrl, posterUrl, videoId];
        } else {
            query = `
                UPDATE xxxfollow_videos
                SET video_url = $1
                WHERE id = $2
            `;
            params = [sourceUrl, videoId];
        }
        
        await pool.query(query, params);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao atualizar vídeo ${videoId}:`, error.message);
        return false;
    }
}

async function fetchFromAPI(username) {
    try {
        const videoMap = new Map();
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
                throw new Error(`API retornou status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                break; // Não há mais dados
            }
            
            // Processar dados da página atual
            for (const item of data) {
                const postId = item.post?.id;
                const media = item.post?.media?.[0];
                
                if (postId && media && media.type === 'video') {
                    videoMap.set(postId.toString(), {
                        fhd_url: media.fhd_url,
                        sd_url: media.sd_url,
                        url: media.url,
                        start_webp_url: media.start_webp_url,
                        thumb_webp_url: media.thumb_webp_url
                    });
                }
            }
            
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
        
        return videoMap;
    } catch (error) {
        console.error(`❌ Erro ao buscar API:`, error.message);
        return new Map();
    }
}

async function scrapeVideoDetails() {
    try {
        console.log('\n🚀 Iniciando scraping de detalhes dos vídeos do XXXFollow via API...\n');
        
        const models = await getModelsWithPendingVideos();
        
        if (models.length === 0) {
            console.log('✅ Todos os vídeos já possuem source MP4!\n');
            return;
        }
        
        console.log(`📊 Modelos com vídeos pendentes: ${models.length}\n`);
        
        let totalProcessed = 0;
        let successCount = 0;
        let errorCount = 0;
        
        for (const model of models) {
            console.log(`\n👤 Processando modelo: ${model.username}`);
            
            // Buscar vídeos pendentes deste modelo
            const videos = await getVideosForModel(model.username);
            
            if (videos.length === 0) {
                console.log(`  ⚠️  Nenhum vídeo pendente`);
                continue;
            }
            
            console.log(`  📹 Vídeos pendentes: ${videos.length}`);
            
            // Buscar dados da API
            const videoMap = await fetchFromAPI(model.username);
            
            if (videoMap.size === 0) {
                console.log(`  ❌ Erro ao buscar API`);
                errorCount += videos.length;
                continue;
            }
            
            console.log(`  ✓ API retornou ${videoMap.size} vídeos\n`);
            
            // Processar cada vídeo
            for (const video of videos) {
                totalProcessed++;
                
                // Extrair postId da URL
                const postIdMatch = video.video_url.match(/\/(\d+)-/);
                const postId = postIdMatch ? postIdMatch[1] : null;
                
                if (!postId) {
                    console.log(`  [${totalProcessed}] ❌ ${video.title?.substring(0, 40)} - ID não encontrado na URL`);
                    errorCount++;
                    continue;
                }
                
                const videoData = videoMap.get(postId);
                
                if (!videoData) {
                    console.log(`  [${totalProcessed}] ⚠️  ${video.title?.substring(0, 40)} - Post ${postId} não encontrado na API`);
                    errorCount++;
                    continue;
                }
                
                // Escolher melhor qualidade disponível
                const videoSource = videoData.fhd_url || videoData.sd_url || videoData.url;
                const posterUrl = videoData.start_webp_url;
                
                if (!videoSource) {
                    console.log(`  [${totalProcessed}] ❌ ${video.title?.substring(0, 40)} - Source não disponível`);
                    errorCount++;
                    continue;
                }
                
                // Atualizar no banco
                const updated = await updateVideoSource(video.id, videoSource, posterUrl);
                
                if (updated) {
                    successCount++;
                    const quality = videoData.fhd_url ? 'FHD' : (videoData.sd_url ? 'SD' : 'STD');
                    console.log(`  [${totalProcessed}] ✓ ${video.title?.substring(0, 40)} (${quality})`);
                } else {
                    errorCount++;
                    console.log(`  [${totalProcessed}] ❌ ${video.title?.substring(0, 40)} - Erro ao atualizar banco`);
                }
            }
            
            // Delay entre modelos
            await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
        }
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING - XXXFOLLOW VIDEO DETAILS');
        console.log('============================================================');
        console.log(`Modelos processados: ${models.length}`);
        console.log(`Vídeos processados: ${totalProcessed}`);
        console.log(`Sources atualizados: ${successCount}`);
        console.log(`Erros: ${errorCount}`);
        console.log('============================================================\n');
        
        console.log('✅ Scraping de detalhes concluído!\n');
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
    } finally {
        process.exit(0);
    }
}

scrapeVideoDetails();
