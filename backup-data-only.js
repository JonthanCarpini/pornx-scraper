import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import pool from './src/database/db.js';

dotenv.config();

async function backupDataOnly() {
    try {
        console.log('🔄 Iniciando backup apenas dos dados (sem transações)...\n');
        
        const backupDir = join(process.cwd(), 'backups');
        if (!existsSync(backupDir)) {
            mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFile = join(backupDir, `pornx_data_only_${timestamp}.sql`);
        
        let sqlDump = '-- PornX Database Backup (Data Only - No Transactions)\n';
        sqlDump += `-- Data: ${new Date().toISOString()}\n\n`;
        sqlDump += '-- Desabilitar triggers temporariamente\n';
        sqlDump += 'SET session_replication_role = replica;\n\n';
        
        const tables = ['models', 'videos', 'clubeadulto_models', 'clubeadulto_videos'];
        
        console.log('⏳ Exportando dados...\n');
        
        for (const table of tables) {
            console.log(`   📋 Exportando tabela: ${table}`);
            
            const result = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
            
            if (result.rows.length === 0) {
                console.log(`      ⚠️  Tabela vazia\n`);
                continue;
            }
            
            sqlDump += `-- Dados da tabela: ${table}\n`;
            sqlDump += `-- Total de registros: ${result.rows.length}\n\n`;
            
            const columns = Object.keys(result.rows[0]);
            
            for (const row of result.rows) {
                const values = columns.map(col => {
                    const value = row[col];
                    if (value === null) return 'NULL';
                    if (typeof value === 'boolean') return value ? 'true' : 'false';
                    if (typeof value === 'number') return value;
                    if (value instanceof Date) return `'${value.toISOString()}'`;
                    return `'${String(value).replace(/'/g, "''")}'`;
                });
                
                sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            
            sqlDump += '\n';
            console.log(`      ✓ ${result.rows.length} registros exportados\n`);
        }
        
        sqlDump += '-- Reabilitar triggers\n';
        sqlDump += 'SET session_replication_role = DEFAULT;\n';
        
        writeFileSync(backupFile, sqlDump, 'utf8');
        
        console.log('✅ Backup concluído com sucesso!\n');
        console.log(`📁 Arquivo: ${backupFile}`);
        console.log(`📊 Tamanho: ${(sqlDump.length / 1024 / 1024).toFixed(2)} MB\n`);
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao fazer backup:', error);
        await pool.end();
        process.exit(1);
    }
}

backupDataOnly();
