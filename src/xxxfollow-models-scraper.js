import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;
const BASE_URL = 'https://www.xxxfollow.com';

async function saveModel(modelData) {
    try {
        const checkQuery = 'SELECT id FROM xxxfollow_models WHERE xxxfollow_id = $1';
        const checkResult = await pool.query(checkQuery, [modelData.xxxfollowId]);
        
        if (checkResult.rows.length > 0) {
            console.log(`  ⏭️  Modelo já existe: ${modelData.username}`);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        const insertQuery = `
            INSERT INTO xxxfollow_models (
                xxxfollow_id, username, display_name, avatar_url, 
                cover_url, cover_video_url, gender, bio,
                follower_count, like_count, view_count, post_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id;
        `;
        
        const values = [
            modelData.xxxfollowId,
            modelData.username,
            modelData.displayName,
            modelData.avatarUrl,
            modelData.coverUrl,
            modelData.coverVideoUrl,
            modelData.gender,
            modelData.bio,
            modelData.followerCount || 0,
            modelData.likeCount || 0,
            modelData.viewCount || 0,
            modelData.postCount || 0
        ];
        
        const result = await pool.query(insertQuery, values);
        console.log(`  ✓ Nova modelo salva: ${modelData.username}`);
        return { id: result.rows[0].id, isNew: true };
    } catch (error) {
        if (error.code === '23505') {
            console.log(`  ⏭️  Modelo duplicada (constraint): ${modelData.username}`);
            const checkResult = await pool.query('SELECT id FROM xxxfollow_models WHERE xxxfollow_id = $1', [modelData.xxxfollowId]);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        console.error(`  ❌ Erro ao salvar modelo ${modelData.username}:`, error.message);
        throw error;
    }
}

async function scrapeModelsFromPage(page, pageUrl) {
    try {
        console.log(`\n🔗 Acessando: ${pageUrl}`);
        
        await page.goto(pageUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento completo...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Extrair modelos diretamente do HTML
        const models = await page.evaluate(() => {
            const modelCards = document.querySelectorAll('a[href^="/"]');
            const foundModels = [];
            const seen = new Set();
            
            modelCards.forEach(card => {
                const href = card.getAttribute('href');
                if (!href || href === '/' || href.startsWith('/tag') || href.startsWith('/support')) return;
                
                const username = href.replace('/', '');
                if (seen.has(username)) return;
                seen.add(username);
                
                // Buscar imagem do avatar dentro da estrutura correta
                const img = card.querySelector('.index-module__avatar--Csl9u img.index-module__img--L9Qid');
                if (!img) return;
                
                const avatarUrl = img.getAttribute('src');
                const displayName = img.getAttribute('alt');
                
                if (avatarUrl && displayName && username) {
                    foundModels.push({
                        username: username,
                        displayName: displayName,
                        avatarUrl: avatarUrl,
                        profileUrl: href
                    });
                }
            });
            
            return foundModels;
        });
        
        console.log(`📊 Modelos encontradas no HTML: ${models.length}`);
        
        // Converter para formato do banco
        const formattedModels = models.map(model => ({
            xxxfollowId: Math.floor(Math.random() * 100000000), // ID temporário
            username: model.username,
            displayName: model.displayName,
            avatarUrl: model.avatarUrl,
            coverUrl: null,
            coverVideoUrl: null,
            gender: 'f',
            bio: null,
            followerCount: 0,
            likeCount: 0,
            viewCount: 0,
            postCount: 0
        }));
        
        return formattedModels;
        
    } catch (error) {
        console.error('❌ Erro ao fazer scraping da página:', error.message);
        return [];
    }
}

async function scrapeCreatorsPage(browser) {
    try {
        console.log('\n🎯 Scraping página de creators...\n');
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        const models = await scrapeModelsFromPage(page, `${BASE_URL}/most-popular/all`);
        
        let savedCount = 0;
        let duplicateCount = 0;
        
        for (const modelData of models) {
            try {
                const result = await saveModel(modelData);
                if (result.isNew) {
                    savedCount++;
                } else {
                    duplicateCount++;
                }
            } catch (error) {
                console.error(`❌ Erro ao processar ${modelData.username}:`, error.message);
            }
        }
        
        await page.close();
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING - XXXFOLLOW CREATORS');
        console.log('============================================================');
        console.log(`Modelos encontradas: ${models.length}`);
        console.log(`Novas modelos salvas: ${savedCount}`);
        console.log(`Modelos duplicadas: ${duplicateCount}`);
        console.log('============================================================\n');
        
        return { total: models.length, saved: savedCount, duplicates: duplicateCount };
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        throw error;
    }
}

async function scrapeAllModels() {
    let browser;
    
    try {
        // Pegar página da linha de comando ou usar padrão
        const scrapePage = process.argv[2] || 'most-popular/all';
        const scrapeUrl = `${BASE_URL}/${scrapePage}`;
        
        console.log('\n🚀 Iniciando scraping de modelos do XXXFollow...');
        console.log(`📄 Página: ${scrapePage}`);
        console.log(`🔗 URL: ${scrapeUrl}\n`);
        
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
        
        // Buscar modelos da página
        const models = await scrapeModelsFromPage(page, scrapeUrl);
        
        // Salvar modelos no banco
        let savedCount = 0;
        let duplicateCount = 0;
        
        for (const modelData of models) {
            try {
                const result = await saveModel(modelData);
                if (result.isNew) {
                    savedCount++;
                } else {
                    duplicateCount++;
                }
            } catch (error) {
                console.error(`❌ Erro ao processar ${modelData.username}:`, error.message);
            }
        }
        
        await page.close();
        await browser.close();
        
        console.log('\n============================================================');
        console.log('📊 RESUMO DO SCRAPING - XXXFOLLOW');
        console.log('============================================================');
        console.log(`Modelos encontradas: ${models.length}`);
        console.log(`Novas modelos salvas: ${savedCount}`);
        console.log(`Modelos duplicadas: ${duplicateCount}`);
        console.log('============================================================\n');
        
        console.log('✅ Scraping de modelos XXXFollow concluído!\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
}

scrapeAllModels();
