import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function getVideosWithoutSource() {
    try {
        const query = `
            SELECT v.id, v.video_url, v.title, m.username
            FROM xxxfollow_videos v
            JOIN xxxfollow_models m ON v.model_id = m.id
            WHERE v.video_url LIKE '%xxxfollow.com/%'
            AND v.video_url NOT LIKE '%.mp4'
            ORDER BY v.id ASC
            LIMIT 100
        `;
        
        const result = await pool.query(query);
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

async function extractVideoDetails(page, videoUrl) {
    try {
        // Extrair ID do post da URL (ex: /emmafiore10/522921-una-chupadita -> 522921)
        const postIdMatch = videoUrl.match(/\/(\d+)-/);
        const postId = postIdMatch ? postIdMatch[1] : null;
        
        await page.goto(videoUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Aguardar o elemento de vídeo aparecer
        try {
            await page.waitForSelector('video', { timeout: 10000 });
        } catch (e) {
            console.log('  ⚠️  Timeout aguardando vídeo');
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Extrair source do vídeo e poster
        const videoDetails = await page.evaluate((postId) => {
            let videoSource = null;
            let posterUrl = null;
            
            // Tentar múltiplos seletores para o vídeo
            const videoSelectors = [
                '#svp_player_a',
                'video.index-module__video--pbzTA',
                'video[src]',
                'video'
            ];
            
            for (const selector of videoSelectors) {
                const videoElement = document.querySelector(selector);
                if (videoElement) {
                    // Tentar pegar src como propriedade ou atributo
                    videoSource = videoElement.src || 
                                 videoElement.getAttribute('src') || 
                                 videoElement.currentSrc;
                    if (videoSource) break;
                }
            }
            
            // Se não encontrou o source dinamicamente, construir a partir do postId
            if (!videoSource && postId) {
                // Tentar encontrar o caminho base no HTML
                const imgElements = document.querySelectorAll('img[src*="post_public"]');
                let basePath = null;
                
                for (const img of imgElements) {
                    const src = img.src || img.getAttribute('src');
                    if (src && src.includes('post_public')) {
                        // Extrair: https://www.xxxfollow.com/media/fans/post_public/3663/36633397/
                        const match = src.match(/(.*post_public\/\d+\/\d+\/)/);
                        if (match) {
                            basePath = match[1];
                            break;
                        }
                    }
                }
                
                // Construir URLs de vídeo com diferentes qualidades
                if (basePath) {
                    const qualities = ['_fhd.mp4', '_hd.mp4', '_sd.mp4', '.mp4'];
                    for (const quality of qualities) {
                        videoSource = basePath + postId + quality;
                        break; // Usar a primeira (fhd)
                    }
                }
            }
            
            // Extrair poster (_start.webp)
            const posterSelectors = [
                'img.index-module__videoPoster--AiD_2',
                'img[alt="video poster"]',
                '.index-module__resizerPoster--SGlrk img',
                '.index-module__videoResizer--jSsQk img'
            ];
            
            for (const selector of posterSelectors) {
                const posterElement = document.querySelector(selector);
                if (posterElement) {
                    posterUrl = posterElement.src || 
                               posterElement.getAttribute('src') || 
                               posterElement.currentSrc;
                    if (posterUrl && posterUrl.includes('_start.webp')) break;
                }
            }
            
            return { videoSource, posterUrl };
        }, postId);
        
        return videoDetails;
    } catch (error) {
        console.error(`❌ Erro ao extrair detalhes:`, error.message);
        return { videoSource: null, posterUrl: null };
    }
}

async function scrapeVideoDetails() {
    let browser;
    
    try {
        console.log('\n🚀 Iniciando scraping de detalhes dos vídeos do XXXFollow...\n');
        
        const videos = await getVideosWithoutSource();
        
        if (videos.length === 0) {
            console.log('✅ Todos os vídeos já possuem source MP4!\n');
            return;
        }
        
        console.log(`📊 Vídeos pendentes: ${videos.length}\n`);
        
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            
            console.log(`[${i + 1}/${videos.length}] 🎬 ${video.username}: ${video.title?.substring(0, 40) || 'Sem título'}...`);
            console.log(`  🔗 URL: ${video.video_url}`);
            
            try {
                const details = await extractVideoDetails(page, video.video_url);
                
                if (details.videoSource) {
                    const updated = await updateVideoSource(video.id, details.videoSource, details.posterUrl);
                    if (updated) {
                        successCount++;
                        console.log(`  ✓ Source: ${details.videoSource.substring(0, 50)}...`);
                        if (details.posterUrl) {
                            console.log(`  ✓ Poster: ${details.posterUrl.substring(0, 50)}...`);
                        }
                    } else {
                        errorCount++;
                        console.log(`  ❌ Erro ao atualizar no banco`);
                    }
                } else {
                    errorCount++;
                    console.log(`  ⚠️  Source não encontrado`);
                }
                
                await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                
            } catch (error) {
                errorCount++;
                console.error(`  ❌ Erro: ${error.message}`);
            }
            
            console.log('');
        }
        
        await browser.close();
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING - XXXFOLLOW VIDEO DETAILS');
        console.log('============================================================');
        console.log(`Vídeos processados: ${videos.length}`);
        console.log(`Sources atualizados: ${successCount}`);
        console.log(`Erros: ${errorCount}`);
        console.log('============================================================\n');
        
        console.log('✅ Scraping de detalhes concluído!\n');
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        if (browser) {
            await browser.close();
        }
    } finally {
        process.exit(0);
    }
}

scrapeVideoDetails();
