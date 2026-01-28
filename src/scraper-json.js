import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRAPE_URL = process.env.SCRAPE_URL || 'https://pornx.tube/models/?by=model_viewed';
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

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
        
        const url = page === 1 
            ? SCRAPE_URL 
            : `https://pornx.tube/models/${page}/?by=model_viewed`;
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
            const html = await browserPage.content();
            fs.writeFileSync(path.join(__dirname, '..', 'debug-page.html'), html);
            console.log('❌ Nenhum seletor encontrado. HTML salvo em debug-page.html');
            throw new Error('Nenhum seletor de modelo encontrado na página');
        }
        
        const models = await browserPage.evaluate((selector) => {
            const modelElements = document.querySelectorAll(selector);
            const results = [];
            
            console.log('Total de elementos encontrados:', modelElements.length);
            
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
                    let fullProfileUrl = profileUrl.startsWith('http') ? profileUrl : `https://pornx.tube${profileUrl}`;
                    if (!fullProfileUrl.endsWith('/')) {
                        fullProfileUrl += '/';
                    }
                    fullProfileUrl += 'videos/?by=post_date';
                    
                    results.push({
                        name: titleAttr,
                        profileUrl: fullProfileUrl,
                        coverUrl: coverUrl || null,
                        videoCount,
                        photoCount
                    });
                }
            });
            
            return results;
        }, foundSelector);
        
        console.log(`✓ Encontradas ${models.length} modelos na página ${page}`);
        
        models.forEach((model, index) => {
            console.log(`  ✓ [${index + 1}/${models.length}] ${model.name} - ${model.videoCount} vídeos, ${model.photoCount} fotos`);
        });
        
        await browser.close();
        
        return models;
        
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
    
    let allModels = [];
    
    for (let page = 1; page <= maxPages; page++) {
        try {
            const models = await scrapeModels(page);
            allModels = [...allModels, ...models];
            
            if (models.length === 0) {
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
    
    const outputDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `models-${timestamp}.json`);
    
    const output = {
        scrapedAt: new Date().toISOString(),
        totalModels: allModels.length,
        models: allModels
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO SCRAPING');
    console.log('='.repeat(60));
    console.log(`Total de modelos encontradas: ${allModels.length}`);
    console.log(`Arquivo salvo em: ${outputFile}`);
    console.log('='.repeat(60) + '\n');
}

const maxPages = parseInt(process.argv[2]) || 5;
scrapeAllPages(maxPages);
