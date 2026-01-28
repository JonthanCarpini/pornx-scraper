import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        console.log('🔄 Iniciando migração para adicionar tabela de vídeos...\n');
        
        const migrationPath = path.join(__dirname, 'add-videos-table.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');
        
        await pool.query(migration);
        
        console.log('✅ Migração concluída com sucesso!');
        console.log('✓ Coluna video_count adicionada na tabela models');
        console.log('✓ Tabela videos criada');
        console.log('✓ Índices criados');
        console.log('✓ Trigger de atualização configurado\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error.message);
        process.exit(1);
    }
}

runMigration();
