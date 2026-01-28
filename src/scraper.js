import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_URL = process.env.SCRAPE_URL || 'https://nsfw247.to/models';
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function saveModel(modelData) {
    try {
        const checkQuery = 'SELECT id FROM models WHERE profile_url = $1';
        const checkResult = await pool.query(checkQuery, [modelData.profileUrl]);
        
        if (checkResult.rows.length > 0) {
            console.log(`⚠️  Modelo já existe: ${modelData.name}`);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        const insertQuery = `
            INSERT INTO models (name, profile_url, cover_url)
            VALUES ($1, $2, $3)
            RETURNING id;
        `;
        
        const values = [
            modelData.name,
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
            : `https://nsfw247.to/models?page=${page}`;
        console.log(`📄 Acessando: ${url}`);
        
        await browserPage.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const selectors = [
            '.pt-cv-ifield',
            'div.pt-cv-ifield',
            '.pt-cv-content-item'
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
                const profileUrl = linkElement?.getAttribute('href');
                
                const titleElement = element.querySelector('.pt-cv-title a, h5.pt-cv-title a');
                const name = titleElement?.textContent?.trim();
                
                const imgElement = element.querySelector('img');
                const coverUrl = imgElement?.getAttribute('src') || 
                               imgElement?.getAttribute('data-src') || 
                               imgElement?.getAttribute('data-large');
                
                if (name && profileUrl) {
                    const fullProfileUrl = profileUrl.startsWith('http') ? profileUrl : `https://nsfw247.to${profileUrl}`;
                    
                    results.push({
                        name: name,
                        profileUrl: fullProfileUrl,
                        coverUrl: coverUrl || null
                    });
                }
            });
            
            return results;
        }, foundSelector);
        
        console.log(`✓ Encontradas ${models.length} modelos na página ${page}`);
        
        let savedCount = 0;
        let skippedCount = 0;
        for (const model of models) {
            try {
                const result = await saveModel(model);
                if (result.isNew) {
                    savedCount++;
                    console.log(`  ✓ [${savedCount}/${models.length}] ${model.name}`);
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`  ✗ Erro ao salvar ${model.name}:`, error.message);
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
        console.error('\n📝 Para usar o banco de dados:');
        console.error('1. Certifique-se de que o PostgreSQL está rodando');
        console.error('2. Crie o arquivo .env baseado em .env.example');
        console.error('3. Configure as credenciais corretas no .env');
        console.error('4. Execute: npm run init-db\n');
        console.error('💡 Alternativa: Use "npm run scrape:json" para salvar em arquivo JSON\n');
        return false;
    }
}

async function scrapeAllPages(maxPages = 5) {
    console.log(`\n🎯 Iniciando scraping de até ${maxPages} páginas...\n`);
    
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.error('❌ Scraping cancelado. Configure o banco de dados ou use scrape:json\n');
        process.exit(1);
    }
    
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
