import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_URL = process.env.SCRAPE_URL || 'https://pornx.tube/models/?by=model_viewed';
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function saveModel(modelData) {
    const query = `
        INSERT INTO models (name, profile_url, cover_url, video_count, photo_count)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (profile_url) 
        DO UPDATE SET 
            name = EXCLUDED.name,
            cover_url = EXCLUDED.cover_url,
            video_count = EXCLUDED.video_count,
            photo_count = EXCLUDED.photo_count,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id;
    `;
    
    const values = [
        modelData.name,
        modelData.profileUrl,
        modelData.coverUrl,
        modelData.videoCount,
        modelData.photoCount
    ];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0].id;
    } catch (error) {
        console.error('Erro ao salvar modelo:', modelData.name, error.message);
        throw error;
    }
}

async function scrapeModels(page = 1) {
    let browser;
    
    try {
        console.log(`\n🚀 Iniciando scraping da página ${page}...`);
        
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });
        
        const browserPage = await browser.newPage();
        
        await browserPage.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        
        await browserPage.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });
        
        await browserPage.setViewport({ width: 1920, height: 1080 });
        
        const url = page > 1 ? `${SCRAPE_URL}&page=${page}` : SCRAPE_URL;
        console.log(`📄 Acessando: ${url}`);
        
        await browserPage.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const selectors = [
            '.item.thumb.thumb--models',
            '.thumbs__list .item.thumb',
            'div.item.thumb',
            '.item_thumb.thumb--models'
        ];
        
        let foundSelector = null;
        for (const selector of selectors) {
            try {
                await browserPage.waitForSelector(selector, { timeout: 5000 });
                foundSelector = selector;
                console.log(`✓ Encontrado seletor: ${selector}`);
                break;
            } catch (e) {
                console.log(`⚠️  Seletor não encontrado: ${selector}`);
            }
        }
        
        if (!foundSelector) {
            throw new Error('Nenhum seletor de modelo encontrado na página');
        }
        
        const models = await browserPage.evaluate((selector) => {
            const modelElements = document.querySelectorAll(selector);
            const results = [];
            
            modelElements.forEach(element => {
                const linkElement = element.querySelector('a[href*="/models/"]');
                const titleAttr = linkElement?.getAttribute('title');
                const profileUrl = linkElement?.getAttribute('href');
                
                const imgElement = element.querySelector('.img-holder img');
                const coverUrl = imgElement?.getAttribute('data-src') || 
                               imgElement?.getAttribute('src') || 
                               imgElement?.getAttribute('data-webp');
                
                let videoCount = 0;
                let photoCount = 0;
                
                const positionThumb = element.querySelector('.position_thumb');
                if (positionThumb) {
                    const text = positionThumb.textContent || '';
                    const parts = text.split(/\s+/).filter(p => p.trim());
                    
                    for (let i = 0; i < parts.length; i++) {
                        const num = parseInt(parts[i]);
                        if (!isNaN(num)) {
                            if (videoCount === 0) {
                                videoCount = num;
                            } else if (photoCount === 0) {
                                photoCount = num;
                                break;
                            }
                        }
                    }
                }
                
                if (titleAttr && profileUrl) {
                    results.push({
                        name: titleAttr,
                        profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://pornx.tube${profileUrl}`,
                        coverUrl: coverUrl || null,
                        videoCount,
                        photoCount
                    });
                }
            });
            
            return results;
        }, foundSelector);
        
        console.log(`✓ Encontradas ${models.length} modelos na página ${page}`);
        
        let savedCount = 0;
        for (const model of models) {
            try {
                await saveModel(model);
                savedCount++;
                console.log(`  ✓ [${savedCount}/${models.length}] ${model.name} - ${model.videoCount} vídeos, ${model.photoCount} fotos`);
            } catch (error) {
                console.error(`  ✗ Erro ao salvar ${model.name}:`, error.message);
            }
        }
        
        console.log(`\n✅ Página ${page} concluída: ${savedCount}/${models.length} modelos salvas`);
        
        await browser.close();
        
        return {
            success: true,
            modelsFound: models.length,
            modelsSaved: savedCount
        };
        
    } catch (error) {
        console.error('❌ Erro durante o scraping:', error.message);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

async function scrapeAllPages(maxPages = 5) {
    console.log(`\n🎯 Iniciando scraping de até ${maxPages} páginas...\n`);
    
    let totalModels = 0;
    let totalSaved = 0;
    
    for (let page = 1; page <= maxPages; page++) {
        try {
            const result = await scrapeModels(page);
            totalModels += result.modelsFound;
            totalSaved += result.modelsSaved;
            
            if (result.modelsFound === 0) {
                console.log('\n⚠️  Nenhuma modelo encontrada. Finalizando scraping.');
                break;
            }
            
            if (page < maxPages) {
                console.log(`\n⏳ Aguardando ${SCRAPE_DELAY}ms antes da próxima página...\n`);
                await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
            }
            
        } catch (error) {
            console.error(`\n❌ Erro na página ${page}:`, error.message);
            break;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO SCRAPING');
    console.log('='.repeat(60));
    console.log(`Total de modelos encontradas: ${totalModels}`);
    console.log(`Total de modelos salvas: ${totalSaved}`);
    console.log('='.repeat(60) + '\n');
    
    await pool.end();
}

const maxPages = parseInt(process.argv[2]) || 5;
scrapeAllPages(maxPages);
