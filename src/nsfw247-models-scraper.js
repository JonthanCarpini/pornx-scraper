import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_URL = 'https://nsfw247.to/actors/';
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

async function saveModel(modelData) {
    try {
        const checkQuery = 'SELECT id, profile_url FROM nsfw247_models WHERE profile_url = $1';
        const checkResult = await pool.query(checkQuery, [modelData.profileUrl]);
        
        console.log(`🔍 Verificando: ${modelData.name} - URL: ${modelData.profileUrl}`);
        console.log(`   Resultado da query: ${checkResult.rows.length} registros encontrados`);
        
        if (checkResult.rows.length > 0) {
            console.log(`⚠️  Modelo já existe: ${modelData.name} (ID: ${checkResult.rows[0].id})`);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        console.log(`✨ Nova modelo: ${modelData.name}`);
        
        const insertQuery = `
            INSERT INTO nsfw247_models (name, slug, profile_url, cover_url)
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
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await browserPage.screenshot({ path: `debug-nsfw247-page-${page}.png` });
        console.log(`📸 Screenshot salvo: debug-nsfw247-page-${page}.png`);
        
        const debugInfo = await browserPage.evaluate(() => {
            const debug = {
                totalSpans: document.querySelectorAll('span').length,
                totalLinks: document.querySelectorAll('a').length,
                totalHeaders: document.querySelectorAll('header').length,
                actorTitlesCount: document.querySelectorAll('span.actor-title').length,
                spanClasses: [],
                pageTitle: document.title,
                bodyClasses: document.body.className
            };
            
            const allSpans = document.querySelectorAll('span');
            debug.spanClasses = Array.from(allSpans).slice(0, 20).map(s => s.className).filter(c => c);
            
            return debug;
        });
        
        console.log('\n📊 DEBUG INFO:');
        console.log(`   Título da página: ${debugInfo.pageTitle}`);
        console.log(`   Total de spans: ${debugInfo.totalSpans}`);
        console.log(`   Total de links: ${debugInfo.totalLinks}`);
        console.log(`   Total de headers: ${debugInfo.totalHeaders}`);
        console.log(`   Elementos com classe 'actor-title': ${debugInfo.actorTitlesCount}`);
        console.log(`   Classes de spans: ${debugInfo.spanClasses.slice(0, 10).join(', ')}\n`);
        
        const models = await browserPage.evaluate(() => {
            const results = [];
            const actorTitles = document.querySelectorAll('span.actor-title');
            
            actorTitles.forEach(titleSpan => {
                const name = titleSpan.textContent.trim();
                const linkElement = titleSpan.closest('a');
                
                if (!linkElement) return;
                
                const profileUrl = linkElement.getAttribute('href');
                
                if (!name || !profileUrl || profileUrl === 'https://nsfw247.to/actors/') {
                    return;
                }
                
                const urlParts = profileUrl.split('/').filter(p => p);
                const slug = urlParts[urlParts.length - 1] || name.toLowerCase().replace(/[@\s]+/g, '-');
                
                const imgElement = linkElement.querySelector('img');
                let coverUrl = null;
                if (imgElement) {
                    coverUrl = imgElement.getAttribute('src') || 
                              imgElement.getAttribute('data-src') ||
                              imgElement.getAttribute('data-lazy-src') ||
                              imgElement.getAttribute('srcset')?.split(' ')[0];
                }
                
                results.push({
                    name,
                    slug,
                    profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://nsfw247.to${profileUrl}`,
                    coverUrl: coverUrl && coverUrl.startsWith('http') ? coverUrl : (coverUrl ? `https://nsfw247.to${coverUrl}` : null)
                });
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
    console.log(`\n🚀 Iniciando scraper de modelos do NSFW247...\n`);
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
    console.log('📊 RESUMO DO SCRAPING - NSFW247');
    console.log('='.repeat(60));
    console.log(`Total de modelos encontradas: ${totalModels}`);
    console.log(`Total de modelos salvas: ${totalSaved}`);
    console.log('='.repeat(60) + '\n');
    
    await pool.end();
}

const pageFrom = parseInt(process.argv[2]) || 1;
const pageTo = parseInt(process.argv[3]) || 5;
scrapeAllPages(pageFrom, pageTo);
