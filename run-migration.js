import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './src/database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
    try {
        console.log('🔄 Iniciando migration: add-scraping-stages.sql\n');
        
        // Ler o arquivo SQL
        const migrationPath = join(__dirname, 'src', 'database', 'add-scraping-stages.sql');
        const sql = readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Arquivo SQL carregado');
        console.log('⏳ Executando migration...\n');
        
        // Executar a migration
        await pool.query(sql);
        
        console.log('✅ Migration executada com sucesso!\n');
        console.log('📊 Colunas adicionadas:');
        console.log('   - models.videos_scraped');
        console.log('   - models.videos_scraped_at');
        console.log('   - models.details_scraped');
        console.log('   - models.details_scraped_at');
        console.log('   - clubeadulto_models.videos_scraped');
        console.log('   - clubeadulto_models.videos_scraped_at');
        console.log('   - clubeadulto_models.details_scraped');
        console.log('   - clubeadulto_models.details_scraped_at\n');
        
        // Verificar se as colunas foram criadas
        const checkModels = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'models' 
            AND column_name IN ('videos_scraped', 'videos_scraped_at', 'details_scraped', 'details_scraped_at')
            ORDER BY column_name
        `);
        
        const checkClubeAdulto = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'clubeadulto_models' 
            AND column_name IN ('videos_scraped', 'videos_scraped_at', 'details_scraped', 'details_scraped_at')
            ORDER BY column_name
        `);
        
        console.log('🔍 Verificação:');
        console.log(`   ✓ models: ${checkModels.rows.length}/4 colunas criadas`);
        console.log(`   ✓ clubeadulto_models: ${checkClubeAdulto.rows.length}/4 colunas criadas\n`);
        
        if (checkModels.rows.length === 4 && checkClubeAdulto.rows.length === 4) {
            console.log('🎉 Migration concluída com sucesso!\n');
        } else {
            console.log('⚠️  Algumas colunas podem não ter sido criadas. Verifique o banco de dados.\n');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro ao executar migration:', error.message);
        console.error('\nDetalhes:', error);
        process.exit(1);
    }
}

runMigration();
