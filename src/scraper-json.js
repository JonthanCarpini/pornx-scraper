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
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const browserPage = await browser.newPage();
        
        await browserPage.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        
        const url = page > 1 ? `${SCRAPE_URL}&page=${page}` : SCRAPE_URL;
        console.log(`📄 Acessando: ${url}`);
        
        await browserPage.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        await browserPage.waitForSelector('.item_thumb.thumb--models', { timeout: 10000 });
        
        const models = await browserPage.evaluate(() => {
            const modelElements = document.querySelectorAll('.item_thumb.thumb--models');
            const results = [];
            
            modelElements.forEach(element => {
                const linkElement = element.querySelector('a[href*="/models/"]');
                const titleAttr = linkElement?.getAttribute('title');
                const profileUrl = linkElement?.getAttribute('href');
                
                const imgElement = element.querySelector('.img-holder img');
                const coverUrl = imgElement?.getAttribute('data-src') || 
                               imgElement?.getAttribute('src') || 
                               imgElement?.getAttribute('data-webp');
                
                const videoIcon = element.querySelector('.icon-camera-shape-10');
                const photoIcon = element.querySelector('.icon-photo-shape-8');
                
                let videoCount = 0;
                let photoCount = 0;
                
                if (videoIcon) {
                    const videoText = videoIcon.parentElement?.nextSibling?.textContent?.trim();
                    videoCount = parseInt(videoText) || 0;
                }
                
                if (photoIcon) {
                    const photoText = photoIcon.parentElement?.nextSibling?.textContent?.trim();
                    photoCount = parseInt(photoText) || 0;
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
        });
        
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
