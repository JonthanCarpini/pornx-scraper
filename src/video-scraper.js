import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function saveVideo(videoData) {
    try {
        // Verificar se já existe no banco
        const checkQuery = 'SELECT id FROM videos WHERE video_url = $1';
        const checkResult = await pool.query(checkQuery, [videoData.videoUrl]);
        
        if (checkResult.rows.length > 0) {
            console.log(`  ⏭️  Vídeo já existe (ID: ${checkResult.rows[0].id}): ${videoData.title}`);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        // Inserir novo vídeo
        const insertQuery = `
            INSERT INTO videos (model_id, title, video_url, thumbnail_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        
        const values = [
            videoData.modelId,
            videoData.title,
            videoData.videoUrl,
            videoData.thumbnailUrl
        ];
        
        const result = await pool.query(insertQuery, values);
        return { id: result.rows[0].id, isNew: true };
    } catch (error) {
        // Se for erro de UNIQUE constraint, o vídeo já existe
        if (error.code === '23505') {
            console.log(`  ⏭️  Vídeo duplicado (constraint): ${videoData.title}`);
            const checkResult = await pool.query('SELECT id FROM videos WHERE video_url = $1', [videoData.videoUrl]);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        console.error(`  ❌ Erro ao salvar vídeo "${videoData.title}":`, error.message);
        return { id: null, isNew: false };
    }
}

async function updateModelVideoCount(modelId, count) {
    try {
        await pool.query(
            'UPDATE models SET video_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [count, modelId]
        );
    } catch (error) {
        console.error('Erro ao atualizar contagem de vídeos:', error.message);
    }
}

async function scrapeModelVideos(modelId, modelName, profileUrl, forceRescrape = false) {
    let browser;
    
    try {
        // Verificar se já foi feito scraping dos vídeos
        if (!forceRescrape) {
            const checkResult = await pool.query(
                'SELECT videos_scraped, videos_scraped_at FROM models WHERE id = $1',
                [modelId]
            );
            
            if (checkResult.rows.length > 0 && checkResult.rows[0].videos_scraped) {
                const scrapedAt = checkResult.rows[0].videos_scraped_at;
                console.log(`\n⏭️  Pulando ${modelName} - vídeos já coletados em ${scrapedAt}`);
                return {
                    success: true,
                    skipped: true,
                    videosFound: 0,
                    videosSaved: 0
                };
            }
        }
        
        console.log(`\n🚀 Iniciando scraping de vídeos: ${modelName}`);
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
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });
        
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(profileUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Tentar encontrar os vídeos com diferentes seletores
        const selectors = [
            '.row.clearfix',
            'div.row.clearfix',
            '.col-sm-4'
        ];
        
        let foundSelector = null;
        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                foundSelector = selector;
                console.log(`✓ Encontrado seletor: ${selector}`);
                break;
            } catch (e) {
                console.log(`⚠️ Seletor não encontrado: ${selector}`);
            }
        }
        
        if (!foundSelector) {
            console.log('⚠️ Nenhum vídeo encontrado na página');
            await browser.close();
            return {
                success: true,
                videosFound: 0,
                videosSaved: 0
            };
        }
        
        const videos = await page.evaluate(() => {
            const videoElements = document.querySelectorAll('.col-sm-4');
            const results = [];
            
            videoElements.forEach(element => {
                // Buscar título e link do vídeo (no h3 a)
                const titleElement = element.querySelector('h3 a');
                const title = titleElement?.textContent?.trim();
                const videoUrl = titleElement?.getAttribute('href');
                
                // Buscar thumbnail
                const imgElement = element.querySelector('img');
                const thumbnailUrl = imgElement?.getAttribute('src') || 
                                   imgElement?.getAttribute('data-src') ||
                                   imgElement?.getAttribute('data-bttrlzyloading-md-src');
                
                if (title && videoUrl) {
                    const fullVideoUrl = videoUrl.startsWith('http') ? videoUrl : `https://nsfw247.to${videoUrl}`;
                    
                    results.push({
                        title: title,
                        videoUrl: fullVideoUrl,
                        thumbnailUrl: thumbnailUrl || null
                    });
                }
            });
            
            return results;
        });
        
        console.log(`✓ Encontrados ${videos.length} vídeos`);
        
        let savedCount = 0;
        let skippedCount = 0;
        
        for (const video of videos) {
            try {
                const result = await saveVideo({
                    modelId: modelId,
                    title: video.title,
                    videoUrl: video.videoUrl,
                    thumbnailUrl: video.thumbnailUrl
                });
                
                if (result.isNew) {
                    savedCount++;
                    console.log(`  ✓ [${savedCount}/${videos.length}] ${video.title}`);
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`  ✗ Erro ao salvar ${video.title}:`, error.message);
            }
        }
        
        // Atualizar contagem de vídeos na tabela models
        await updateModelVideoCount(modelId, videos.length);
        
        // Marcar etapa de vídeos como concluída
        await pool.query(
            'UPDATE models SET videos_scraped = TRUE, videos_scraped_at = CURRENT_TIMESTAMP WHERE id = $1',
            [modelId]
        );
        
        console.log(`\n✅ Scraping concluído: ${savedCount} novos, ${skippedCount} duplicados, ${videos.length} total`);
        
        await browser.close();
        
        return {
            success: true,
            skipped: false,
            videosFound: videos.length,
            videosSaved: savedCount
        };
        
    } catch (error) {
        console.error('❌ Erro durante o scraping:', error.message);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

async function scrapeAllModelsVideos() {
    try {
        console.log('\n🎯 Iniciando scraping de vídeos de todas as modelos...\n');
        
        // Buscar todas as modelos do banco
        const result = await pool.query('SELECT id, name, profile_url FROM models ORDER BY id');
        const models = result.rows;
        
        console.log(`📊 Total de modelos encontradas: ${models.length}\n`);
        
        let totalVideos = 0;
        let totalSaved = 0;
        let processedModels = 0;
        let skippedModels = 0;
        
        for (const model of models) {
            try {
                processedModels++;
                console.log(`\n[${processedModels}/${models.length}] Processando: ${model.name}`);
                
                const result = await scrapeModelVideos(model.id, model.name, model.profile_url);
                
                if (result.skipped) {
                    skippedModels++;
                } else {
                    totalVideos += result.videosFound;
                    totalSaved += result.videosSaved;
                }
                
                // Delay entre requisições
                if (processedModels < models.length) {
                    console.log(`⏳ Aguardando ${SCRAPE_DELAY}ms antes da próxima modelo...`);
                    await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar ${model.name}:`, error.message);
            }
        }
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING DE VÍDEOS');
        console.log('============================================================');
        console.log(`Modelos processadas: ${processedModels}/${models.length}`);
        console.log(`Modelos puladas (já coletadas): ${skippedModels}`);
        console.log(`Total de vídeos encontrados: ${totalVideos}`);
        console.log(`Total de vídeos salvos: ${totalSaved}`);
        console.log('============================================================\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    }
}

// Verificar se foi passado um ID específico de modelo
const modelId = process.argv[2];

if (modelId) {
    // Scraping de uma modelo específica
    pool.query('SELECT id, name, profile_url FROM models WHERE id = $1', [modelId])
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
    // Scraping de todas as modelos
    scrapeAllModelsVideos();
}
