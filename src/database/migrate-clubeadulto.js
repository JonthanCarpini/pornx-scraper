import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        console.log('🔄 Executando migração para tabelas do Clube Adulto...\n');
        
        const sqlPath = path.join(__dirname, 'add-clubeadulto-tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await pool.query(sql);
        
        console.log('✅ Migração concluída com sucesso!\n');
        console.log('Tabelas criadas:');
        console.log('  - clubeadulto_models');
        console.log('  - clubeadulto_videos\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        process.exit(1);
    }
}

runMigration();
