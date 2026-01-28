import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
    try {
        console.log('Iniciando criação do banco de dados...');
        
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        await pool.query(schema);
        
        console.log('✓ Banco de dados criado com sucesso!');
        console.log('✓ Tabela "models" criada');
        console.log('✓ Índices criados');
        console.log('✓ Trigger de atualização configurado');
        
        process.exit(0);
    } catch (error) {
        console.error('Erro ao inicializar banco de dados:', error);
        process.exit(1);
    }
}

initDatabase();
