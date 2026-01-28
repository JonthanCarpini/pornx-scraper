import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function updateVideoDetails(videoId, posterUrl, m3u8Url) {
    try {
        await pool.query(
            'UPDATE clubeadulto_videos SET poster_url = $1, m3u8_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [posterUrl, m3u8Url, videoId]
        );
        return true;
    } catch (error) {
        console.error('Erro ao atualizar detalhes do vídeo:', error.message);
        return false;
    }
}

async function scrapeVideoDetails(videoId, videoTitle, videoUrl) {
    let browser;
    
    try {
        console.log(`\n🎬 Scraping detalhes: ${videoTitle}`);
        console.log(`📄 URL: ${videoUrl}`);
        
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
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });
        
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(videoUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const videoDetails = await page.evaluate(() => {
            let posterUrl = null;
            let m3u8Url = null;
            
            const videoElement = document.querySelector('video#player');
            
            if (videoElement) {
                posterUrl = videoElement.getAttribute('poster');
                
                const sourceElement = videoElement.querySelector('source[type="video/m3u8"]');
                if (sourceElement) {
                    m3u8Url = sourceElement.getAttribute('src');
                }
                
                if (!m3u8Url) {
                    const dataSrc = videoElement.getAttribute('data-post-id');
                    const dataVttUrl = videoElement.getAttribute('data-vtt-url');
                    if (dataVttUrl) {
                        const baseUrl = dataVttUrl.substring(0, dataVttUrl.lastIndexOf('/'));
                        m3u8Url = `${baseUrl}/hls.m3u8`;
                    }
                }
            }
            
            if (posterUrl && !posterUrl.startsWith('http')) {
                posterUrl = posterUrl.startsWith('/') ? `https://clubeadulto.net${posterUrl}` : `https://clubeadulto.net/${posterUrl}`;
            }
            
            if (m3u8Url && !m3u8Url.startsWith('http')) {
                m3u8Url = m3u8Url.startsWith('/') ? `https://cdn2.foxvideo.club${m3u8Url}` : `https://cdn2.foxvideo.club/${m3u8Url}`;
            }
            
            return {
                posterUrl,
                m3u8Url
            };
        });
        
        if (videoDetails.posterUrl) {
            console.log(`✓ Poster URL: ${videoDetails.posterUrl}`);
        } else {
            console.log('✗ Poster não encontrado');
        }
        
        if (videoDetails.m3u8Url) {
            console.log(`✓ M3U8 URL: ${videoDetails.m3u8Url}`);
        } else {
            console.log('✗ M3U8 não encontrado');
        }
        
        const updated = await updateVideoDetails(videoId, videoDetails.posterUrl, videoDetails.m3u8Url);
        
        if (updated) {
            console.log('✅ Detalhes salvos no banco de dados');
        } else {
            console.log('❌ Erro ao salvar no banco de dados');
        }
        
        await browser.close();
        
        return {
            success: true,
            posterUrl: videoDetails.posterUrl,
            m3u8Url: videoDetails.m3u8Url
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

async function scrapeAllVideosDetails() {
    try {
        console.log('\n🎯 Iniciando scraping de detalhes dos vídeos do Clube Adulto...\n');
        
        const result = await pool.query(`
            SELECT id, title, video_url 
            FROM clubeadulto_videos 
            WHERE poster_url IS NULL OR m3u8_url IS NULL
            ORDER BY id
        `);
        const videos = result.rows;
        
        console.log(`📊 Total de vídeos para processar: ${videos.length}\n`);
        
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        
        for (const video of videos) {
            try {
                processedCount++;
                console.log(`\n[${processedCount}/${videos.length}] Processando: ${video.title}`);
                
                const result = await scrapeVideoDetails(video.id, video.title, video.video_url);
                
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
                
                if (processedCount < videos.length) {
                    console.log(`⏳ Aguardando ${SCRAPE_DELAY}ms antes do próximo vídeo...`);
                    await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar ${video.title}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING DE DETALHES - CLUBE ADULTO');
        console.log('============================================================');
        console.log(`Vídeos processados: ${processedCount}/${videos.length}`);
        console.log(`Sucesso: ${successCount}`);
        console.log(`Erros: ${errorCount}`);
        console.log('============================================================\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    }
}

const videoId = process.argv[2];

if (videoId) {
    pool.query('SELECT id, title, video_url FROM clubeadulto_videos WHERE id = $1', [videoId])
        .then(result => {
            if (result.rows.length === 0) {
                console.error(`❌ Vídeo com ID ${videoId} não encontrado`);
                process.exit(1);
            }
            const video = result.rows[0];
            return scrapeVideoDetails(video.id, video.title, video.video_url);
        })
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Erro:', error.message);
            process.exit(1);
        });
} else {
    scrapeAllVideosDetails();
}
