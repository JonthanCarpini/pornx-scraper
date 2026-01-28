import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

async function testConnection() {
    try {
        console.log('Testando conexão com o banco de dados...');
        const result = await pool.query('SELECT NOW()');
        console.log('✓ Conexão bem-sucedida!');
        console.log('Hora do servidor:', result.rows[0].now);
        
        const modelsCount = await pool.query('SELECT COUNT(*) FROM models');
        console.log(`Total de modelos no banco: ${modelsCount.rows[0].count}`);
        
        await pool.end();
    } catch (error) {
        console.error('Erro ao conectar ao banco:', error.message);
        process.exit(1);
    }
}

testConnection();
