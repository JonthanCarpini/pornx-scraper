import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'pornx',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function checkVideos() {
    try {
        console.log('🔍 Verificando vídeos do Clube Adulto...\n');
        
        // Estatísticas gerais
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_videos,
                COUNT(CASE WHEN poster_url IS NOT NULL THEN 1 END) as com_poster,
                COUNT(CASE WHEN m3u8_url IS NOT NULL THEN 1 END) as com_m3u8,
                COUNT(CASE WHEN poster_url IS NOT NULL AND m3u8_url IS NOT NULL THEN 1 END) as completos
            FROM clubeadulto_videos
        `);
        
        const s = stats.rows[0];
        console.log('📊 ESTATÍSTICAS GERAIS:');
        console.log(`   Total de vídeos: ${s.total_videos}`);
        console.log(`   Com poster: ${s.com_poster} (${((s.com_poster/s.total_videos)*100).toFixed(1)}%)`);
        console.log(`   Com M3U8: ${s.com_m3u8} (${((s.com_m3u8/s.total_videos)*100).toFixed(1)}%)`);
        console.log(`   Completos: ${s.completos} (${((s.completos/s.total_videos)*100).toFixed(1)}%)`);
        
        // Últimos 10 vídeos
        console.log('\n📹 ÚLTIMOS 10 VÍDEOS PROCESSADOS:');
        const recent = await pool.query(`
            SELECT 
                id,
                title,
                CASE 
                    WHEN poster_url IS NOT NULL AND m3u8_url IS NOT NULL THEN '✅ Completo'
                    WHEN poster_url IS NOT NULL THEN '⚠️  Só poster'
                    WHEN m3u8_url IS NOT NULL THEN '⚠️  Só M3U8'
                    ELSE '❌ Sem detalhes'
                END as status,
                created_at
            FROM clubeadulto_videos
            ORDER BY id DESC
            LIMIT 10
        `);
        
        recent.rows.forEach((video, i) => {
            console.log(`\n${i + 1}. ${video.status}`);
            console.log(`   ID: ${video.id}`);
            console.log(`   Título: ${video.title}`);
            console.log(`   Criado: ${video.created_at}`);
        });
        
        // Modelos com mais vídeos
        console.log('\n👥 TOP 5 MODELOS COM MAIS VÍDEOS:');
        const topModels = await pool.query(`
            SELECT 
                m.name,
                m.video_count,
                COUNT(v.id) as videos_salvos
            FROM clubeadulto_models m
            LEFT JOIN clubeadulto_videos v ON v.model_id = m.id
            GROUP BY m.id, m.name, m.video_count
            ORDER BY m.video_count DESC
            LIMIT 5
        `);
        
        topModels.rows.forEach((model, i) => {
            console.log(`${i + 1}. ${model.name}: ${model.video_count} vídeos (${model.videos_salvos} salvos)`);
        });
        
        console.log('\n✅ Verificação concluída!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkVideos();
