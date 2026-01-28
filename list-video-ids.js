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

async function listVideoIds() {
    try {
        console.log('🎬 Listando primeiros 20 vídeos NSFW247 disponíveis:\n');
        
        const result = await pool.query(`
            SELECT 
                id,
                title,
                CASE 
                    WHEN poster_url IS NOT NULL AND video_source_url IS NOT NULL THEN '✅'
                    ELSE '⚠️'
                END as status
            FROM videos
            WHERE poster_url IS NOT NULL AND video_source_url IS NOT NULL
            ORDER BY id ASC
            LIMIT 20
        `);
        
        result.rows.forEach((video, i) => {
            console.log(`${i + 1}. ${video.status} ID: ${video.id} - ${video.title}`);
            console.log(`   URL: http://localhost:3000/player.html?id=${video.id}\n`);
        });
        
        console.log(`\n✅ Total de vídeos completos: ${result.rowCount}`);
        console.log('💡 Use esses IDs para testar o player!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

listVideoIds();
