import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

async function restoreDatabase() {
    try {
        const backupFile = process.argv[2];
        
        if (!backupFile) {
            console.error('❌ Erro: Especifique o arquivo de backup\n');
            console.log('📋 Uso:');
            console.log('   node restore-database.js backups/pornx_backup_2026-01-29.sql\n');
            process.exit(1);
        }
        
        if (!existsSync(backupFile)) {
            console.error(`❌ Erro: Arquivo não encontrado: ${backupFile}\n`);
            process.exit(1);
        }
        
        console.log('🔄 Iniciando restore do banco de dados...\n');
        
        // Configurações do banco
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = process.env.DB_PORT || '5432';
        const dbName = process.env.DB_NAME || 'pornx_db';
        const dbUser = process.env.DB_USER || 'postgres';
        const dbPassword = process.env.DB_PASSWORD || 'postgres';
        
        console.log('📊 Configurações do restore:');
        console.log(`   Host: ${dbHost}`);
        console.log(`   Porta: ${dbPort}`);
        console.log(`   Banco: ${dbName}`);
        console.log(`   Usuário: ${dbUser}`);
        console.log(`   Arquivo: ${backupFile}\n`);
        
        // Comando psql
        const command = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${backupFile}"`;
        
        console.log('⏳ Executando restore...\n');
        
        // Definir senha como variável de ambiente
        const env = { ...process.env, PGPASSWORD: dbPassword };
        
        await execAsync(command, { env });
        
        console.log('✅ Restore concluído com sucesso!\n');
        console.log('📊 Banco de dados restaurado com todos os dados\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro ao fazer restore:', error.message);
        console.error('\n💡 Certifique-se de que:');
        console.error('   - PostgreSQL está instalado e psql está disponível');
        console.error('   - As credenciais do banco estão corretas no .env');
        console.error('   - O banco de dados existe e está acessível');
        console.error('   - O arquivo de backup é válido\n');
        process.exit(1);
    }
}

restoreDatabase();
