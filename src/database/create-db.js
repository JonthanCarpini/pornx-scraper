import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function createDatabase() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: 'postgres',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });

    try {
        await client.connect();
        console.log('✓ Conectado ao PostgreSQL');
        
        const checkDb = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [process.env.DB_NAME]
        );
        
        if (checkDb.rows.length === 0) {
            console.log(`Criando banco de dados "${process.env.DB_NAME}"...`);
            await client.query(`CREATE DATABASE ${process.env.DB_NAME}`);
            console.log(`✓ Banco de dados "${process.env.DB_NAME}" criado com sucesso!`);
        } else {
            console.log(`✓ Banco de dados "${process.env.DB_NAME}" já existe`);
        }
        
        await client.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao criar banco de dados:', error.message);
        console.error('\nVerifique:');
        console.error('1. PostgreSQL está rodando');
        console.error('2. Credenciais no arquivo .env estão corretas');
        console.error('3. Usuário tem permissão para criar bancos de dados');
        await client.end();
        process.exit(1);
    }
}

createDatabase();
