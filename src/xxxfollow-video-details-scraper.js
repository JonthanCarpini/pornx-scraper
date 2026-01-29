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

async function updateVideoSource(videoId, sourceUrl) {
    try {
        const query = `
            UPDATE xxxfollow_videos
            SET video_url = $1
            WHERE id = $2
        `;
        
        await pool.query(query, [sourceUrl, videoId]);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao atualizar vídeo ${videoId}:`, error.message);
        return false;
    }
}

async function extractVideoSource(page, videoUrl) {
    try {
        await page.goto(videoUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extrair source do vídeo
        const videoSource = await page.evaluate(() => {
            const videoElement = document.querySelector('.index-module__video--pbzTA');
            if (videoElement) {
                return videoElement.getAttribute('src');
            }
            
            // Tentar outros seletores
            const videoTag = document.querySelector('video[src]');
            if (videoTag) {
                return videoTag.getAttribute('src');
            }
            
            return null;
        });
        
        return videoSource;
    } catch (error) {
        console.error(`❌ Erro ao extrair source:`, error.message);
        return null;
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
                const sourceUrl = await extractVideoSource(page, video.video_url);
                
                if (sourceUrl) {
                    const updated = await updateVideoSource(video.id, sourceUrl);
                    if (updated) {
                        successCount++;
                        console.log(`  ✓ Source atualizado: ${sourceUrl.substring(0, 60)}...`);
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
