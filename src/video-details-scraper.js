import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function updateVideoDetails(videoId, posterUrl, videoSourceUrl) {
    try {
        await pool.query(
            'UPDATE videos SET poster_url = $1, video_source_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [posterUrl, videoSourceUrl, videoId]
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
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const videoDetails = await page.evaluate(() => {
            let posterUrl = null;
            let videoSourceUrl = null;
            let debugInfo = [];
            
            // Tentar múltiplos seletores para o vídeo
            const videoSelectors = [
                'video.js-fluid-player',
                'video#player',
                'video',
                'iframe[src*="player"]'
            ];
            
            let videoElement = null;
            for (const selector of videoSelectors) {
                videoElement = document.querySelector(selector);
                if (videoElement) {
                    debugInfo.push(`Vídeo encontrado com: ${selector}`);
                    break;
                }
            }
            
            if (!videoElement) {
                debugInfo.push('Nenhum elemento de vídeo encontrado');
                return { posterUrl, videoSourceUrl, debugInfo };
            }
            
            // Buscar poster
            posterUrl = videoElement.getAttribute('poster') || 
                       videoElement.getAttribute('data-poster') ||
                       videoElement.dataset?.poster;
            
            if (posterUrl) {
                debugInfo.push(`Poster encontrado: ${posterUrl}`);
            }
            
            // Buscar video source - múltiplas estratégias
            // 1. Source element
            let sourceElement = videoElement.querySelector('source');
            if (sourceElement) {
                videoSourceUrl = sourceElement.getAttribute('src');
                debugInfo.push(`Source encontrado via element: ${videoSourceUrl}`);
            }
            
            // 2. Atributo src do vídeo
            if (!videoSourceUrl) {
                videoSourceUrl = videoElement.getAttribute('src');
                if (videoSourceUrl) {
                    debugInfo.push(`Source encontrado via src: ${videoSourceUrl}`);
                }
            }
            
            // 3. Data attributes
            if (!videoSourceUrl) {
                const dataSetup = videoElement.getAttribute('data-setup');
                if (dataSetup) {
                    try {
                        const setup = JSON.parse(dataSetup);
                        if (setup.sources && setup.sources[0]) {
                            videoSourceUrl = setup.sources[0].src;
                            debugInfo.push(`Source encontrado via data-setup: ${videoSourceUrl}`);
                        }
                    } catch (e) {
                        debugInfo.push('Erro ao parsear data-setup');
                    }
                }
            }
            
            // 4. Buscar em scripts da página
            if (!videoSourceUrl) {
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const script of scripts) {
                    const content = script.textContent || script.innerHTML;
                    const m3u8Match = content.match(/https?:\/\/[^"'\s]+\.m3u8/);
                    const mp4Match = content.match(/https?:\/\/[^"'\s]+\.mp4/);
                    if (m3u8Match) {
                        videoSourceUrl = m3u8Match[0];
                        debugInfo.push(`Source M3U8 encontrado via script: ${videoSourceUrl}`);
                        break;
                    } else if (mp4Match) {
                        videoSourceUrl = mp4Match[0];
                        debugInfo.push(`Source MP4 encontrado via script: ${videoSourceUrl}`);
                        break;
                    }
                }
            }
            
            // Normalizar URLs
            if (posterUrl && !posterUrl.startsWith('http')) {
                posterUrl = posterUrl.startsWith('/') ? `https://nsfwpics.co${posterUrl}` : `https://nsfwpics.co/${posterUrl}`;
            }
            
            if (videoSourceUrl && !videoSourceUrl.startsWith('http')) {
                videoSourceUrl = videoSourceUrl.startsWith('/') ? `https://nsfwclips.co${videoSourceUrl}` : `https://nsfwclips.co/${videoSourceUrl}`;
            }
            
            return {
                posterUrl,
                videoSourceUrl,
                debugInfo
            };
        });
        
        // Mostrar debug info
        if (videoDetails.debugInfo && videoDetails.debugInfo.length > 0) {
            console.log('🔍 Debug:', videoDetails.debugInfo.join(' | '));
        }
        
        if (videoDetails.posterUrl) {
            console.log(`✓ Poster URL: ${videoDetails.posterUrl}`);
        } else {
            console.log('✗ Poster não encontrado');
        }
        
        if (videoDetails.videoSourceUrl) {
            console.log(`✓ Source URL: ${videoDetails.videoSourceUrl}`);
        } else {
            console.log('✗ Source não encontrado');
        }
        
        // Atualizar no banco de dados
        const updated = await updateVideoDetails(videoId, videoDetails.posterUrl, videoDetails.videoSourceUrl);
        
        if (updated) {
            console.log('✅ Detalhes salvos no banco de dados');
        } else {
            console.log('❌ Erro ao salvar no banco de dados');
        }
        
        await browser.close();
        
        return {
            success: true,
            posterUrl: videoDetails.posterUrl,
            videoSourceUrl: videoDetails.videoSourceUrl
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
        console.log('\n🎯 Iniciando scraping de detalhes dos vídeos...\n');
        
        // Buscar vídeos que ainda não têm poster ou source
        const result = await pool.query(`
            SELECT id, title, video_url 
            FROM videos 
            WHERE poster_url IS NULL OR video_source_url IS NULL
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
                
                // Delay entre requisições
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
        console.log('📊 RESUMO DO SCRAPING DE DETALHES');
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

// Verificar se foi passado um ID específico de vídeo
const videoId = process.argv[2];

if (videoId) {
    // Scraping de um vídeo específico
    pool.query('SELECT id, title, video_url FROM videos WHERE id = $1', [videoId])
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
    // Scraping de todos os vídeos
    scrapeAllVideosDetails();
}
