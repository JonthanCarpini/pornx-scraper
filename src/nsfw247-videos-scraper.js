import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function scrapeVideos() {
    console.log('\n🚀 Iniciando scraper de vídeos do NSFW247...\n');
    
    const result = await pool.query('SELECT id, name, slug, profile_url FROM nsfw247_models ORDER BY id');
    const models = result.rows;
    
    console.log(`📊 Total de modelos: ${models.length}\n`);
    
    let browser;
    let totalVideos = 0;
    
    try {
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
        
        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            console.log(`\n[${i + 1}/${models.length}] Processando: ${model.name}`);
            console.log(`🔗 URL: ${model.profile_url}`);
            
            try {
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1920, height: 1080 });
                
                await page.goto(model.profile_url, {
                    waitUntil: 'networkidle2',
                    timeout: 60000
                });
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const videos = await page.evaluate(() => {
                    const results = [];
                    const videoElements = document.querySelectorAll('article.post');
                    
                    videoElements.forEach(article => {
                        const titleElement = article.querySelector('h2 a, .post-title a');
                        const linkElement = article.querySelector('a');
                        const imgElement = article.querySelector('img');
                        
                        if (!titleElement || !linkElement) return;
                        
                        const title = titleElement.textContent.trim();
                        const videoUrl = linkElement.getAttribute('href');
                        const thumbnailUrl = imgElement ? (
                            imgElement.getAttribute('src') ||
                            imgElement.getAttribute('data-src') ||
                            imgElement.getAttribute('data-lazy-src')
                        ) : null;
                        
                        if (title && videoUrl) {
                            results.push({
                                title,
                                videoUrl: videoUrl.startsWith('http') ? videoUrl : `https://nsfw247.to${videoUrl}`,
                                thumbnailUrl: thumbnailUrl && thumbnailUrl.startsWith('http') ? thumbnailUrl : (thumbnailUrl ? `https://nsfw247.to${thumbnailUrl}` : null)
                            });
                        }
                    });
                    
                    return results;
                });
                
                console.log(`📹 Vídeos encontrados: ${videos.length}`);
                
                let savedCount = 0;
                
                for (const video of videos) {
                    try {
                        const checkQuery = 'SELECT id FROM nsfw247_videos WHERE video_url = $1';
                        const checkResult = await pool.query(checkQuery, [video.videoUrl]);
                        
                        if (checkResult.rows.length === 0) {
                            const insertQuery = `
                                INSERT INTO nsfw247_videos (model_id, title, video_url, thumbnail_url)
                                VALUES ($1, $2, $3, $4)
                            `;
                            
                            await pool.query(insertQuery, [
                                model.id,
                                video.title,
                                video.videoUrl,
                                video.thumbnailUrl
                            ]);
                            
                            savedCount++;
                        }
                    } catch (error) {
                        console.error(`   ✗ Erro ao salvar vídeo: ${error.message}`);
                    }
                }
                
                await pool.query(
                    'UPDATE nsfw247_models SET video_count = $1 WHERE id = $2',
                    [videos.length, model.id]
                );
                
                console.log(`✅ ${savedCount} novos vídeos salvos`);
                totalVideos += savedCount;
                
                await page.close();
                
                if (i < models.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar ${model.name}:`, error.message);
            }
        }
        
        await browser.close();
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DO SCRAPING - NSFW247 VÍDEOS');
        console.log('='.repeat(60));
        console.log(`Total de vídeos salvos: ${totalVideos}`);
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('❌ Erro durante o scraping:', error.message);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
    
    await pool.end();
}

scrapeVideos();
