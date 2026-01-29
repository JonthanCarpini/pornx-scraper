import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function testEmmaFiore10() {
    const username = 'emmafiore10';
    
    console.log(`\n🔍 Testando scraping para: ${username}\n`);
    
    try {
        // Buscar modelo no banco
        const modelResult = await pool.query(
            'SELECT id FROM xxxfollow_models WHERE username = $1',
            [username]
        );
        
        if (modelResult.rows.length === 0) {
            console.log('❌ Modelo não encontrada no banco. Criando...');
            const insertModel = await pool.query(
                `INSERT INTO xxxfollow_models (username, display_name, profile_url, last_scraped_at)
                 VALUES ($1, $2, $3, NOW())
                 RETURNING id`,
                [username, 'Emma Fiore', `https://www.xxxfollow.com/${username}`]
            );
            console.log(`✅ Modelo criada com ID: ${insertModel.rows[0].id}`);
        }
        
        const modelId = modelResult.rows[0]?.id || (await pool.query('SELECT id FROM xxxfollow_models WHERE username = $1', [username])).rows[0].id;
        
        // Buscar vídeos da API
        const apiUrl = `https://www.xxxfollow.com/api/v1/user/${username}/post/public?limit=5&sort_by=recent`;
        
        console.log(`📡 URL: ${apiUrl}\n`);
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            console.log(`❌ Status: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        
        console.log(`✅ Status: ${response.status}`);
        console.log(`📦 Itens retornados: ${data.length}\n`);
        
        let videosSalvos = 0;
        
        for (const item of data) {
            const post = item.post;
            
            // Apenas vídeos free
            if (post.access !== 'free') {
                console.log(`⏭️  Pulando post ${post.id} - não é free (${post.access})`);
                continue;
            }
            
            // Processar cada media
            for (const media of post.media) {
                if (media.type !== 'video') continue;
                
                // Construir URLs a partir do blur_url
                const blurUrl = media.blur_url;
                
                if (!blurUrl) {
                    console.log(`⚠️  Media ${media.id} sem blur_url`);
                    continue;
                }
                
                // Extrair o padrão base da URL
                // De: https://www.xxxfollow.com/media/fans/post_public/3663/36633397/779727_blur.jpg
                // Para: https://www.xxxfollow.com/media/fans/post_public/3663/36633397/779727
                const baseUrl = blurUrl.replace(/_blur\.(jpg|webp)$/, '');
                
                const posterUrl = `${baseUrl}_small.jpg`;
                const sourceUrl = `${baseUrl}.mp4`;
                
                console.log(`\n📹 Vídeo encontrado:`);
                console.log(`   - Media ID: ${media.id}`);
                console.log(`   - Post ID: ${post.id}`);
                console.log(`   - Duração: ${media.duration_in_second}s`);
                console.log(`   - Dimensões: ${media.width}x${media.height}`);
                console.log(`   - Poster: ${posterUrl}`);
                console.log(`   - Source: ${sourceUrl}`);
                console.log(`   - Título: ${post.text || 'Sem título'}`);
                
                // Verificar se já existe
                const existingVideo = await pool.query(
                    'SELECT id FROM xxxfollow_videos WHERE video_id = $1',
                    [media.id.toString()]
                );
                
                if (existingVideo.rows.length > 0) {
                    console.log(`   ⏭️  Vídeo já existe no banco`);
                    continue;
                }
                
                // Inserir no banco
                await pool.query(
                    `INSERT INTO xxxfollow_videos (
                        model_id, video_id, title, url, source, poster,
                        duration, views, likes, comments, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        modelId,
                        media.id.toString(),
                        post.text || 'Sem título',
                        `https://www.xxxfollow.com/${username}/post/${post.slug}`,
                        sourceUrl,
                        posterUrl,
                        media.duration_in_second,
                        item.view_count || 0,
                        item.like_count || 0,
                        item.comment_count || 0,
                        new Date(post.created_at)
                    ]
                );
                
                videosSalvos++;
                console.log(`   ✅ Vídeo salvo no banco!`);
            }
        }
        
        console.log(`\n✅ Processo concluído!`);
        console.log(`📊 Total de vídeos salvos: ${videosSalvos}`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

testEmmaFiore10();
