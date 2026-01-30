import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function scrapeDetails() {
    console.log('\n🚀 Iniciando scraper de detalhes do NSFW247...\n');
    
    const result = await pool.query(
        'SELECT id, title, video_url FROM nsfw247_videos WHERE poster_url IS NULL OR m3u8_url IS NULL ORDER BY id'
    );
    const videos = result.rows;
    
    console.log(`📊 Total de vídeos sem detalhes: ${videos.length}\n`);
    
    if (videos.length === 0) {
        console.log('✅ Todos os vídeos já possuem detalhes!\n');
        await pool.end();
        return;
    }
    
    let browser;
    let updatedCount = 0;
    
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
        
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            console.log(`\n[${i + 1}/${videos.length}] ${video.title}`);
            console.log(`🔗 URL: ${video.video_url}`);
            
            try {
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1920, height: 1080 });
                
                await page.goto(video.video_url, {
                    waitUntil: 'networkidle2',
                    timeout: 60000
                });
                
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const details = await page.evaluate(() => {
                    let posterUrl = null;
                    let m3u8Url = null;
                    
                    const videoElement = document.querySelector('video');
                    if (videoElement) {
                        posterUrl = videoElement.getAttribute('poster');
                        
                        const sourceElement = videoElement.querySelector('source');
                        if (sourceElement) {
                            m3u8Url = sourceElement.getAttribute('src');
                        }
                    }
                    
                    const scripts = document.querySelectorAll('script');
                    scripts.forEach(script => {
                        const content = script.textContent;
                        
                        if (!posterUrl && content.includes('poster')) {
                            const posterMatch = content.match(/poster['":\s]+['"]([^'"]+)['"]/);
                            if (posterMatch) posterUrl = posterMatch[1];
                        }
                        
                        if (!m3u8Url && content.includes('.m3u8')) {
                            const m3u8Match = content.match(/['"]([^'"]*\.m3u8[^'"]*)['"]/);
                            if (m3u8Match) m3u8Url = m3u8Match[1];
                        }
                    });
                    
                    return {
                        posterUrl: posterUrl && posterUrl.startsWith('http') ? posterUrl : (posterUrl ? `https://nsfw247.to${posterUrl}` : null),
                        m3u8Url: m3u8Url && m3u8Url.startsWith('http') ? m3u8Url : (m3u8Url ? `https://nsfw247.to${m3u8Url}` : null)
                    };
                });
                
                if (details.posterUrl || details.m3u8Url) {
                    await pool.query(
                        'UPDATE nsfw247_videos SET poster_url = $1, m3u8_url = $2 WHERE id = $3',
                        [details.posterUrl, details.m3u8Url, video.id]
                    );
                    
                    console.log(`✅ Detalhes atualizados`);
                    if (details.posterUrl) console.log(`   📸 Poster: ${details.posterUrl}`);
                    if (details.m3u8Url) console.log(`   🎬 Source: ${details.m3u8Url}`);
                    
                    updatedCount++;
                } else {
                    console.log(`⚠️  Nenhum detalhe encontrado`);
                }
                
                await page.close();
                
                if (i < videos.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar vídeo:`, error.message);
            }
        }
        
        await browser.close();
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DO SCRAPING - NSFW247 DETALHES');
        console.log('='.repeat(60));
        console.log(`Total de vídeos atualizados: ${updatedCount}`);
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

scrapeDetails();
