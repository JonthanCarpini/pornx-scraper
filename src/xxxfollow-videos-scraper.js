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
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extrair JSON do __NEXT_DATA__
        const pageData = await page.evaluate(() => {
            const scriptTag = document.getElementById('__NEXT_DATA__');
            if (!scriptTag) return null;
            
            try {
                return JSON.parse(scriptTag.textContent);
            } catch (e) {
                return null;
            }
        });
        
        if (!pageData || !pageData.props || !pageData.props.pageProps) {
            console.log('⚠️  Nenhum dado encontrado');
            await browser.close();
            return { success: false, videosFound: 0, videosSaved: 0 };
        }
        
        const props = pageData.props.pageProps;
        const postsKey = `user-${username}-posts`;
        const posts = props[postsKey] || [];
        
        console.log(`📊 Posts encontrados: ${posts.length}`);
        
        let savedCount = 0;
        let skippedCount = 0;
        
        for (const postData of posts) {
            const post = postData.post;
            
            if (!post.media || post.media.length === 0) continue;
            
            for (const media of post.media) {
                if (media.type !== 'video') continue;
                
                const videoData = {
                    modelId: modelId,
                    postId: post.id,
                    mediaId: media.id,
                    title: post.text ? post.text.substring(0, 255) : null,
                    description: post.text,
                    videoUrl: media.url,
                    sdUrl: media.sd_url || null,
                    thumbnailUrl: media.thumb_url || media.thumb_webp_url || null,
                    posterUrl: media.start_url || media.start_webp_url || null,
                    duration: media.duration_in_second || 0,
                    width: media.width || 0,
                    height: media.height || 0,
                    likeCount: postData.like_count || 0,
                    viewCount: postData.view_count || 0,
                    commentCount: postData.comment_count || 0,
                    hasAudio: media.has_audio !== false,
                    postedAt: post.created_at
                };
                
                const result = await saveVideo(videoData);
                if (result.isNew) {
                    savedCount++;
                    console.log(`  ✓ Vídeo salvo (ID: ${media.id})`);
                } else {
                    skippedCount++;
                }
            }
        }
        
        // Marcar como scraped
        await pool.query(
            'UPDATE xxxfollow_models SET videos_scraped = TRUE, videos_scraped_at = CURRENT_TIMESTAMP WHERE id = $1',
            [modelId]
        );
        
        console.log(`\n✅ Scraping concluído: ${savedCount} novos, ${skippedCount} duplicados, ${posts.length} posts`);
        
        await browser.close();
        
        return {
            success: true,
            videosFound: posts.length,
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
