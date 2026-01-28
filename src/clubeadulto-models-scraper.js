import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_URL = 'https://clubeadulto.net/actors/';
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function saveModel(modelData) {
    try {
        const checkQuery = 'SELECT id FROM clubeadulto_models WHERE profile_url = $1';
        const checkResult = await pool.query(checkQuery, [modelData.profileUrl]);
        
        if (checkResult.rows.length > 0) {
            console.log(`⚠️  Modelo já existe: ${modelData.name}`);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        const insertQuery = `
            INSERT INTO clubeadulto_models (name, slug, profile_url, cover_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        
        const values = [
            modelData.name,
            modelData.slug,
            modelData.profileUrl,
            modelData.coverUrl
        ];
        
        const result = await pool.query(insertQuery, values);
        return { id: result.rows[0].id, isNew: true };
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
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        
        const browserPage = await browser.newPage();
        
        await browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await browserPage.setViewport({ width: 1920, height: 1080 });
        
        const url = page === 1 ? SCRAPE_URL : `${SCRAPE_URL}page/${page}/`;
        console.log(`🔗 URL: ${url}\n`);
        
        await browserPage.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const models = await browserPage.evaluate(() => {
            const results = [];
            const links = document.querySelectorAll('a[href*="/actors/"]');
            
            links.forEach(link => {
                const headerElement = link.querySelector('header.entry-header span.actor-title');
                const imgElement = link.querySelector('img');
                
                if (headerElement) {
                    const profileUrl = link.getAttribute('href');
                    const name = headerElement.textContent.trim();
                    
                    if (!name || !profileUrl || profileUrl === 'https://clubeadulto.net/actors/') {
                        return;
                    }
                    
                    const urlParts = profileUrl.split('/').filter(p => p);
                    const slug = urlParts[urlParts.length - 1] || name.toLowerCase().replace(/\s+/g, '-');
                    
                    let coverUrl = null;
                    if (imgElement) {
                        coverUrl = imgElement.getAttribute('src') || 
                                  imgElement.getAttribute('data-src') ||
                                  imgElement.getAttribute('data-lazy-src') ||
                                  imgElement.getAttribute('srcset')?.split(' ')[0];
                    }
                    
                    if (name && profileUrl) {
                        results.push({
                            name,
                            slug,
                            profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://clubeadulto.net${profileUrl}`,
                            coverUrl: coverUrl && coverUrl.startsWith('http') ? coverUrl : (coverUrl ? `https://clubeadulto.net${coverUrl}` : null)
                        });
                    }
                }
            });
            
            return results;
        });
        
        console.log(`📊 Modelos encontradas: ${models.length}\n`);
        
        let savedCount = 0;
        let skippedCount = 0;
        
        for (const model of models) {
            try {
                const result = await saveModel(model);
                if (result.isNew) {
                    savedCount++;
                    console.log(`✓ ${model.name}`);
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`✗ Erro ao salvar ${model.name}:`, error.message);
            }
        }
        
        console.log(`\n✅ Página ${page} concluída: ${savedCount} novas, ${skippedCount} duplicadas, ${models.length} total`);
        
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

async function testDatabaseConnection() {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        console.error('\n❌ ERRO: Não foi possível conectar ao banco de dados PostgreSQL');
        console.error('Detalhes:', error.message);
        return false;
    }
}

async function scrapeAllPages(pageFrom = 1, pageTo = 5) {
    console.log(`\n🚀 Iniciando scraper de modelos do Clube Adulto...\n`);
    console.log(`📄 Intervalo: Página ${pageFrom} até ${pageTo} (${pageTo - pageFrom + 1} páginas)`);
    console.log(`⏱️  Delay entre requisições: ${SCRAPE_DELAY}ms\n`);
    
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.error('❌ Scraping cancelado. Configure o banco de dados\n');
        process.exit(1);
    }
    
    let totalModels = 0;
    let totalSaved = 0;
    
    for (let page = pageFrom; page <= pageTo; page++) {
        try {
            const result = await scrapeModels(page);
            totalModels += result.modelsFound;
            totalSaved += result.modelsSaved;
            
            if (result.modelsFound === 0) {
                console.log('\n⚠️  Nenhuma modelo encontrada. Finalizando scraping.');
                break;
            }
            
            if (page < pageTo) {
                console.log(`\n⏳ Aguardando ${SCRAPE_DELAY}ms antes da próxima página...\n`);
                await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY));
            }
            
        } catch (error) {
            console.error(`\n❌ Erro na página ${page}:`, error.message);
            break;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO SCRAPING - CLUBE ADULTO');
    console.log('='.repeat(60));
    console.log(`Total de modelos encontradas: ${totalModels}`);
    console.log(`Total de modelos salvas: ${totalSaved}`);
    console.log('='.repeat(60) + '\n');
    
    await pool.end();
}

const pageFrom = parseInt(process.argv[2]) || 1;
const pageTo = parseInt(process.argv[3]) || 5;
scrapeAllPages(pageFrom, pageTo);
