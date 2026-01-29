import pool from './db.js';

async function clearXXXFollowModels() {
    try {
        console.log('🗑️  Limpando modelos do XXXFollow...\n');
        
        // Deletar todos os vídeos primeiro (por causa da foreign key)
        const videosResult = await pool.query('DELETE FROM xxxfollow_videos');
        console.log(`✓ ${videosResult.rowCount} vídeos deletados`);
        
        // Deletar todas as modelos
        const modelsResult = await pool.query('DELETE FROM xxxfollow_models');
        console.log(`✓ ${modelsResult.rowCount} modelos deletadas`);
        
        console.log('\n✅ Limpeza concluída com sucesso!\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro ao limpar dados:', error.message);
        process.exit(1);
    }
}

clearXXXFollowModels();
