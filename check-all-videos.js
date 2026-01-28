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

async function checkAllVideos() {
    try {
        console.log('🔍 Verificando TODOS os vídeos...\n');
        
        // NSFW247
        console.log('🔥 NSFW247:');
        const nsfw247 = await pool.query(`
            SELECT 
                COUNT(*) as total_videos,
                COUNT(CASE WHEN poster_url IS NOT NULL THEN 1 END) as com_poster,
                COUNT(CASE WHEN video_source_url IS NOT NULL THEN 1 END) as com_source,
                COUNT(CASE WHEN poster_url IS NOT NULL AND video_source_url IS NOT NULL THEN 1 END) as completos
            FROM videos
        `);
        
        const n = nsfw247.rows[0];
        console.log(`   Total de vídeos: ${n.total_videos}`);
        console.log(`   Com poster: ${n.com_poster}`);
        console.log(`   Com source: ${n.com_source}`);
        console.log(`   Completos: ${n.completos}`);
        
        if (parseInt(n.total_videos) === 0) {
            console.log('   ⚠️  NENHUM VÍDEO ENCONTRADO - Execute o scraping do NSFW247!\n');
        } else {
            console.log('   ✅ Vídeos disponíveis!\n');
        }
        
        // Clube Adulto
        console.log('🎬 CLUBE ADULTO:');
        const ca = await pool.query(`
            SELECT 
                COUNT(*) as total_videos,
                COUNT(CASE WHEN poster_url IS NOT NULL THEN 1 END) as com_poster,
                COUNT(CASE WHEN m3u8_url IS NOT NULL THEN 1 END) as com_m3u8,
                COUNT(CASE WHEN poster_url IS NOT NULL AND m3u8_url IS NOT NULL THEN 1 END) as completos
            FROM clubeadulto_videos
        `);
        
        const c = ca.rows[0];
        console.log(`   Total de vídeos: ${c.total_videos}`);
        console.log(`   Com poster: ${c.com_poster}`);
        console.log(`   Com M3U8: ${c.com_m3u8}`);
        console.log(`   Completos: ${c.completos}`);
        
        if (parseInt(c.completos) > 0) {
            console.log('   ✅ Vídeos disponíveis!\n');
        } else {
            console.log('   ⚠️  Scraping em andamento...\n');
        }
        
        // Resumo
        console.log('📊 RESUMO:');
        if (parseInt(n.total_videos) === 0) {
            console.log('   ❌ NSFW247: SEM VÍDEOS - Execute o scraping!');
            console.log('   📍 Acesse: http://localhost:3000/admin-scraper.html');
            console.log('   📍 Aba: 🔥 NSFW247');
            console.log('   📍 Execute os 3 passos do scraping\n');
        }
        
        if (parseInt(c.completos) === 0) {
            console.log('   ⏳ Clube Adulto: Scraping em andamento');
            console.log(`   📍 Progresso: ${c.com_poster}/${c.total_videos} vídeos processados\n`);
        }
        
        console.log('✅ Verificação concluída!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkAllVideos();
