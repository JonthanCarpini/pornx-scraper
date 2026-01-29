import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const BASE_API_URL = 'https://www.xxxfollow.com/api/v1/post/tag';
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

// Lista de tags para fazer scraping
const TAGS = [
    'onlyfansfree',
    'teen-18',
    'fastfap',
    'tiktok18',
    'gonewild',
    'pussy',
    'nsfw',
    'latina',
    'realgirls',
    'masturbation',
    'cumsluts',
    '18',
    'porn',
    'asiansgonewild',
    'wetpussy',
    'onlyfans',
    'bustypetite',
    'schoolgirl',
    'tiktokxxx',
    'couplesex',
    'publicsex',
    'analsex',
    'bisexual',
    'hardcoresex',
    'sexoenpublico',
    'lesbiansex',
    'sexopublico',
    'sexo',
    'sexoanal',
    'brazilian',
    'bra',
    'brasileira',
    'argentina',
    'mexicana',
    'jovencita18',
    'virgin',
    'ffm',
    'ebony',
    'gwcouples'
];

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function findOrCreateModel(userData) {
    try {
        // Verificar se modelo já existe pelo xxxfollow_id
        const checkQuery = 'SELECT id FROM xxxfollow_models WHERE xxxfollow_id = $1';
        const checkResult = await pool.query(checkQuery, [userData.id]);
        
        if (checkResult.rows.length > 0) {
            return { id: checkResult.rows[0].id, isNew: false };
        }
        
        // Criar novo modelo
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
            userData.id,
            userData.username,
            userData.display_name,
            userData.public_avatar_url,
            userData.public_cover_picture_url,
            userData.public_cover_video_url,
            userData.gender || 'f',
            null, // bio
            0, // follower_count
            0, // like_count
            0, // view_count
            0  // post_count
        ];
        
        const result = await pool.query(insertQuery, values);
        console.log(`  ✓ Novo modelo salvo: ${userData.username}`);
        return { id: result.rows[0].id, isNew: true };
    } catch (error) {
        if (error.code === '23505') {
            // Duplicate key - tentar buscar novamente
            const checkResult = await pool.query('SELECT id FROM xxxfollow_models WHERE xxxfollow_id = $1', [userData.id]);
            return { id: checkResult.rows[0].id, isNew: false };
        }
        throw error;
    }
}

async function saveVideo(modelId, postData, mediaData, statsData) {
    try {
        // Verificar se vídeo já existe
        const checkQuery = 'SELECT id FROM xxxfollow_videos WHERE xxxfollow_post_id = $1 AND xxxfollow_media_id = $2';
        const checkResult = await pool.query(checkQuery, [postData.id, mediaData.id]);
        
        if (checkResult.rows.length > 0) {
            return { isNew: false };
        }
        
        // Prioridade de URL: uhd > fhd > sd > url
        const videoUrl = mediaData.uhd_url || mediaData.fhd_url || mediaData.sd_url || mediaData.url;
        const posterUrl = mediaData.start_url || mediaData.thumb_url;
        
        const insertQuery = `
            INSERT INTO xxxfollow_videos (
                model_id, xxxfollow_post_id, xxxfollow_media_id, 
                title, video_url, poster_url, thumbnail_url,
                duration, width, height, has_audio,
                view_count, like_count, comment_count, posted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `;
        
        const values = [
            modelId,
            postData.id,
            mediaData.id,
            postData.text || 'Sem título',
            videoUrl,
            posterUrl,
            mediaData.thumb_url,
            mediaData.duration_in_second || 0,
            mediaData.width || 0,
            mediaData.height || 0,
            mediaData.has_audio || false,
            statsData.view_count || 0,
            statsData.like_count || 0,
            statsData.comment_count || 0,
            postData.created_at
        ];
        
        await pool.query(insertQuery, values);
        return { isNew: true };
    } catch (error) {
        if (error.code === '23505') {
            return { isNew: false };
        }
        throw error;
    }
}

async function scrapeTag(tag, maxPages = 10) {
    console.log(`\n🏷️  Scraping tag: ${tag}`);
    
    let page = 1;
    let totalModels = 0;
    let totalVideos = 0;
    let newModels = 0;
    let newVideos = 0;
    let startTime = Math.floor(Date.now() / 1000);
    
    while (page <= maxPages) {
        try {
            const url = `${BASE_API_URL}/${tag}?genders=cf&period=all&limit=24&page=${page}&start_time=${startTime}`;
            
            console.log(`  📄 Página ${page}...`);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                console.log(`  ⚠️  Status ${response.status} - parando`);
                break;
            }
            
            const data = await response.json();
            
            if (!data.list || data.list.length === 0) {
                console.log(`  ✓ Sem mais resultados`);
                break;
            }
            
            console.log(`  📦 ${data.list.length} posts encontrados`);
            
            for (const item of data.list) {
                const post = item.post;
                const user = post.user;
                
                // Processar apenas vídeos públicos
                if (post.access !== 'free') continue;
                if (!post.media || post.media.length === 0) continue;
                
                // Criar/buscar modelo
                const modelResult = await findOrCreateModel(user);
                if (modelResult.isNew) {
                    newModels++;
                }
                totalModels++;
                
                // Processar cada vídeo do post
                for (const media of post.media) {
                    if (media.type !== 'video') continue;
                    
                    const videoResult = await saveVideo(modelResult.id, post, media, item);
                    if (videoResult.isNew) {
                        newVideos++;
                        console.log(`    ✓ Vídeo salvo: ${post.text?.substring(0, 50) || 'Sem título'}`);
                    }
                    totalVideos++;
                }
            }
            
            // Se retornou menos que o limite, não há mais páginas
            if (data.list.length < 24) {
                console.log(`  ✓ Última página alcançada`);
                break;
            }
            
            page++;
            await delay(SCRAPE_DELAY);
            
        } catch (error) {
            console.error(`  ❌ Erro na página ${page}:`, error.message);
            break;
        }
    }
    
    return { totalModels, totalVideos, newModels, newVideos };
}

async function scrapeAllTags() {
    console.log('\n🚀 Iniciando scraping de tags do XXXFollow...\n');
    console.log(`📋 Total de tags: ${TAGS.length}\n`);
    
    let globalStats = {
        totalModels: 0,
        totalVideos: 0,
        newModels: 0,
        newVideos: 0
    };
    
    for (const tag of TAGS) {
        try {
            const stats = await scrapeTag(tag, 5); // 5 páginas por tag
            
            globalStats.totalModels += stats.totalModels;
            globalStats.totalVideos += stats.totalVideos;
            globalStats.newModels += stats.newModels;
            globalStats.newVideos += stats.newVideos;
            
            console.log(`  📊 Tag "${tag}": ${stats.newModels} novos modelos, ${stats.newVideos} novos vídeos\n`);
            
            await delay(SCRAPE_DELAY);
            
        } catch (error) {
            console.error(`❌ Erro ao processar tag "${tag}":`, error.message);
        }
    }
    
    console.log('\n============================================================');
    console.log('📊 RESUMO FINAL - SCRAPING DE TAGS');
    console.log('============================================================');
    console.log(`Tags processadas: ${TAGS.length}`);
    console.log(`Modelos processados: ${globalStats.totalModels}`);
    console.log(`Novos modelos: ${globalStats.newModels}`);
    console.log(`Vídeos processados: ${globalStats.totalVideos}`);
    console.log(`Novos vídeos: ${globalStats.newVideos}`);
    console.log('============================================================\n');
    
    console.log('✅ Scraping de tags concluído!\n');
}

// Executar scraping
scrapeAllTags()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
