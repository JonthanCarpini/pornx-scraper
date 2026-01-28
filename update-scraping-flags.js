import pool from './src/database/db.js';

async function updateScrapingFlags() {
    try {
        console.log('🔄 Atualizando flags de scraping para modelos com vídeos existentes...\n');
        
        // Resetar todas as flags primeiro
        console.log('🔄 Resetando flags...');
        await pool.query('UPDATE models SET videos_scraped = FALSE, videos_scraped_at = NULL');
        await pool.query('UPDATE clubeadulto_models SET videos_scraped = FALSE, videos_scraped_at = NULL');
        console.log('   ✅ Flags resetadas\n');
        
        // Atualizar NSFW247 - marcar modelos que já têm vídeos
        console.log('📊 NSFW247:');
        const nsfw247Result = await pool.query(`
            UPDATE models 
            SET 
                videos_scraped = TRUE,
                videos_scraped_at = CURRENT_TIMESTAMP
            WHERE id IN (
                SELECT DISTINCT model_id 
                FROM videos
            )
            RETURNING id, name
        `);
        
        console.log(`   ✅ ${nsfw247Result.rowCount} modelos marcadas como coletadas`);
        
        if (nsfw247Result.rows.length > 0 && nsfw247Result.rows.length <= 10) {
            nsfw247Result.rows.forEach(model => {
                console.log(`      - ${model.name} (ID: ${model.id})`);
            });
        }
        
        // Atualizar Clube Adulto - marcar modelos que já têm vídeos
        console.log('\n📊 Clube Adulto:');
        const clubeAdultoResult = await pool.query(`
            UPDATE clubeadulto_models 
            SET 
                videos_scraped = TRUE,
                videos_scraped_at = CURRENT_TIMESTAMP
            WHERE id IN (
                SELECT DISTINCT model_id 
                FROM clubeadulto_videos
            )
            RETURNING id, name
        `);
        
        console.log(`   ✅ ${clubeAdultoResult.rowCount} modelos marcadas como coletadas`);
        
        if (clubeAdultoResult.rows.length > 0 && clubeAdultoResult.rows.length <= 10) {
            clubeAdultoResult.rows.forEach(model => {
                console.log(`      - ${model.name} (ID: ${model.id})`);
            });
        }
        
        // Estatísticas finais
        console.log('\n============================================================');
        console.log('📊 RESUMO DA ATUALIZAÇÃO');
        console.log('============================================================');
        
        const nsfw247Stats = await pool.query(`
            SELECT 
                COUNT(*) as total_models,
                COUNT(*) FILTER (WHERE videos_scraped = TRUE) as scraped_models,
                COUNT(*) FILTER (WHERE videos_scraped = FALSE OR videos_scraped IS NULL) as pending_models
            FROM models
        `);
        
        const clubeAdultoStats = await pool.query(`
            SELECT 
                COUNT(*) as total_models,
                COUNT(*) FILTER (WHERE videos_scraped = TRUE) as scraped_models,
                COUNT(*) FILTER (WHERE videos_scraped = FALSE OR videos_scraped IS NULL) as pending_models
            FROM clubeadulto_models
        `);
        
        console.log('\nNSFW247:');
        console.log(`   Total de modelos: ${nsfw247Stats.rows[0].total_models}`);
        console.log(`   Já coletadas: ${nsfw247Stats.rows[0].scraped_models}`);
        console.log(`   Pendentes: ${nsfw247Stats.rows[0].pending_models}`);
        
        console.log('\nClube Adulto:');
        console.log(`   Total de modelos: ${clubeAdultoStats.rows[0].total_models}`);
        console.log(`   Já coletadas: ${clubeAdultoStats.rows[0].scraped_models}`);
        console.log(`   Pendentes: ${clubeAdultoStats.rows[0].pending_models}`);
        
        console.log('============================================================\n');
        console.log('✅ Atualização concluída com sucesso!\n');
        console.log('🚀 Agora você pode rodar os scrapers:');
        console.log('   - npm run scrape:videos (NSFW247)');
        console.log('   - npm run clubeadulto:videos (Clube Adulto)\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro ao atualizar flags:', error.message);
        console.error('\nDetalhes:', error);
        process.exit(1);
    }
}

updateScrapingFlags();
