import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import cookieParser from 'cookie-parser';
import pool from './database/db.js';
import authRoutes from './routes/auth.js';
import userAuthRoutes from './routes/user-auth.js';
import adminUsersRoutes from './routes/admin-users.js';
import favoritesRoutes from './routes/favorites.js';
import followsRoutes from './routes/follows.js';
import commentsRoutes from './routes/comments.js';
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FALLBACK_PORT = 3001;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas de autenticação (não protegidas)
app.use('/api/admin', authRoutes);
app.use('/api/auth', userAuthRoutes);

// Rotas admin (protegidas)
app.use('/api/admin', adminUsersRoutes);

// Rotas de usuários (protegidas)
app.use('/api/favorites', favoritesRoutes);
app.use('/api/follows', followsRoutes);
app.use('/api/comments', commentsRoutes);

const ADMIN_DB_ALLOWED_TABLES = [
    'xxxfollow_models',
    'clubeadulto_models',
    'models',
    'xxxfollow_videos',
    'clubeadulto_videos',
    'videos'
];

function isValidIdentifier(value) {
    return typeof value === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function ensureAllowedTable(table) {
    if (!isValidIdentifier(table) || !ADMIN_DB_ALLOWED_TABLES.includes(table)) {
        const error = new Error('Tabela não permitida');
        error.statusCode = 400;
        throw error;
    }
}

async function getTableColumns(table) {
    ensureAllowedTable(table);

    const result = await pool.query(
        `SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position`,
        [table]
    );

    return result.rows;
}

// ========================================
// ADMIN DB - Introspecção e CRUD genérico
// ========================================

app.get('/api/admin/db/tables', authenticateToken, async (req, res) => {
    try {
        const kind = req.query.kind;

        const existingTablesResult = await pool.query(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = ANY($1::text[])
             ORDER BY table_name`,
            [ADMIN_DB_ALLOWED_TABLES]
        );

        let tables = existingTablesResult.rows.map(r => r.table_name);

        if (kind === 'models') {
            tables = tables.filter(t => t.endsWith('_models'));
        }
        if (kind === 'videos') {
            tables = tables.filter(t => t.endsWith('_videos'));
        }

        res.json({ tables });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.get('/api/admin/db/columns', authenticateToken, async (req, res) => {
    try {
        const table = req.query.table;
        const columns = await getTableColumns(table);

        if (!columns || columns.length === 0) {
            return res.status(404).json({ error: 'Tabela não encontrada ou sem colunas' });
        }

        res.json({ table, columns });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.get('/api/admin/db/rows', authenticateToken, async (req, res) => {
    try {
        const table = req.query.table;
        ensureAllowedTable(table);

        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;

        const q = (req.query.q || '').toString().trim();
        const filterColumn = req.query.filterColumn;
        const filterValueRaw = req.query.filterValue;
        const videoFormat = req.query.videoFormat;

        const columns = await getTableColumns(table);
        if (!columns || columns.length === 0) {
            return res.status(404).json({ error: 'Tabela não encontrada ou sem colunas' });
        }

        const columnNames = new Set(columns.map(c => c.column_name));
        const whereParts = [];
        const whereParams = [];

        if (filterColumn !== undefined || filterValueRaw !== undefined) {
            if (!isValidIdentifier(filterColumn) || !columnNames.has(filterColumn)) {
                return res.status(400).json({ error: 'filterColumn inválido' });
            }
            whereParts.push(`"${filterColumn}" = $${whereParams.length + 1}`);
            whereParams.push(filterValueRaw);
        }

        if (q) {
            const textColumns = columns
                .filter(c => ['text', 'character varying', 'character'].includes(c.data_type))
                .map(c => c.column_name);

            if (textColumns.length > 0) {
                const qParamIndex = whereParams.length + 1;
                const orParts = textColumns.map(col => `"${col}" ILIKE $${qParamIndex}`);
                whereParts.push(`(${orParts.join(' OR ')})`);
                whereParams.push(`%${q}%`);
            }
        }

        if (videoFormat && table.endsWith('_videos')) {
            if (videoFormat === 'mp4') {
                whereParts.push(`("video_url" IS NOT NULL AND "video_url" != '' AND ("m3u8_url" IS NULL OR "m3u8_url" = ''))`);
            } else if (videoFormat === 'm3u8') {
                whereParts.push(`("m3u8_url" IS NOT NULL AND "m3u8_url" != '')`);
            }
        }

        const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM "${table}" ${whereClause}`,
            whereParams
        );
        const total = parseInt(countResult.rows[0].count);

        const rowsResult = await pool.query(
            `SELECT *
             FROM "${table}"
             ${whereClause}
             ORDER BY 1 DESC
             LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
            [...whereParams, limit, offset]
        );

        res.json({
            table,
            rows: rowsResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.post('/api/admin/db/rows', authenticateToken, async (req, res) => {
    try {
        const table = req.query.table;
        ensureAllowedTable(table);

        const data = req.body?.data;
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Body inválido' });
        }

        const columns = await getTableColumns(table);
        const allowedColumns = new Set(columns.map(c => c.column_name));

        const keys = Object.keys(data).filter(k => isValidIdentifier(k) && allowedColumns.has(k));
        if (keys.length === 0) {
            return res.status(400).json({ error: 'Nenhuma coluna válida para inserir' });
        }

        const colList = keys.map(k => `"${k}"`).join(', ');
        const valuesList = keys.map((_, i) => `$${i + 1}`).join(', ');
        const values = keys.map(k => data[k]);

        const insertResult = await pool.query(
            `INSERT INTO "${table}" (${colList})
             VALUES (${valuesList})
             RETURNING *`,
            values
        );

        res.json({ table, row: insertResult.rows[0] });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.put('/api/admin/db/rows', authenticateToken, async (req, res) => {
    try {
        const table = req.query.table;
        ensureAllowedTable(table);

        const pkColumn = req.body?.pkColumn;
        const pkValue = req.body?.pkValue;
        const updates = req.body?.updates;

        if (!isValidIdentifier(pkColumn)) {
            return res.status(400).json({ error: 'pkColumn inválido' });
        }
        if (pkValue === undefined || pkValue === null) {
            return res.status(400).json({ error: 'pkValue obrigatório' });
        }
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'updates inválido' });
        }

        const columns = await getTableColumns(table);
        const allowedColumns = new Set(columns.map(c => c.column_name));
        if (!allowedColumns.has(pkColumn)) {
            return res.status(400).json({ error: 'pkColumn não existe na tabela' });
        }

        const keys = Object.keys(updates).filter(k => isValidIdentifier(k) && allowedColumns.has(k) && k !== pkColumn);
        if (keys.length === 0) {
            return res.status(400).json({ error: 'Nenhuma coluna válida para atualizar' });
        }

        const setParts = keys.map((k, i) => `"${k}" = $${i + 1}`);
        const params = keys.map(k => updates[k]);
        params.push(pkValue);

        const updateResult = await pool.query(
            `UPDATE "${table}"
             SET ${setParts.join(', ')}
             WHERE "${pkColumn}" = $${params.length}
             RETURNING *`,
            params
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Registro não encontrado' });
        }

        res.json({ table, row: updateResult.rows[0] });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

app.delete('/api/admin/db/rows', authenticateToken, async (req, res) => {
    try {
        const table = req.query.table;
        ensureAllowedTable(table);

        const pkColumn = req.query.pkColumn;
        const pkValue = req.query.pkValue;

        if (!isValidIdentifier(pkColumn)) {
            return res.status(400).json({ error: 'pkColumn inválido' });
        }
        if (pkValue === undefined || pkValue === null) {
            return res.status(400).json({ error: 'pkValue obrigatório' });
        }

        const columns = await getTableColumns(table);
        const allowedColumns = new Set(columns.map(c => c.column_name));
        if (!allowedColumns.has(pkColumn)) {
            return res.status(400).json({ error: 'pkColumn não existe na tabela' });
        }

        const deleteResult = await pool.query(
            `DELETE FROM "${table}"
             WHERE "${pkColumn}" = $1`,
            [pkValue]
        );

        res.json({ table, deletedCount: deleteResult.rowCount });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

let scrapingProcess = null;
let scrapingLogs = [];

app.get('/api/models', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search;
        
        let whereClause = '';
        let params = [limit, offset];
        
        if (search) {
            whereClause = 'WHERE name ILIKE $3';
            params.push(`%${search}%`);
        }
        
        const countResult = await pool.query(`SELECT COUNT(*) FROM models ${whereClause}`, search ? [params[2]] : []);
        const totalModels = parseInt(countResult.rows[0].count);
        
        const modelsResult = await pool.query(`
            SELECT 
                id,
                name,
                profile_url,
                cover_url,
                video_count,
                created_at,
                updated_at
            FROM models
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, params);
        
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_models
            FROM models
        `);
        
        res.json({
            success: true,
            data: {
                models: modelsResult.rows,
                pagination: {
                    page,
                    limit,
                    total: totalModels,
                    totalPages: Math.ceil(totalModels / limit)
                },
                stats: statsResult.rows[0]
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/scrape/start', async (req, res) => {
    if (scrapingProcess) {
        return res.status(400).json({
            success: false,
            error: 'Scraping já está em execução'
        });
    }
    
    const { pages = 5, useDatabase = true } = req.body;
    
    if (useDatabase) {
        try {
            await pool.query('SELECT 1');
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'Banco de dados não está configurado ou não está acessível. Use scrape:json ou configure o PostgreSQL.',
                details: error.message
            });
        }
    }
    
    scrapingLogs = [];
    
    const scriptPath = useDatabase ? 
        path.join(__dirname, 'scraper.js') : 
        path.join(__dirname, 'scraper-json.js');
    
    scrapingProcess = spawn('node', [scriptPath, pages.toString()], {
        cwd: path.join(__dirname, '..')
    });
    
    scrapingProcess.stdout.on('data', (data) => {
        const log = data.toString();
        scrapingLogs.push({ type: 'info', message: log, timestamp: new Date() });
        console.log(log);
    });
    
    scrapingProcess.stderr.on('data', (data) => {
        const log = data.toString();
        scrapingLogs.push({ type: 'error', message: log, timestamp: new Date() });
        console.error(log);
    });
    
    scrapingProcess.on('close', (code) => {
        scrapingLogs.push({ 
            type: code === 0 ? 'success' : 'error', 
            message: `Scraping finalizado com código ${code}`,
            timestamp: new Date()
        });
        scrapingProcess = null;
    });
    
    res.json({
        success: true,
        message: `Scraping iniciado para ${pages} página(s)`,
        useDatabase
    });
});

app.get('/api/scrape/status', (req, res) => {
    res.json({
        success: true,
        isRunning: scrapingProcess !== null,
        logs: scrapingLogs.slice(-50)
    });
});

app.get('/api/scrape/logs', (req, res) => {
    res.json({
        success: true,
        logs: scrapingLogs
    });
});

app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_models,
                MAX(created_at) as last_scrape
            FROM models
        `);
        
        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.delete('/api/models/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM models WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Modelo removida com sucesso'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/videos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 24;
        const offset = (page - 1) * limit;
        const modelId = req.query.model_id;
        const search = req.query.search;
        
        let whereConditions = [];
        let countParams = [];
        let queryParams = [];
        
        if (modelId) {
            whereConditions.push(`v.model_id = $${countParams.length + 1}`);
            countParams.push(modelId);
            queryParams.push(modelId);
        }
        
        if (search) {
            whereConditions.push(`v.title ILIKE $${countParams.length + 1}`);
            countParams.push(`%${search}%`);
            queryParams.push(`%${search}%`);
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        
        const countResult = await pool.query(`SELECT COUNT(*) FROM videos v ${whereClause}`, countParams);
        const totalVideos = parseInt(countResult.rows[0].count);
        
        const finalQueryParams = [...queryParams, limit, offset];
        const limitOffset = `LIMIT $${finalQueryParams.length - 1} OFFSET $${finalQueryParams.length}`;
        
        const videosResult = await pool.query(`
            SELECT 
                v.id,
                v.title,
                v.video_url,
                v.thumbnail_url,
                v.poster_url,
                v.video_source_url,
                v.created_at,
                m.name as model_name,
                m.id as model_id
            FROM videos v
            JOIN models m ON v.model_id = m.id
            ${whereClause}
            ORDER BY v.created_at DESC
            ${limitOffset}
        `, finalQueryParams);
        
        const statsResult = await pool.query(`
            SELECT 
                COUNT(DISTINCT v.id) as total_videos,
                COUNT(DISTINCT v.model_id) as models_with_videos
            FROM videos v
        `);
        
        res.json({
            success: true,
            data: {
                videos: videosResult.rows,
                pagination: {
                    page,
                    limit,
                    total: totalVideos,
                    totalPages: Math.ceil(totalVideos / limit)
                },
                stats: statsResult.rows[0]
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/videos/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_models,
                COALESCE(SUM(video_count), 0) as total_videos,
                COUNT(CASE WHEN video_count > 0 THEN 1 END) as models_with_videos
            FROM models
        `);
        
        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

let videoScrapingProcess = null;
let videoScrapingStatus = {
    isRunning: false,
    processed: 0,
    total: 0,
    currentModel: null,
    lastResult: null,
    totalVideos: 0
};

app.post('/api/videos/scrape', async (req, res) => {
    try {
        if (videoScrapingProcess) {
            return res.status(400).json({
                success: false,
                error: 'Scraping já está em execução'
            });
        }
        
        const { mode, modelId } = req.body;
        
        let modelsQuery = 'SELECT id, name, profile_url FROM models';
        let params = [];
        
        if (mode === 'single' && modelId) {
            modelsQuery += ' WHERE id = $1';
            params = [modelId];
        } else if (mode === 'pending') {
            modelsQuery += ' WHERE video_count = 0 OR video_count IS NULL';
        }
        
        const modelsResult = await pool.query(modelsQuery, params);
        const models = modelsResult.rows;
        
        if (models.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma modelo encontrada para processar'
            });
        }
        
        videoScrapingStatus = {
            isRunning: true,
            processed: 0,
            total: models.length,
            currentModel: null,
            lastResult: null,
            totalVideos: 0
        };
        
        processVideoScraping(models);
        
        res.json({
            success: true,
            message: 'Scraping de vídeos iniciado',
            modelsCount: models.length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function processVideoScraping(models) {
    for (const model of models) {
        videoScrapingStatus.currentModel = model.name;
        
        await new Promise((resolve) => {
            const scraper = spawn('node', ['src/video-scraper.js', model.id], {
                cwd: path.join(__dirname, '..')
            });
            
            let output = '';
            
            scraper.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            scraper.stderr.on('data', (data) => {
                console.error('Erro no scraper:', data.toString());
            });
            
            scraper.on('close', (code) => {
                const videosMatch = output.match(/(\d+) novos/);
                const videosSaved = videosMatch ? parseInt(videosMatch[1]) : 0;
                
                videoScrapingStatus.processed++;
                videoScrapingStatus.lastResult = {
                    modelName: model.name,
                    videosSaved
                };
                videoScrapingStatus.totalVideos += videosSaved;
                
                console.log(`[${videoScrapingStatus.processed}/${videoScrapingStatus.total}] ${model.name}: ${videosSaved} vídeos`);
                
                resolve();
            });
            
            scraper.on('error', (error) => {
                console.error('Erro ao executar scraper:', error);
                videoScrapingStatus.processed++;
                resolve();
            });
        });
    }
    
    videoScrapingStatus.isRunning = false;
    console.log('✅ Scraping de vídeos concluído!');
}

app.get('/api/videos/scrape/status', (req, res) => {
    res.json({
        success: true,
        status: videoScrapingStatus
    });
});

// Endpoint para buscar modelo por ID
app.get('/api/models/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                id,
                name,
                profile_url,
                cover_url,
                video_count,
                created_at,
                updated_at
            FROM models
            WHERE id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Modelo não encontrada'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para buscar vídeo por ID
app.get('/api/videos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                v.id,
                v.title,
                v.video_url,
                v.thumbnail_url,
                v.poster_url,
                v.video_source_url,
                v.created_at,
                m.name as model_name,
                m.id as model_id
            FROM videos v
            JOIN models m ON v.model_id = m.id
            WHERE v.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vídeo não encontrado'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Estatísticas para admin scraper
app.get('/api/admin/scraping-stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_models,
                COALESCE(SUM(video_count), 0) as total_videos,
                COUNT(CASE WHEN video_count > 0 THEN 1 END) as models_with_videos,
                (SELECT COUNT(*) FROM videos WHERE poster_url IS NOT NULL AND video_source_url IS NOT NULL) as videos_with_details
            FROM models
        `);
        
        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Scraping de modelos (Passo 1)
let modelsScrapingStatus = {
    isRunning: false,
    processed: 0,
    total: 0,
    lastResult: null,
    totalModels: 0
};

app.post('/api/scraping/models', async (req, res) => {
    try {
        if (modelsScrapingStatus.isRunning) {
            return res.status(400).json({
                success: false,
                error: 'Scraping de modelos já está em execução'
            });
        }
        
        const { pageFrom = 1, pageTo = 5 } = req.body;
        const pagesCount = pageTo - pageFrom + 1;
        
        if (pageFrom < 1 || pageTo < 1 || pageFrom > pageTo) {
            return res.status(400).json({
                success: false,
                error: 'Intervalo de páginas inválido'
            });
        }
        
        modelsScrapingStatus = {
            isRunning: true,
            processed: 0,
            total: pagesCount,
            lastResult: null,
            totalModels: 0
        };
        
        processModelsScrapingAsync(pageFrom, pageTo);
        
        res.json({
            success: true,
            message: 'Scraping de modelos iniciado',
            pagesCount: pagesCount,
            pageFrom,
            pageTo
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function processModelsScrapingAsync(pageFrom, pageTo) {
    const scraper = spawn('node', ['src/scraper.js', pageFrom.toString(), pageTo.toString()], {
        cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    
    scraper.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
        
        const pageMatch = output.match(/Página (\d+)\/(\d+)/);
        if (pageMatch) {
            const currentPage = parseInt(pageMatch[1]);
            modelsScrapingStatus.processed = currentPage - pageFrom + 1;
        }
        const modelsMatch = output.match(/(\d+) novas/);
        if (modelsMatch) {
            modelsScrapingStatus.lastResult = {
                modelsSaved: parseInt(modelsMatch[1])
            };
        }
    });
    
    scraper.stderr.on('data', (data) => {
        console.error('Erro no scraper:', data.toString());
    });
    
    scraper.on('close', () => {
        const totalMatch = output.match(/Total de modelos salvas: (\d+)/);
        modelsScrapingStatus.totalModels = totalMatch ? parseInt(totalMatch[1]) : 0;
        modelsScrapingStatus.isRunning = false;
        console.log('✅ Scraping de modelos concluído!');
    });
    
    scraper.on('error', (error) => {
        console.error('Erro ao executar scraper:', error);
        modelsScrapingStatus.isRunning = false;
    });
}

app.get('/api/scraping/models/status', (req, res) => {
    res.json({
        success: true,
        status: modelsScrapingStatus
    });
});

// Scraping de detalhes dos vídeos (Passo 3)
let videoDetailsScrapingStatus = {
    isRunning: false,
    processed: 0,
    total: 0,
    lastResult: null,
    successCount: 0
};

app.post('/api/scraping/video-details', async (req, res) => {
    try {
        if (videoDetailsScrapingStatus.isRunning) {
            return res.status(400).json({
                success: false,
                error: 'Scraping de detalhes já está em execução'
            });
        }
        
        const result = await pool.query(`
            SELECT COUNT(*) FROM videos 
            WHERE poster_url IS NULL OR video_source_url IS NULL
        `);
        const videosCount = parseInt(result.rows[0].count);
        
        if (videosCount === 0) {
            return res.status(400).json({
                success: false,
                error: 'Todos os vídeos já possuem detalhes coletados'
            });
        }
        
        videoDetailsScrapingStatus = {
            isRunning: true,
            processed: 0,
            total: videosCount,
            lastResult: null,
            successCount: 0
        };
        
        processVideoDetailsScrapingAsync();
        
        res.json({
            success: true,
            message: 'Scraping de detalhes iniciado',
            videosCount
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function processVideoDetailsScrapingAsync() {
    const scraper = spawn('node', ['src/video-details-scraper.js'], {
        cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    let lastVideoTitle = '';
    let lastPosterUrl = '';
    let lastSourceUrl = '';
    
    scraper.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log(chunk);
        
        const progressMatch = chunk.match(/\[(\d+)\/(\d+)\]/);
        if (progressMatch) {
            videoDetailsScrapingStatus.processed = parseInt(progressMatch[1]);
            videoDetailsScrapingStatus.total = parseInt(progressMatch[2]);
        }
        
        const titleMatch = chunk.match(/🎬 Scraping detalhes: (.+)/);
        if (titleMatch) {
            lastVideoTitle = titleMatch[1];
        }
        
        const posterMatch = chunk.match(/✓ Poster URL: (.+)/);
        if (posterMatch) {
            lastPosterUrl = posterMatch[1];
        }
        
        const sourceMatch = chunk.match(/✓ Source URL: (.+)/);
        if (sourceMatch) {
            lastSourceUrl = sourceMatch[1];
        }
        
        const savedMatch = chunk.match(/✅ Detalhes salvos no banco de dados/);
        if (savedMatch && (lastPosterUrl || lastSourceUrl)) {
            videoDetailsScrapingStatus.lastResult = {
                success: true,
                title: lastVideoTitle,
                posterUrl: lastPosterUrl,
                sourceUrl: lastSourceUrl
            };
            videoDetailsScrapingStatus.successCount++;
        }
        
        const successMatch = output.match(/Sucesso: (\d+)/);
        if (successMatch) {
            videoDetailsScrapingStatus.successCount = parseInt(successMatch[1]);
        }
    });
    
    scraper.stderr.on('data', (data) => {
        console.error('Erro no scraper de detalhes:', data.toString());
    });
    
    scraper.on('close', (code) => {
        videoDetailsScrapingStatus.isRunning = false;
        console.log('✅ Scraping de detalhes concluído!');
    });
    
    scraper.on('error', (error) => {
        console.error('Erro ao executar scraper de detalhes:', error);
        videoDetailsScrapingStatus.isRunning = false;
    });
}

app.get('/api/scraping/video-details/status', (req, res) => {
    res.json({
        success: true,
        status: videoDetailsScrapingStatus
    });
});

// ========================================
// CLUBE ADULTO - APIs
// ========================================

// Listar modelos Clube Adulto
app.get('/api/clubeadulto/models', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search;
        
        let whereClause = '';
        let params = [limit, offset];
        
        if (search) {
            whereClause = 'WHERE name ILIKE $3';
            params.push(`%${search}%`);
        }
        
        const countResult = await pool.query(`SELECT COUNT(*) FROM clubeadulto_models ${whereClause}`, search ? [params[2]] : []);
        const totalModels = parseInt(countResult.rows[0].count);
        
        const modelsResult = await pool.query(`
            SELECT 
                id,
                name,
                slug,
                profile_url,
                cover_url,
                video_count,
                created_at,
                updated_at
            FROM clubeadulto_models
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, params);
        
        res.json({
            success: true,
            data: {
                models: modelsResult.rows,
                pagination: {
                    page,
                    limit,
                    total: totalModels,
                    totalPages: Math.ceil(totalModels / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar modelo por ID - Clube Adulto
app.get('/api/clubeadulto/models/:id', async (req, res) => {
    try {
        const modelId = req.params.id;
        
        const result = await pool.query(`
            SELECT 
                id,
                name,
                slug,
                profile_url,
                cover_url,
                video_count,
                created_at,
                updated_at
            FROM clubeadulto_models
            WHERE id = $1
        `, [modelId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Modelo não encontrada'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Listar vídeos por modelo - Clube Adulto
app.get('/api/clubeadulto/videos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const modelId = req.query.model_id;
        const search = req.query.search;
        
        // Construir WHERE clause e parâmetros
        let whereClause = '';
        let countParams = [];
        let queryParams = [];
        
        if (modelId) {
            whereClause = 'WHERE v.model_id = $1';
            countParams.push(parseInt(modelId));
            queryParams.push(parseInt(modelId));
        }
        
        if (search) {
            const paramNum = modelId ? 2 : 1;
            whereClause += (whereClause ? ' AND' : 'WHERE') + ` v.title ILIKE $${paramNum}`;
            countParams.push(`%${search}%`);
            queryParams.push(`%${search}%`);
        }
        
        // Query de contagem
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM clubeadulto_videos v ${whereClause}`,
            countParams
        );
        const totalVideos = parseInt(countResult.rows[0].count);
        
        // Adicionar limit e offset no final
        const limitParamNum = queryParams.length + 1;
        const offsetParamNum = queryParams.length + 2;
        queryParams.push(limit, offset);
        
        // Query principal
        const videosResult = await pool.query(`
            SELECT 
                v.id,
                v.title,
                v.video_url,
                v.thumbnail_url,
                v.poster_url,
                v.m3u8_url,
                v.duration,
                v.created_at,
                m.name as model_name,
                m.id as model_id
            FROM clubeadulto_videos v
            LEFT JOIN clubeadulto_models m ON v.model_id = m.id
            ${whereClause}
            ORDER BY v.created_at DESC
            LIMIT $${limitParamNum} OFFSET $${offsetParamNum}
        `, queryParams);
        
        res.json({
            success: true,
            data: {
                videos: videosResult.rows,
                pagination: {
                    page,
                    limit,
                    total: totalVideos,
                    totalPages: Math.ceil(totalVideos / limit)
                }
            }
        });
    } catch (error) {
        console.error('Erro no endpoint /api/clubeadulto/videos:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar vídeo por ID - Clube Adulto
app.get('/api/clubeadulto/videos/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        
        const result = await pool.query(`
            SELECT 
                v.id,
                v.title,
                v.video_url,
                v.thumbnail_url,
                v.poster_url,
                v.m3u8_url,
                v.duration,
                v.created_at,
                m.name as model_name,
                m.id as model_id
            FROM clubeadulto_videos v
            LEFT JOIN clubeadulto_models m ON v.model_id = m.id
            WHERE v.id = $1
        `, [videoId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vídeo não encontrado'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Estatísticas Clube Adulto
app.get('/api/clubeadulto/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_models,
                COALESCE(SUM(video_count), 0) as total_videos,
                (SELECT COUNT(*) FROM clubeadulto_videos WHERE poster_url IS NOT NULL AND m3u8_url IS NOT NULL) as videos_with_details
            FROM clubeadulto_models
        `);
        
        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Scraping de modelos Clube Adulto (Passo 1)
let clubeadultoModelsScrapingStatus = {
    isRunning: false,
    processed: 0,
    total: 0,
    lastResult: null,
    totalModels: 0
};

app.post('/api/clubeadulto/scraping/models', async (req, res) => {
    try {
        if (clubeadultoModelsScrapingStatus.isRunning) {
            return res.status(400).json({
                success: false,
                error: 'Scraping de modelos do Clube Adulto já está em execução'
            });
        }
        
        const { pageFrom = 1, pageTo = 5 } = req.body;
        const pagesCount = pageTo - pageFrom + 1;
        
        if (pageFrom < 1 || pageTo < 1 || pageFrom > pageTo) {
            return res.status(400).json({
                success: false,
                error: 'Intervalo de páginas inválido'
            });
        }
        
        clubeadultoModelsScrapingStatus = {
            isRunning: true,
            processed: 0,
            total: pagesCount,
            lastResult: null,
            totalModels: 0
        };
        
        processClubAdultoModelsScrapingAsync(pageFrom, pageTo);
        
        res.json({
            success: true,
            message: 'Scraping de modelos iniciado',
            pagesCount: pagesCount,
            pageFrom,
            pageTo
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function processClubAdultoModelsScrapingAsync(pageFrom, pageTo) {
    const scraper = spawn('node', ['src/clubeadulto-models-scraper.js', pageFrom.toString(), pageTo.toString()], {
        cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    
    scraper.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
        
        const pageMatch = output.match(/Página (\d+)\/(\d+)/);
        if (pageMatch) {
            const currentPage = parseInt(pageMatch[1]);
            clubeadultoModelsScrapingStatus.processed = currentPage - pageFrom + 1;
        }
        const modelsMatch = output.match(/(\d+) novas/);
        if (modelsMatch) {
            clubeadultoModelsScrapingStatus.lastResult = {
                modelsSaved: parseInt(modelsMatch[1])
            };
        }
    });
    
    scraper.stderr.on('data', (data) => {
        console.error('Erro no scraper CA:', data.toString());
    });
    
    scraper.on('close', () => {
        const totalMatch = output.match(/Total de modelos salvas: (\d+)/);
        clubeadultoModelsScrapingStatus.totalModels = totalMatch ? parseInt(totalMatch[1]) : 0;
        clubeadultoModelsScrapingStatus.isRunning = false;
        console.log('✅ Scraping de modelos CA concluído!');
    });
    
    scraper.on('error', (error) => {
        console.error('Erro ao executar scraper CA:', error);
        clubeadultoModelsScrapingStatus.isRunning = false;
    });
}

app.get('/api/clubeadulto/scraping/models/status', (req, res) => {
    res.json({
        success: true,
        status: clubeadultoModelsScrapingStatus
    });
});

// Scraping de vídeos Clube Adulto (Passo 2)
let clubeadultoVideosScrapingStatus = {
    isRunning: false,
    processed: 0,
    total: 0,
    currentModel: '',
    lastResult: null,
    totalVideos: 0
};

app.post('/api/clubeadulto/scraping/videos', async (req, res) => {
    try {
        if (clubeadultoVideosScrapingStatus.isRunning) {
            return res.status(400).json({
                success: false,
                error: 'Scraping de vídeos do Clube Adulto já está em execução'
            });
        }
        
        const result = await pool.query('SELECT COUNT(*) FROM clubeadulto_models');
        const modelsCount = parseInt(result.rows[0].count);
        
        if (modelsCount === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma modelo encontrada. Execute o Passo 1 primeiro.'
            });
        }
        
        clubeadultoVideosScrapingStatus = {
            isRunning: true,
            processed: 0,
            total: modelsCount,
            currentModel: '',
            lastResult: null,
            totalVideos: 0
        };
        
        processClubAdultoVideosScrapingAsync();
        
        res.json({
            success: true,
            message: 'Scraping de vídeos iniciado',
            modelsCount
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function processClubAdultoVideosScrapingAsync() {
    const scraper = spawn('node', ['src/clubeadulto-videos-scraper.js'], {
        cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    
    scraper.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
        
        const progressMatch = output.match(/\[(\d+)\/(\d+)\]/);
        if (progressMatch) {
            clubeadultoVideosScrapingStatus.processed = parseInt(progressMatch[1]);
            clubeadultoVideosScrapingStatus.total = parseInt(progressMatch[2]);
        }
        
        const modelMatch = output.match(/Processando: (.+)/);
        if (modelMatch) {
            clubeadultoVideosScrapingStatus.currentModel = modelMatch[1];
        }
        
        const videosMatch = output.match(/(\d+) novos vídeos/);
        if (videosMatch) {
            clubeadultoVideosScrapingStatus.totalVideos += parseInt(videosMatch[1]);
        }
    });
    
    scraper.stderr.on('data', (data) => {
        console.error('Erro no scraper CA vídeos:', data.toString());
    });
    
    scraper.on('close', () => {
        clubeadultoVideosScrapingStatus.isRunning = false;
        console.log('✅ Scraping de vídeos CA concluído!');
    });
    
    scraper.on('error', (error) => {
        console.error('Erro ao executar scraper CA vídeos:', error);
        clubeadultoVideosScrapingStatus.isRunning = false;
    });
}

app.get('/api/clubeadulto/scraping/videos/status', (req, res) => {
    res.json({
        success: true,
        status: clubeadultoVideosScrapingStatus
    });
});

// Scraping de detalhes Clube Adulto (Passo 3)
let clubeadultoDetailsScrapingStatus = {
    isRunning: false,
    processed: 0,
    total: 0,
    lastResult: null,
    successCount: 0
};

app.post('/api/clubeadulto/scraping/video-details', async (req, res) => {
    try {
        if (clubeadultoDetailsScrapingStatus.isRunning) {
            return res.status(400).json({
                success: false,
                error: 'Scraping de detalhes do Clube Adulto já está em execução'
            });
        }
        
        const result = await pool.query(`
            SELECT COUNT(*) FROM clubeadulto_videos 
            WHERE poster_url IS NULL OR m3u8_url IS NULL
        `);
        const videosCount = parseInt(result.rows[0].count);
        
        if (videosCount === 0) {
            return res.status(400).json({
                success: false,
                error: 'Todos os vídeos já possuem detalhes coletados'
            });
        }
        
        clubeadultoDetailsScrapingStatus = {
            isRunning: true,
            processed: 0,
            total: videosCount,
            lastResult: null,
            successCount: 0
        };
        
        processClubAdultoDetailsScrapingAsync();
        
        res.json({
            success: true,
            message: 'Scraping de detalhes iniciado',
            videosCount
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function processClubAdultoDetailsScrapingAsync() {
    const scraper = spawn('node', ['src/clubeadulto-details-scraper.js'], {
        cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    let lastVideoTitle = '';
    let lastPosterUrl = '';
    let lastM3u8Url = '';
    
    scraper.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log(chunk);
        
        const progressMatch = chunk.match(/\[(\d+)\/(\d+)\]/);
        if (progressMatch) {
            clubeadultoDetailsScrapingStatus.processed = parseInt(progressMatch[1]);
            clubeadultoDetailsScrapingStatus.total = parseInt(progressMatch[2]);
        }
        
        const titleMatch = chunk.match(/🎬 Scraping detalhes: (.+)/);
        if (titleMatch) {
            lastVideoTitle = titleMatch[1];
        }
        
        const posterMatch = chunk.match(/✓ Poster URL: (.+)/);
        if (posterMatch) {
            lastPosterUrl = posterMatch[1];
        }
        
        const m3u8Match = chunk.match(/✓ M3U8 URL: (.+)/);
        if (m3u8Match) {
            lastM3u8Url = m3u8Match[1];
        }
        
        const savedMatch = chunk.match(/✅ Detalhes salvos no banco de dados/);
        if (savedMatch && (lastPosterUrl || lastM3u8Url)) {
            clubeadultoDetailsScrapingStatus.lastResult = {
                success: true,
                title: lastVideoTitle,
                posterUrl: lastPosterUrl,
                m3u8Url: lastM3u8Url
            };
            clubeadultoDetailsScrapingStatus.successCount++;
        }
    });
    
    scraper.stderr.on('data', (data) => {
        console.error('Erro no scraper CA detalhes:', data.toString());
    });
    
    scraper.on('close', () => {
        clubeadultoDetailsScrapingStatus.isRunning = false;
        console.log('✅ Scraping de detalhes CA concluído!');
    });
    
    scraper.on('error', (error) => {
        console.error('Erro ao executar scraper CA detalhes:', error);
        clubeadultoDetailsScrapingStatus.isRunning = false;
    });
}

app.get('/api/clubeadulto/scraping/video-details/status', (req, res) => {
    res.json({
        success: true,
        status: clubeadultoDetailsScrapingStatus
    });
});

// ========================================
// PROXY M3U8 - Contornar CORS
// ========================================

app.get('/api/proxy/m3u8', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).send('URL não fornecida');
        }
        
        console.log('🔄 Proxy M3U8:', url);
        
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://clubeadulto.net/',
                'Origin': 'https://clubeadulto.net',
                'Accept': '*/*'
            }
        });
        
        if (!response.ok) {
            console.error(`❌ Erro ao buscar M3U8: ${response.status} ${response.statusText}`);
            return res.status(response.status).send(`Erro ao buscar vídeo: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        console.log('📦 Content-Type:', contentType);
        
        // Se for um segmento de vídeo (.ts), apenas repassar os bytes
        if (contentType.includes('video') || contentType.includes('octet-stream') || url.endsWith('.ts')) {
            console.log('📹 Repassando segmento de vídeo (.ts)');
            const buffer = await response.arrayBuffer();
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', contentType || 'video/mp2t');
            res.send(Buffer.from(buffer));
            return;
        }
        
        // Caso contrário, processar como M3U8
        let content = await response.text();
        console.log('✅ M3U8 obtido, tamanho:', content.length);
        
        // Verificar se é realmente um M3U8 (texto)
        if (!content.includes('#EXTM3U')) {
            console.error('❌ Resposta não é um M3U8 válido');
            console.error('Primeiros 200 caracteres:', content.substring(0, 200));
            return res.status(500).send('Resposta não é um M3U8 válido');
        }
        
        // Reescrever URLs relativas para URLs absolutas proxiadas
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        console.log('📍 Base URL:', baseUrl);
        
        // Substituir URLs relativas por URLs proxiadas
        content = content.split('\n').map(line => {
            const trimmed = line.trim();
            
            // Preservar linhas de comentário (#) e vazias
            if (trimmed.startsWith('#') || trimmed === '') {
                return line;
            }
            
            // Se a linha é uma URL relativa (não começa com http:// ou https://)
            if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                const absoluteUrl = baseUrl + trimmed;
                const proxiedUrl = `/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}`;
                console.log(`🔄 Reescrevendo: ${trimmed} -> ${proxiedUrl}`);
                return proxiedUrl;
            }
            
            // URL absoluta - também precisa ser proxiada
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                const proxiedUrl = `/api/proxy/m3u8?url=${encodeURIComponent(trimmed)}`;
                console.log(`🔄 Proxiando URL absoluta: ${trimmed}`);
                return proxiedUrl;
            }
            
            return line;
        }).join('\n');
        
        // Adicionar headers CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        
        res.send(content);
        
    } catch (error) {
        console.error('❌ Erro no proxy M3U8:', error.message);
        res.status(500).send(`Erro no servidor proxy: ${error.message}`);
    }
});

// ========================================
// XXXFOLLOW - Endpoints
// ========================================

app.get('/api/xxxfollow/stats', async (req, res) => {
    try {
        const totalModels = await pool.query('SELECT COUNT(*) FROM xxxfollow_models');
        const totalVideos = await pool.query('SELECT COUNT(*) FROM xxxfollow_videos');
        const pendingModels = await pool.query('SELECT COUNT(*) FROM xxxfollow_models WHERE videos_scraped IS NULL OR videos_scraped = false');
        const videosToday = await pool.query("SELECT COUNT(*) FROM xxxfollow_videos WHERE DATE(created_at) = CURRENT_DATE");
        
        res.json({
            totalModels: parseInt(totalModels.rows[0].count),
            totalVideos: parseInt(totalVideos.rows[0].count),
            pendingModels: parseInt(pendingModels.rows[0].count),
            videosToday: parseInt(videosToday.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para todas as modelos dos 3 sites misturadas
app.get('/api/all-models', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        
        // Buscar modelos de todos os sites (XXXFollow e Clube Adulto)
        // NSFW247 será adicionado quando a tabela for criada
        const result = await pool.query(`
            SELECT * FROM (
                SELECT 
                    'xxxfollow' as source,
                    ('xxxfollow:' || m.id::text) as model_key,
                    m.id,
                    m.display_name as name,
                    m.username,
                    m.avatar_url as cover_url,
                    CONCAT('https://www.xxxfollow.com/', m.username) as profile_url,
                    m.view_count,
                    m.like_count,
                    COUNT(v.id) as video_count,
                    m.created_at
                FROM xxxfollow_models m
                LEFT JOIN xxxfollow_videos v ON m.id = v.model_id
                GROUP BY m.id, m.display_name, m.username, m.avatar_url, m.view_count, m.like_count, m.created_at, ('xxxfollow:' || m.id::text)
                
                UNION ALL
                
                SELECT 
                    'clubeadulto' as source,
                    ('clubeadulto:' || m.id::text) as model_key,
                    m.id,
                    m.name,
                    m.slug as username,
                    m.cover_url,
                    m.profile_url,
                    0 as view_count,
                    0 as like_count,
                    COALESCE(m.video_count, 0) as video_count,
                    m.created_at
                FROM clubeadulto_models m
            ) AS all_models
            ORDER BY RANDOM()
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        // Contar total de modelos
        const countResult = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM xxxfollow_models) +
                (SELECT COUNT(*) FROM clubeadulto_models) as total
        `);
        
        const totalModels = parseInt(countResult.rows[0].total);
        
        res.json({ 
            models: result.rows,
            pagination: {
                page,
                limit,
                total: totalModels,
                totalPages: Math.ceil(totalModels / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/model-videos', async (req, res) => {
    try {
        const modelKey = req.query.model;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;

        if (!modelKey || typeof modelKey !== 'string' || !modelKey.includes(':')) {
            return res.status(400).json({ error: 'Parâmetro model inválido' });
        }

        const [source, modelIdRaw] = modelKey.split(':');
        const modelId = parseInt(modelIdRaw);

        if (!source || Number.isNaN(modelId)) {
            return res.status(400).json({ error: 'Parâmetro model inválido' });
        }

        const tableCandidates = ['xxxfollow_videos', 'clubeadulto_videos', 'nsfw247_videos'];
        const tablesResult = await pool.query(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = ANY($1::text[])`,
            [tableCandidates]
        );
        const existingTables = new Set(tablesResult.rows.map(r => r.table_name));

        let countQuery = null;
        let videosQuery = null;
        let queryParams = [];
        let countParams = [];

        if (source === 'xxxfollow') {
            if (!existingTables.has('xxxfollow_videos')) {
                return res.json({
                    videos: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }

            countQuery = 'SELECT COUNT(*) FROM xxxfollow_videos WHERE model_id = $1';
            countParams = [modelId];

            videosQuery = `
                SELECT
                    v.id,
                    v.title,
                    v.description,
                    v.video_url,
                    v.sd_url,
                    v.thumbnail_url,
                    v.poster_url,
                    NULL::text as m3u8_url,
                    v.duration,
                    v.width,
                    v.height,
                    v.view_count,
                    v.like_count,
                    COALESCE(v.posted_at, v.created_at) as created_at
                FROM xxxfollow_videos v
                WHERE v.model_id = $1
                ORDER BY COALESCE(v.posted_at, v.created_at) DESC NULLS LAST
                LIMIT $2 OFFSET $3
            `;
            queryParams = [modelId, limit, offset];
        } else if (source === 'clubeadulto') {
            if (!existingTables.has('clubeadulto_videos')) {
                return res.json({
                    videos: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }

            countQuery = 'SELECT COUNT(*) FROM clubeadulto_videos WHERE model_id = $1';
            countParams = [modelId];

            videosQuery = `
                SELECT
                    v.id,
                    v.title,
                    NULL::text as description,
                    v.video_url,
                    NULL::text as sd_url,
                    v.thumbnail_url,
                    v.poster_url,
                    v.m3u8_url,
                    v.duration::text as duration,
                    NULL::int as width,
                    NULL::int as height,
                    0::int as view_count,
                    0::int as like_count,
                    v.created_at
                FROM clubeadulto_videos v
                WHERE v.model_id = $1
                ORDER BY v.created_at DESC NULLS LAST
                LIMIT $2 OFFSET $3
            `;
            queryParams = [modelId, limit, offset];
        } else if (source === 'nsfw247') {
            if (!existingTables.has('nsfw247_videos')) {
                return res.json({
                    videos: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }

            countQuery = 'SELECT COUNT(*) FROM nsfw247_videos WHERE model_id = $1';
            countParams = [modelId];

            videosQuery = `
                SELECT
                    v.id,
                    v.title,
                    NULL::text as description,
                    v.video_url,
                    NULL::text as sd_url,
                    v.thumbnail_url,
                    v.poster_url,
                    v.m3u8_url,
                    v.duration::text as duration,
                    NULL::int as width,
                    NULL::int as height,
                    0::int as view_count,
                    0::int as like_count,
                    v.created_at
                FROM nsfw247_videos v
                WHERE v.model_id = $1
                ORDER BY v.created_at DESC NULLS LAST
                LIMIT $2 OFFSET $3
            `;
            queryParams = [modelId, limit, offset];
        } else {
            return res.status(400).json({ error: 'Source inválido' });
        }

        const countResult = await pool.query(countQuery, countParams);
        const totalVideos = parseInt(countResult.rows[0].count);

        const videosResult = await pool.query(videosQuery, queryParams);

        res.json({
            videos: videosResult.rows,
            pagination: {
                page,
                limit,
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / limit)
            }
        });
    } catch (error) {
        console.error('Erro no endpoint /api/model-videos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/all-videos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;

        const tableCandidates = ['xxxfollow_videos', 'clubeadulto_videos', 'nsfw247_videos'];
        const tablesResult = await pool.query(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = ANY($1::text[])`,
            [tableCandidates]
        );
        const existingTables = new Set(tablesResult.rows.map(r => r.table_name));

        const unionParts = [];
        const countParts = [];

        if (existingTables.has('xxxfollow_videos')) {
            unionParts.push(`
                SELECT
                    v.id,
                    COALESCE(v.title, v.description, 'Sem título') as title,
                    v.video_url,
                    v.sd_url,
                    v.thumbnail_url,
                    v.poster_url,
                    NULL::text as m3u8_url,
                    v.duration::text as duration,
                    v.width,
                    v.height,
                    v.view_count,
                    v.like_count,
                    COALESCE(v.posted_at, v.created_at) as created_at
                FROM xxxfollow_videos v
            `);
            countParts.push('SELECT COUNT(*)::int as count FROM xxxfollow_videos');
        }

        if (existingTables.has('clubeadulto_videos')) {
            unionParts.push(`
                SELECT
                    v.id,
                    COALESCE(v.title, 'Sem título') as title,
                    v.video_url,
                    NULL::text as sd_url,
                    v.thumbnail_url,
                    v.poster_url,
                    v.m3u8_url,
                    v.duration::text as duration,
                    NULL::int as width,
                    NULL::int as height,
                    0::int as view_count,
                    0::int as like_count,
                    v.created_at
                FROM clubeadulto_videos v
            `);
            countParts.push('SELECT COUNT(*)::int as count FROM clubeadulto_videos');
        }

        if (existingTables.has('nsfw247_videos')) {
            unionParts.push(`
                SELECT
                    v.id,
                    COALESCE(v.title, 'Sem título') as title,
                    v.video_url,
                    NULL::text as sd_url,
                    v.thumbnail_url,
                    v.poster_url,
                    v.m3u8_url,
                    v.duration::text as duration,
                    NULL::int as width,
                    NULL::int as height,
                    0::int as view_count,
                    0::int as like_count,
                    v.created_at
                FROM nsfw247_videos v
            `);
            countParts.push('SELECT COUNT(*)::int as count FROM nsfw247_videos');
        }

        if (unionParts.length === 0) {
            return res.json({
                videos: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                }
            });
        }

        const countQuery = `SELECT COALESCE(SUM(count), 0)::int as total FROM (${countParts.join(' UNION ALL ')}) c`;
        const countResult = await pool.query(countQuery);
        const totalVideos = parseInt(countResult.rows[0].total);

        const videosQuery = `
            SELECT *
            FROM (
                ${unionParts.join(' UNION ALL ')}
            ) all_videos
            ORDER BY created_at DESC NULLS LAST
            LIMIT $1 OFFSET $2
        `;
        const videosResult = await pool.query(videosQuery, [limit, offset]);

        res.json({
            videos: videosResult.rows,
            pagination: {
                page,
                limit,
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / limit)
            }
        });
    } catch (error) {
        console.error('Erro no endpoint /api/all-videos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/xxxfollow/models', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        
        const countResult = await pool.query('SELECT COUNT(*) FROM xxxfollow_models');
        const totalModels = parseInt(countResult.rows[0].count);
        
        const result = await pool.query(`
            SELECT 
                m.*,
                COUNT(v.id) as video_count
            FROM xxxfollow_models m
            LEFT JOIN xxxfollow_videos v ON m.id = v.model_id
            GROUP BY m.id
            ORDER BY m.created_at DESC 
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        res.json({ 
            models: result.rows,
            pagination: {
                page,
                limit,
                total: totalModels,
                totalPages: Math.ceil(totalModels / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/xxxfollow/videos', async (req, res) => {
    try {
        const modelId = req.query.model;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        
        let countQuery = 'SELECT COUNT(*) FROM xxxfollow_videos';
        let query = 'SELECT * FROM xxxfollow_videos';
        let params = [];
        let countParams = [];
        
        if (modelId) {
            countQuery += ' WHERE model_id = $1';
            query += ' WHERE model_id = $1';
            params.push(modelId);
            countParams.push(modelId);
        }
        
        const countResult = await pool.query(countQuery, countParams);
        const totalVideos = parseInt(countResult.rows[0].count);
        
        query += ' ORDER BY posted_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        res.json({ 
            videos: result.rows,
            pagination: {
                page,
                limit,
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/xxxfollow/scrape-models-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const page = req.query.page || 'most-popular/all';
        
        const scraper = spawn('node', ['src/xxxfollow-models-scraper.js', page], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/xxxfollow/scrape-videos-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const scraper = spawn('node', ['src/xxxfollow-videos-scraper.js'], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/xxxfollow/scrape-video-details-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const scraper = spawn('node', ['src/xxxfollow-video-details-scraper.js'], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/xxxfollow/scrape-tags-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const scraper = spawn('node', ['src/xxxfollow-tag-scraper.js'], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/xxxfollow/scrape-custom-url-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        const customUrl = req.query.url;
        
        if (!customUrl) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'URL não fornecida' })}\n\n`);
            res.end();
            return;
        }
        
        const scraper = spawn('node', ['src/xxxfollow-custom-tag-scraper.js', customUrl], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

// ========================================
// CLUBE ADULTO & NSFW247 - Streaming Endpoints
// ========================================

app.get('/api/clubeadulto/scrape-models-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        const start = req.query.start || '1';
        const end = req.query.end || '5';
        
        const scraper = spawn('node', ['src/clubeadulto-models-scraper.js', start, end], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/clubeadulto/scrape-videos-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const scraper = spawn('node', ['src/clubeadulto-videos-scraper.js'], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/clubeadulto/scrape-details-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const scraper = spawn('node', ['src/clubeadulto-details-scraper.js'], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

// NSFW247 - Rotas específicas para o site NSFW247
app.get('/api/nsfw247/scrape-models-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        const start = req.query.start || '1';
        const end = req.query.end || '5';
        
        const scraper = spawn('node', ['src/nsfw247-models-scraper.js', start, end], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/nsfw247/scrape-videos-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const scraper = spawn('node', ['src/nsfw247-videos-scraper.js'], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.get('/api/nsfw247/scrape-details-stream', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        const { spawn } = await import('child_process');
        
        const scraper = spawn('node', ['src/nsfw247-details-scraper.js'], {
            cwd: path.join(__dirname, '..')
        });
        
        scraper.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
                }
            });
        });
        
        scraper.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
                }
            });
        });
        
        scraper.on('close', (code) => {
            res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

// ========================================
// UNIFIED ENDPOINTS - VIEWs Unificadas
// ========================================

// Endpoint para modelos unificados de todas as fontes
app.get('/api/unified-models', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const source = req.query.source; // Filtro opcional por fonte
        const modelId = req.query.modelId; // Filtro opcional por ID da modelo (formato: source:id)
        const sortBy = req.query.sortBy || 'videos'; // 'videos' ou 'recent'
        
        let whereClause = '';
        const whereParams = [];
        
        if (search) {
            whereClause = 'WHERE name ILIKE $1';
            whereParams.push(`%${search}%`);
        }
        
        if (source) {
            whereClause += (whereClause ? ' AND ' : 'WHERE ') + `source = $${whereParams.length + 1}`;
            whereParams.push(source);
        }
        
        // Filtrar por modelo específica se modelId fornecido (formato: source:id)
        if (modelId) {
            const [modelSource, modelIdNum] = modelId.split(':');
            whereClause += (whereClause ? ' AND ' : 'WHERE ') + `source = $${whereParams.length + 1} AND id = $${whereParams.length + 2}`;
            whereParams.push(modelSource, parseInt(modelIdNum));
        }
        
        // Definir ordenação baseada no parâmetro sortBy
        let orderBy = 'ORDER BY video_count DESC, follower_count DESC';
        if (sortBy === 'recent') {
            orderBy = 'ORDER BY created_at DESC';
        }
        
        // Parâmetros para a query principal (LIMIT e OFFSET no final)
        const selectParams = [...whereParams, limit, offset];
        
        const result = await pool.query(`
            SELECT 
                source,
                id,
                name,
                profile_url,
                avatar_url,
                COALESCE(banner_url, avatar_url) as cover_url,
                banner_url,
                bio,
                gender,
                follower_count,
                like_count,
                view_count,
                post_count,
                video_count,
                status,
                created_at
            FROM unified_models
            ${whereClause}
            ${orderBy}
            LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}
        `, selectParams);
        
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM unified_models ${whereClause}
        `, whereParams);
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            models: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Erro ao buscar modelos unificados:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para vídeos unificados de todas as fontes
app.get('/api/unified-videos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const source = req.query.source; // Filtro opcional por fonte
        const modelId = req.query.modelId; // Filtro por modelo (source:id)
        const random = req.query.random === 'true'; // Ordenação aleatória
        
        let whereClause = "";
        const whereParams = [];
        let hasWhere = false;
        
        if (search) {
            whereClause += hasWhere ? ` AND title ILIKE $${whereParams.length + 1}` : `WHERE title ILIKE $${whereParams.length + 1}`;
            whereParams.push(`%${search}%`);
            hasWhere = true;
        }
        
        if (source) {
            whereClause += hasWhere ? ` AND source = $${whereParams.length + 1}` : `WHERE source = $${whereParams.length + 1}`;
            whereParams.push(source);
            hasWhere = true;
        }
        
        if (modelId) {
            const [modelSource, modelIdNum] = modelId.split(':');
            whereClause += hasWhere ? ` AND source = $${whereParams.length + 1} AND model_id = $${whereParams.length + 2}` : `WHERE source = $${whereParams.length + 1} AND model_id = $${whereParams.length + 2}`;
            whereParams.push(modelSource, parseInt(modelIdNum));
            hasWhere = true;
        }
        
        // Parâmetros para a query principal (LIMIT e OFFSET no final)
        const selectParams = [...whereParams, limit, offset];
        
        const result = await pool.query(`
            SELECT 
                source,
                id,
                model_id,
                model_name,
                model_avatar,
                title,
                thumbnail_url,
                poster_url,
                duration,
                view_count,
                like_count,
                video_source_url,
                created_at
            FROM unified_videos
            ${whereClause}
            ORDER BY ${random ? 'RANDOM()' : 'created_at DESC'}
            LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}
        `, selectParams);
        
        const countResult = await pool.query(`
            SELECT COUNT(*) FROM unified_videos ${whereClause}
        `, whereParams);
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            videos: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Erro ao buscar vídeos unificados:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// ADMIN - Sincronizar Video Counts
// ========================================

app.post('/api/admin/sync-video-counts', authenticateToken, async (req, res) => {
    try {
        console.log('\n🔄 Iniciando sincronização de video_count...\n');
        
        // Atualizar XXXFollow
        const xxxfollowResult = await pool.query(`
            UPDATE xxxfollow_models m
            SET video_count = (
                SELECT COUNT(*)
                FROM xxxfollow_videos v
                WHERE v.model_id = m.id
            )
        `);
        console.log(`✅ XXXFollow: ${xxxfollowResult.rowCount} modelos atualizados`);
        
        // Atualizar Clube Adulto
        const clubeadultoResult = await pool.query(`
            UPDATE clubeadulto_models m
            SET video_count = (
                SELECT COUNT(*)
                FROM clubeadulto_videos v
                WHERE v.model_id = m.id
            )
        `);
        console.log(`✅ Clube Adulto: ${clubeadultoResult.rowCount} modelos atualizados`);
        
        // Atualizar NSFW247
        const nsfw247Result = await pool.query(`
            UPDATE models m
            SET video_count = (
                SELECT COUNT(*)
                FROM videos v
                WHERE v.model_id = m.id
            )
        `);
        console.log(`✅ NSFW247: ${nsfw247Result.rowCount} modelos atualizados`);
        
        // Buscar estatísticas atualizadas
        const statsResult = await pool.query(`
            SELECT 
                'xxxfollow' as source,
                COUNT(*) as total_models,
                SUM(video_count) as total_videos
            FROM xxxfollow_models
            UNION ALL
            SELECT 
                'clubeadulto' as source,
                COUNT(*) as total_models,
                SUM(video_count) as total_videos
            FROM clubeadulto_models
            UNION ALL
            SELECT 
                'nsfw247' as source,
                COUNT(*) as total_models,
                SUM(video_count) as total_videos
            FROM models
        `);
        
        console.log('\n📊 Estatísticas atualizadas:');
        statsResult.rows.forEach(row => {
            console.log(`   ${row.source}: ${row.total_models} modelos, ${row.total_videos} vídeos`);
        });
        console.log('');
        
        res.json({
            success: true,
            message: 'Video counts sincronizados com sucesso',
            updated: {
                xxxfollow: xxxfollowResult.rowCount,
                clubeadulto: clubeadultoResult.rowCount,
                nsfw247: nsfw247Result.rowCount
            },
            stats: statsResult.rows
        });
    } catch (error) {
        console.error('Erro ao sincronizar video counts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// ANALYTICS - Visualizações e Curtidas
// ========================================

// Registrar visualização de vídeo
app.post('/api/analytics/view', authenticateToken, async (req, res) => {
    try {
        const { video_source, video_id } = req.body;
        const userId = req.user.userId;

        if (!video_source || !video_id) {
            return res.status(400).json({ error: 'video_source e video_id são obrigatórios' });
        }

        // Inserir ou atualizar visualização (ON CONFLICT para evitar duplicatas)
        await pool.query(`
            INSERT INTO video_views (user_id, video_source, video_id, viewed_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, video_source, video_id) 
            DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
        `, [userId, video_source, video_id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar visualização:', error);
        res.status(500).json({ error: error.message });
    }
});

// Curtir vídeo
app.post('/api/analytics/like', authenticateToken, async (req, res) => {
    try {
        const { video_source, video_id } = req.body;
        const userId = req.user.userId;

        if (!video_source || !video_id) {
            return res.status(400).json({ error: 'video_source e video_id são obrigatórios' });
        }

        // Inserir curtida
        await pool.query(`
            INSERT INTO video_likes (user_id, video_source, video_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, video_source, video_id) DO NOTHING
        `, [userId, video_source, video_id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao curtir vídeo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Descurtir vídeo
app.delete('/api/analytics/like/:source/:videoId', authenticateToken, async (req, res) => {
    try {
        const { source, videoId } = req.params;
        const userId = req.user.userId;

        await pool.query(`
            DELETE FROM video_likes 
            WHERE user_id = $1 AND video_source = $2 AND video_id = $3
        `, [userId, source, parseInt(videoId)]);

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao descurtir vídeo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obter curtidas do usuário
app.get('/api/analytics/likes', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(`
            SELECT video_source, video_id 
            FROM video_likes 
            WHERE user_id = $1
        `, [userId]);

        const likes = result.rows.map(row => `${row.video_source}:${row.video_id}`);
        res.json({ likes });
    } catch (error) {
        console.error('Erro ao buscar curtidas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// ADMIN - Limpar Banco
// ========================================

app.delete('/api/admin/clear-database', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM models');
        
        console.log(`\n🗑️  Banco de dados limpo: ${result.rowCount} registros deletados\n`);
        
        res.json({
            success: true,
            message: 'Banco de dados limpo com sucesso',
            deletedCount: result.rowCount
        });
    } catch (error) {
        console.error('Erro ao limpar banco de dados:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const server = app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🏠 Homepage: http://localhost:${PORT}/home.html`);
    console.log(`⚙️  Admin Scraping: http://localhost:${PORT}/admin-scraper.html\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`\n⚠️  Porta ${PORT} já está em uso. Tentando porta ${FALLBACK_PORT}...\n`);
        app.listen(FALLBACK_PORT, () => {
            console.log(`\n🚀 Servidor rodando em http://localhost:${FALLBACK_PORT}`);
            console.log(`🏠 Homepage: http://localhost:${FALLBACK_PORT}/home.html`);
            console.log(`⚙️  Admin Scraping: http://localhost:${FALLBACK_PORT}/admin-scraper.html\n`);
        });
    } else {
        console.error('Erro ao iniciar servidor:', err);
        process.exit(1);
    }
});
