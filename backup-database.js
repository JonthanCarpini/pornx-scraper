import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import pool from './src/database/db.js';

dotenv.config();

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
        
        console.log('📊 Configurações do backup:');
        console.log(`   Banco: ${process.env.DB_NAME || 'pornx_db'}`);
        console.log(`   Arquivo: ${backupFile}\n`);
        
        let sqlDump = '-- PornX Database Backup\n';
        sqlDump += `-- Data: ${new Date().toISOString()}\n\n`;
        sqlDump += 'BEGIN;\n\n';
        
        // Lista de tabelas para backup
        const tables = [
            'models',
            'videos',
            'clubeadulto_models',
            'clubeadulto_videos'
        ];
        
        console.log('⏳ Exportando dados...\n');
        
        for (const table of tables) {
            console.log(`   📋 Exportando tabela: ${table}`);
            
            // Obter estrutura da tabela
            const schemaResult = await pool.query(`
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            
            if (schemaResult.rows.length === 0) {
                console.log(`      ⚠️  Tabela ${table} não encontrada, pulando...`);
                continue;
            }
            
            // Obter dados da tabela
            const dataResult = await pool.query(`SELECT * FROM ${table}`);
            
            if (dataResult.rows.length > 0) {
                sqlDump += `-- Dados da tabela: ${table}\n`;
                sqlDump += `-- Total de registros: ${dataResult.rows.length}\n\n`;
                
                // Desabilitar triggers temporariamente
                sqlDump += `ALTER TABLE ${table} DISABLE TRIGGER ALL;\n`;
                
                // Inserir dados em lotes
                const columns = schemaResult.rows.map(r => r.column_name);
                
                for (const row of dataResult.rows) {
                    const values = columns.map(col => {
                        const value = row[col];
                        if (value === null) return 'NULL';
                        if (typeof value === 'number') return value;
                        if (typeof value === 'boolean') return value;
                        if (value instanceof Date) return `'${value.toISOString()}'`;
                        // Escapar aspas simples
                        return `'${String(value).replace(/'/g, "''")}'`;
                    });
                    
                    sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
                }
                
                // Reabilitar triggers
                sqlDump += `ALTER TABLE ${table} ENABLE TRIGGER ALL;\n\n`;
                
                console.log(`      ✅ ${dataResult.rows.length} registros exportados`);
            } else {
                console.log(`      ℹ️  Tabela vazia`);
            }
        }
        
        // Atualizar sequences
        sqlDump += '\n-- Atualizar sequences\n';
        for (const table of tables) {
            sqlDump += `SELECT setval('${table}_id_seq', (SELECT MAX(id) FROM ${table}), true);\n`;
        }
        
        sqlDump += '\nCOMMIT;\n';
        
        // Salvar arquivo
        writeFileSync(backupFile, sqlDump, 'utf8');
        
        console.log('\n✅ Backup concluído com sucesso!\n');
        console.log('📄 Arquivo de backup:');
        console.log(`   ${backupFile}\n`);
        console.log('📊 Estatísticas:');
        console.log(`   Tamanho: ${(sqlDump.length / 1024).toFixed(2)} KB\n`);
        console.log('📋 Próximos passos:');
        console.log('   1. Copie o arquivo de backup para sua VPS');
        console.log('   2. Use o script restore-database.js para importar\n');
        
        await pool.end();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro ao fazer backup:', error.message);
        console.error('\nDetalhes:', error);
        await pool.end();
        process.exit(1);
    }
}

backupDatabase();
