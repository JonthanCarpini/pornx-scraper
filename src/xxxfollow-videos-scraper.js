import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;
const BASE_URL = 'https://www.xxxfollow.com';

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

async function scrapeModelVideos(modelId, username) {
    let browser;
    
    try {
        console.log(`\n🎬 Scraping vídeos: ${username}`);
        console.log(`📄 URL: ${BASE_URL}/${username}`);
        
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
        
        await page.goto(`${BASE_URL}/${username}`, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento completo...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Extrair vídeos públicos do HTML (ignorar privados com cadeado)
        const videos = await page.evaluate(() => {
            const videoItems = document.querySelectorAll('.index-module__item--DUfg0');
            const foundVideos = [];
            
            videoItems.forEach(item => {
                // Verificar se é vídeo privado (tem botão subscribeFeed ou ícone de cadeado)
                const isPrivate = item.querySelector('.subscribeFeed') || 
                                 item.querySelector('svg.mt-0') ||
                                 item.textContent.includes('Subscribers only');
                
                if (isPrivate) return; // Ignorar vídeos privados
                
                // Buscar link do vídeo público
                const link = item.querySelector('a.index-module__itemHolder--MPzxF');
                if (!link) return;
                
                const href = link.getAttribute('href');
                const img = link.querySelector('img');
                
                if (!img || !href) return;
                
                const thumbnailUrl = img.getAttribute('src');
                const title = img.getAttribute('alt') || '';
                
                // Extrair duração (segundo span com aria-label="view")
                const durationSpan = item.querySelector('.index-module__start--RYOXV');
                const duration = durationSpan ? durationSpan.textContent.trim() : '00:00';
                
                // Extrair views (primeiro span com aria-label="view")
                const viewSpan = item.querySelector('.index-module__end--y2ADg');
                const viewText = viewSpan ? viewSpan.textContent.trim() : '0';
                const views = viewText.replace(/[^0-9.]/g, '');
                
                foundVideos.push({
                    videoUrl: href,
                    thumbnailUrl: thumbnailUrl,
                    title: title,
                    duration: duration,
                    views: views
                });
            });
            
            return foundVideos;
        });
        
        console.log(`📊 Vídeos públicos encontrados: ${videos.length}`);
        
        let savedCount = 0;
        let skippedCount = 0;
        
        for (const video of videos) {
            try {
                // Converter duração MM:SS para segundos
                const [mins, secs] = video.duration.split(':').map(n => parseInt(n) || 0);
                const durationSeconds = (mins * 60) + secs;
                
                // Extrair ID do post da URL
                const postIdMatch = video.videoUrl.match(/\/(\d+)-/);
                const postId = postIdMatch ? parseInt(postIdMatch[1]) : Math.floor(Math.random() * 1000000000);
                
                const videoData = {
                    modelId: modelId,
                    postId: postId,
                    mediaId: postId,
                    title: video.title || null,
                    description: video.title || null,
                    videoUrl: `${BASE_URL}${video.videoUrl}`, // URL da página do vídeo
                    sdUrl: null,
                    thumbnailUrl: video.thumbnailUrl,
                    posterUrl: video.thumbnailUrl,
                    duration: durationSeconds,
                    width: 0,
                    height: 0,
                    likeCount: 0,
                    viewCount: parseFloat(video.views) || 0,
                    commentCount: 0,
                    hasAudio: true,
                    postedAt: new Date().toISOString()
                };
                
                const result = await saveVideo(videoData);
                if (result.isNew) {
                    savedCount++;
                    console.log(`  ✓ Vídeo salvo: ${video.title.substring(0, 50)}...`);
                } else {
                    skippedCount++;
                }
                
            } catch (error) {
                console.error(`  ❌ Erro ao processar vídeo:`, error.message);
            }
        }
        
        // Marcar como scraped
        await pool.query(
            'UPDATE xxxfollow_models SET videos_scraped = TRUE, videos_scraped_at = CURRENT_TIMESTAMP WHERE id = $1',
            [modelId]
        );
        
        console.log(`\n✅ Scraping concluído: ${savedCount} novos, ${skippedCount} duplicados`);
        
        await browser.close();
        
        return {
            success: true,
            videosFound: videos.length,
            videosSaved: savedCount
        };
        
    } catch (error) {
        console.error('❌ Erro durante o scraping:', error.message);
        if (browser) {
            await browser.close();
        }
        return {
            success: false,
            videosFound: 0,
            videosSaved: 0
        };
    }
}

async function scrapeAllModelsVideos() {
    try {
        console.log('\n🎯 Iniciando scraping de vídeos do XXXFollow...\n');
        
        const result = await pool.query(`
            SELECT id, username 
            FROM xxxfollow_models 
            WHERE videos_scraped IS NULL OR videos_scraped = false
            ORDER BY id
        `);
        const models = result.rows;
        
        console.log(`📊 Modelos pendentes (sem vídeos coletados): ${models.length}\n`);
        
        let processedCount = 0;
        let totalVideos = 0;
        
        for (const model of models) {
            try {
                processedCount++;
                console.log(`\n[${processedCount}/${models.length}] Processando: ${model.username}`);
                
                const result = await scrapeModelVideos(model.id, model.username);
                
                if (result.success) {
                    totalVideos += result.videosSaved;
                }
                
                if (processedCount < models.length) {
                    console.log(`⏳ Aguardando ${SCRAPE_DELAY}ms antes da próxima modelo...`);
                    await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar ${model.username}:`, error.message);
            }
        }
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING DE VÍDEOS - XXXFOLLOW');
        console.log('============================================================');
        console.log(`Modelos processadas: ${processedCount}/${models.length}`);
        console.log(`Total de vídeos salvos: ${totalVideos}`);
        console.log('============================================================\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    }
}

const modelId = process.argv[2];

if (modelId) {
    pool.query('SELECT id, username FROM xxxfollow_models WHERE id = $1', [modelId])
        .then(result => {
            if (result.rows.length === 0) {
                console.error(`❌ Modelo com ID ${modelId} não encontrada`);
                process.exit(1);
            }
            const model = result.rows[0];
            return scrapeModelVideos(model.id, model.username);
        })
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Erro:', error.message);
            process.exit(1);
        });
} else {
    scrapeAllModelsVideos();
}
