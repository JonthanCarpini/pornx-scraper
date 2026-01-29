import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY) || 2000;

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
        
        // Construir URLs a partir do blur_url (mesma lógica do xxxfollow-videos-scraper)
        let videoUrl = null;
        let posterUrl = null;
        
        if (mediaData.blur_url) {
            // Remover query parameters e extrair o padrão base da URL
            const cleanUrl = mediaData.blur_url.split('?')[0];
            const baseUrl = cleanUrl.replace(/_blur\.(jpg|webp)$/, '');
            
            posterUrl = `${baseUrl}_small.jpg`;
            videoUrl = `${baseUrl}.mp4`;
        } else {
            // Fallback: tentar usar URLs diretas da API (se disponíveis)
            videoUrl = mediaData.uhd_url || mediaData.fhd_url || mediaData.sd_url || mediaData.url;
            posterUrl = mediaData.start_url || mediaData.thumb_url;
        }
        
        // Validar se tem videoUrl válido
        if (!videoUrl) {
            console.log(`    ⚠️  Vídeo sem URL válida - pulando`);
            return { isNew: false };
        }
        
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
            posterUrl, // thumbnail_url = posterUrl
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

async function scrapeCustomUrl(apiUrl, maxPages = 10) {
    console.log(`\n🔗 Scraping URL customizada: ${apiUrl}`);
    
    let page = 1;
    let totalModels = 0;
    let totalVideos = 0;
    let newModels = 0;
    let newVideos = 0;
    
    // Extrair tag da URL para logs
    const tagMatch = apiUrl.match(/\/tag\/([^?]+)/);
    const tagName = tagMatch ? tagMatch[1] : 'custom';
    
    while (page <= maxPages) {
        try {
            // Substituir o parâmetro page na URL
            const urlWithPage = apiUrl.replace(/page=\d+/, `page=${page}`);
            
            console.log(`  📄 Página ${page}...`);
            
            const response = await fetch(urlWithPage, {
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
                try {
                    const post = item.post;
                    
                    // Validar estrutura do post
                    if (!post) {
                        console.log(`    ⚠️  Post inválido - pulando`);
                        continue;
                    }
                    
                    const user = post.user;
                    
                    // Validar se tem usuário
                    if (!user || !user.id) {
                        console.log(`    ⚠️  Post sem usuário - pulando`);
                        continue;
                    }
                    
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
                        if (!media || media.type !== 'video') continue;
                        
                        // Validar se media tem ID
                        if (!media.id) {
                            console.log(`    ⚠️  Vídeo sem ID - pulando`);
                            continue;
                        }
                        
                        // Validar se post tem ID
                        if (!post.id) {
                            console.log(`    ⚠️  Post sem ID - pulando`);
                            continue;
                        }
                        
                        const videoResult = await saveVideo(modelResult.id, post, media, item);
                        if (videoResult.isNew) {
                            newVideos++;
                            console.log(`    ✓ Vídeo salvo: ${post.text?.substring(0, 50) || 'Sem título'}`);
                        }
                        totalVideos++;
                    }
                } catch (itemError) {
                    console.error(`    ❌ Erro ao processar item:`, itemError.message);
                    continue;
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
    
    console.log(`  📊 Tag "${tagName}": ${newModels} novos modelos, ${newVideos} novos vídeos\n`);
    
    return { totalModels, totalVideos, newModels, newVideos };
}

async function main() {
    const customUrl = process.argv[2];
    
    if (!customUrl) {
        console.log('\n❌ Erro: URL não fornecida!');
        console.log('\n📖 Uso:');
        console.log('  node src/xxxfollow-custom-tag-scraper.js "URL_DA_API"\n');
        console.log('📝 Exemplo:');
        console.log('  node src/xxxfollow-custom-tag-scraper.js "https://www.xxxfollow.com/api/v1/post/tag/18years?genders=cf&period=featured&limit=24&page=1&start_time=1769729850"\n');
        process.exit(1);
    }
    
    console.log('\n🚀 Iniciando scraping de URL customizada...\n');
    
    try {
        const stats = await scrapeCustomUrl(customUrl, 10);
        
        console.log('\n============================================================');
        console.log('📊 RESUMO FINAL');
        console.log('============================================================');
        console.log(`Modelos processados: ${stats.totalModels}`);
        console.log(`Novos modelos: ${stats.newModels}`);
        console.log(`Vídeos processados: ${stats.totalVideos}`);
        console.log(`Novos vídeos: ${stats.newVideos}`);
        console.log('============================================================\n');
        
        console.log('✅ Scraping concluído!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    }
}

main();
