import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        console.log('🔄 Iniciando migração para adicionar detalhes dos vídeos...\n');
        
        const migrationPath = path.join(__dirname, 'add-video-details.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');
        
        await pool.query(migration);
        
        console.log('✅ Migração concluída com sucesso!');
        console.log('✓ Coluna poster_url adicionada');
        console.log('✓ Coluna video_source_url adicionada\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error.message);
        process.exit(1);
    }
}

runMigration();
