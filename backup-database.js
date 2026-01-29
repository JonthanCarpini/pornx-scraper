import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

async function backupDatabase() {
    try {
        console.log('🔄 Iniciando backup do banco de dados...\n');
        
        // Criar diretório de backups se não existir
        const backupDir = join(process.cwd(), 'backups');
        if (!existsSync(backupDir)) {
            mkdirSync(backupDir, { recursive: true });
            console.log('📁 Diretório de backups criado\n');
        }
        
        // Nome do arquivo de backup com timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFile = join(backupDir, `pornx_backup_${timestamp}.sql`);
        
        // Configurações do banco
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = process.env.DB_PORT || '5432';
        const dbName = process.env.DB_NAME || 'pornx_db';
        const dbUser = process.env.DB_USER || 'postgres';
        const dbPassword = process.env.DB_PASSWORD || 'postgres';
        
        console.log('📊 Configurações do backup:');
        console.log(`   Host: ${dbHost}`);
        console.log(`   Porta: ${dbPort}`);
        console.log(`   Banco: ${dbName}`);
        console.log(`   Usuário: ${dbUser}`);
        console.log(`   Arquivo: ${backupFile}\n`);
        
        // Comando pg_dump
        const command = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p -f "${backupFile}"`;
        
        console.log('⏳ Executando backup...\n');
        
        // Definir senha como variável de ambiente
        const env = { ...process.env, PGPASSWORD: dbPassword };
        
        await execAsync(command, { env });
        
        console.log('✅ Backup concluído com sucesso!\n');
        console.log('📄 Arquivo de backup:');
        console.log(`   ${backupFile}\n`);
        console.log('📋 Próximos passos:');
        console.log('   1. Copie o arquivo de backup para sua VPS');
        console.log('   2. Use o script restore-database.js para importar\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro ao fazer backup:', error.message);
        console.error('\n💡 Certifique-se de que:');
        console.error('   - PostgreSQL está instalado e pg_dump está disponível');
        console.error('   - As credenciais do banco estão corretas no .env');
        console.error('   - O banco de dados está acessível\n');
        process.exit(1);
    }
}

backupDatabase();
