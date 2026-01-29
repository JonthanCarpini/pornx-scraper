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
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('⏳ Aguardando carregamento...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extrair JSON do __NEXT_DATA__
        const pageData = await page.evaluate(() => {
            const scriptTag = document.getElementById('__NEXT_DATA__');
            if (!scriptTag) return null;
            
            try {
                return JSON.parse(scriptTag.textContent);
            } catch (e) {
                return null;
            }
        });
        
        if (!pageData || !pageData.props || !pageData.props.pageProps) {
            console.log('⚠️  Nenhum dado encontrado na página');
            return [];
        }
        
        const models = [];
        const props = pageData.props.pageProps;
        
        // Buscar modelos em "sidemenu-most-popular" ou outras chaves
        const popularModels = props['sidemenu-most-popular'] || [];
        
        for (const model of popularModels) {
            if (model.type === 'model') {
                models.push({
                    xxxfollowId: model.id,
                    username: model.username,
                    displayName: model.display_name,
                    avatarUrl: model.public_avatar_url,
                    coverUrl: model.public_cover_picture_url || null,
                    coverVideoUrl: model.public_cover_video_url || null,
                    gender: model.gender,
                    bio: null,
                    followerCount: 0,
                    likeCount: 0,
                    viewCount: 0,
                    postCount: 0
                });
            }
        }
        
        console.log(`📊 Modelos encontradas: ${models.length}`);
        return models;
        
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
        
        const models = await scrapeModelsFromPage(page, `${BASE_URL}/creators`);
        
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
        console.log('\n🚀 Iniciando scraping de modelos do XXXFollow...\n');
        
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
        
        await scrapeCreatorsPage(browser);
        
        await browser.close();
        
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
