import pool from './src/database/db.js';

async function checkModelsWithVideos() {
    try {
        console.log('🔍 Verificando modelos com vídeos...\n');
        
        // NSFW247
        const nsfw247 = await pool.query(`
            SELECT COUNT(DISTINCT model_id) as models_with_videos
            FROM videos
        `);
        
        const nsfw247Total = await pool.query(`
            SELECT COUNT(*) as total_models
            FROM models
        `);
        
        const nsfw247Flagged = await pool.query(`
            SELECT COUNT(*) as flagged_models
            FROM models
            WHERE videos_scraped = TRUE
        `);
        
        console.log('📊 NSFW247:');
        console.log(`   Total de modelos no banco: ${nsfw247Total.rows[0].total_models}`);
        console.log(`   Modelos com vídeos: ${nsfw247.rows[0].models_with_videos}`);
        console.log(`   Modelos marcadas como coletadas: ${nsfw247Flagged.rows[0].flagged_models}`);
        console.log(`   Diferença: ${nsfw247Flagged.rows[0].flagged_models - nsfw247.rows[0].models_with_videos}`);
        
        // Clube Adulto
        const clubeAdulto = await pool.query(`
            SELECT COUNT(DISTINCT model_id) as models_with_videos
            FROM clubeadulto_videos
        `);
        
        const clubeAdultoTotal = await pool.query(`
            SELECT COUNT(*) as total_models
            FROM clubeadulto_models
        `);
        
        const clubeAdultoFlagged = await pool.query(`
            SELECT COUNT(*) as flagged_models
            FROM clubeadulto_models
            WHERE videos_scraped = TRUE
        `);
        
        console.log('\n📊 Clube Adulto:');
        console.log(`   Total de modelos no banco: ${clubeAdultoTotal.rows[0].total_models}`);
        console.log(`   Modelos com vídeos: ${clubeAdulto.rows[0].models_with_videos}`);
        console.log(`   Modelos marcadas como coletadas: ${clubeAdultoFlagged.rows[0].flagged_models}`);
        console.log(`   Diferença: ${clubeAdultoFlagged.rows[0].flagged_models - clubeAdulto.rows[0].models_with_videos}`);
        
        console.log('\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

checkModelsWithVideos();
