import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function updateModelVideoCount(modelId, count) {
    try {
        await pool.query(
            'UPDATE clubeadulto_models SET video_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [count, modelId]
        );
    } catch (error) {
        console.error('Erro ao atualizar contagem de vídeos:', error.message);
    }
}

async function saveVideo(videoData) {
    try {
        const checkQuery = 'SELECT id FROM clubeadulto_videos WHERE video_url = $1';
        const checkResult = await pool.query(checkQuery, [videoData.videoUrl]);
        
        if (checkResult.rows.length > 0) {
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        const insertQuery = `
            INSERT INTO clubeadulto_videos (model_id, title, video_url, thumbnail_url, duration)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id;
        `;
        
        const values = [
            videoData.modelId,
            videoData.title,
            videoData.videoUrl,
            videoData.thumbnailUrl,
            videoData.duration
        ];
        
        const result = await pool.query(insertQuery, values);
        return { id: result.rows[0].id, isNew: true };
    } catch (error) {
        console.error('Erro ao salvar vídeo:', videoData.title, error.message);
        return { id: null, isNew: false };
    }
}

async function scrapeModelVideos(modelId, modelName, profileUrl) {
    let browser;
    
    try {
        console.log(`\n🎬 Scraping vídeos: ${modelName}`);
        console.log(`📄 URL: ${profileUrl}`);
        
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
        
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(profileUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const videos = await page.evaluate(() => {
            const results = [];
            const articles = document.querySelectorAll('article.thumb-block');
            
            articles.forEach(article => {
                const linkElement = article.querySelector('a[href*="clubeadulto.net"]');
                const titleElement = article.querySelector('header span');
                const imgElement = article.querySelector('img');
                const durationElement = article.querySelector('.duration');
                
                if (linkElement) {
                    const videoUrl = linkElement.getAttribute('href');
                    const title = titleElement?.textContent?.trim() || 'Sem título';
                    
                    let thumbnailUrl = null;
                    if (imgElement) {
                        thumbnailUrl = imgElement.getAttribute('src') || 
                                      imgElement.getAttribute('data-src') ||
                                      imgElement.getAttribute('srcset')?.split(' ')[0];
                    }
                    
                    const duration = durationElement?.textContent?.trim() || null;
                    
                    if (videoUrl) {
                        results.push({
                            title,
                            videoUrl: videoUrl.startsWith('http') ? videoUrl : `https://clubeadulto.net${videoUrl}`,
                            thumbnailUrl: thumbnailUrl && thumbnailUrl.startsWith('http') ? thumbnailUrl : (thumbnailUrl ? `https://clubeadulto.net${thumbnailUrl}` : null),
                            duration
                        });
                    }
                }
            });
            
            return results;
        });
        
        console.log(`📊 Vídeos encontrados: ${videos.length}`);
        
        let savedCount = 0;
        
        for (const video of videos) {
            const result = await saveVideo({
                modelId,
                ...video
            });
            
            if (result.isNew) {
                savedCount++;
            }
        }
        
        await updateModelVideoCount(modelId, videos.length);
        
        console.log(`✅ ${savedCount} novos vídeos salvos`);
        
        await browser.close();
        
        return {
            success: true,
            videosFound: videos.length,
            videosSaved: savedCount
        };
        
    } catch (error) {
        console.error(`❌ Erro ao fazer scraping: ${error.message}`);
        if (browser) {
            await browser.close();
        }
        return {
            success: false,
            error: error.message
        };
    }
}

async function scrapeAllModelsVideos() {
    try {
        console.log('\n🎯 Iniciando scraping de vídeos do Clube Adulto...\n');
        
        const result = await pool.query(`
            SELECT id, name, profile_url 
            FROM clubeadulto_models 
            ORDER BY id
        `);
        const models = result.rows;
        
        console.log(`📊 Total de modelos para processar: ${models.length}\n`);
        
        let processedCount = 0;
        let totalVideos = 0;
        
        for (const model of models) {
            try {
                processedCount++;
                console.log(`\n[${processedCount}/${models.length}] Processando: ${model.name}`);
                
                const result = await scrapeModelVideos(model.id, model.name, model.profile_url);
                
                if (result.success) {
                    totalVideos += result.videosSaved;
                }
                
                if (processedCount < models.length) {
                    console.log(`⏳ Aguardando ${SCRAPE_DELAY}ms antes da próxima modelo...`);
                    await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar ${model.name}:`, error.message);
            }
        }
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING DE VÍDEOS - CLUBE ADULTO');
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
    pool.query('SELECT id, name, profile_url FROM clubeadulto_models WHERE id = $1', [modelId])
        .then(result => {
            if (result.rows.length === 0) {
                console.error(`❌ Modelo com ID ${modelId} não encontrada`);
                process.exit(1);
            }
            const model = result.rows[0];
            return scrapeModelVideos(model.id, model.name, model.profile_url);
        })
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Erro:', error.message);
            process.exit(1);
        });
} else {
    scrapeAllModelsVideos();
}
