import pool from '../database/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function queryModels() {
    try {
        console.log('\n📊 Consultando modelos no banco de dados...\n');
        
        const countResult = await pool.query('SELECT COUNT(*) FROM models');
        const totalModels = parseInt(countResult.rows[0].count);
        
        console.log(`Total de modelos: ${totalModels}\n`);
        
        if (totalModels > 0) {
            const modelsResult = await pool.query(`
                SELECT 
                    id,
                    name,
                    profile_url,
                    video_count,
                    photo_count,
                    created_at
                FROM models
                ORDER BY created_at DESC
                LIMIT 20
            `);
            
            console.log('Últimas 20 modelos cadastradas:');
            console.log('='.repeat(80));
            
            modelsResult.rows.forEach((model, index) => {
                console.log(`${index + 1}. ${model.name}`);
                console.log(`   URL: ${model.profile_url}`);
                console.log(`   Vídeos: ${model.video_count} | Fotos: ${model.photo_count}`);
                console.log(`   Cadastrada em: ${model.created_at.toLocaleString('pt-BR')}`);
                console.log('-'.repeat(80));
            });
            
            const statsResult = await pool.query(`
                SELECT 
                    SUM(video_count) as total_videos,
                    SUM(photo_count) as total_photos,
                    AVG(video_count) as avg_videos,
                    AVG(photo_count) as avg_photos
                FROM models
            `);
            
            const stats = statsResult.rows[0];
            console.log('\n📈 Estatísticas:');
            console.log('='.repeat(80));
            console.log(`Total de vídeos: ${stats.total_videos || 0}`);
            console.log(`Total de fotos: ${stats.total_photos || 0}`);
            console.log(`Média de vídeos por modelo: ${parseFloat(stats.avg_videos || 0).toFixed(2)}`);
            console.log(`Média de fotos por modelo: ${parseFloat(stats.avg_photos || 0).toFixed(2)}`);
            console.log('='.repeat(80) + '\n');
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Erro ao consultar modelos:', error.message);
        process.exit(1);
    }
}

queryModels();
