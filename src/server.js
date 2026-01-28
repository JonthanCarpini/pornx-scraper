import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import pool from './database/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FALLBACK_PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let scrapingProcess = null;
let scrapingLogs = [];

app.get('/api/models', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const countResult = await pool.query('SELECT COUNT(*) FROM models');
        const totalModels = parseInt(countResult.rows[0].count);
        
        const modelsResult = await pool.query(`
            SELECT 
                id,
                name,
                profile_url,
                cover_url,
                created_at,
                updated_at
            FROM models
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
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
        
        let whereClause = '';
        let params = [limit, offset];
        let paramIndex = 3;
        
        if (modelId) {
            whereClause = 'WHERE v.model_id = $' + paramIndex;
            params.push(modelId);
            paramIndex++;
        }
        
        if (search) {
            whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'v.title ILIKE $' + paramIndex;
            params.push(`%${search}%`);
        }
        
        const countResult = await pool.query(`SELECT COUNT(*) FROM videos v ${whereClause}`, params.slice(2));
        const totalVideos = parseInt(countResult.rows[0].count);
        
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
            LIMIT $1 OFFSET $2
        `, params);
        
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
    const { spawn } = await import('child_process');
    
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
            
            scraper.on('close', () => {
                const videosMatch = output.match(/(\d+) novos/);
                const videosSaved = videosMatch ? parseInt(videosMatch[1]) : 0;
                
                videoScrapingStatus.processed++;
                videoScrapingStatus.lastResult = {
                    modelName: model.name,
                    videosSaved
                };
                videoScrapingStatus.totalVideos += videosSaved;
                
                resolve();
            });
        });
    }
    
    videoScrapingStatus.isRunning = false;
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
        
        const pages = 5; // Número de páginas para scraping
        
        modelsScrapingStatus = {
            isRunning: true,
            processed: 0,
            total: pages,
            lastResult: null,
            totalModels: 0
        };
        
        processModelsScrapingAsync(pages);
        
        res.json({
            success: true,
            message: 'Scraping de modelos iniciado',
            pagesCount: pages
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

async function processModelsScrapingAsync(pages) {
    const scraper = spawn('node', ['src/scraper.js', pages.toString()], {
        cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    
    scraper.stdout.on('data', (data) => {
        output += data.toString();
        const pageMatch = output.match(/Página (\d+)\/(\d+)/);
        if (pageMatch) {
            modelsScrapingStatus.processed = parseInt(pageMatch[1]);
        }
        const modelsMatch = output.match(/(\d+) novas/);
        if (modelsMatch) {
            modelsScrapingStatus.lastResult = {
                modelsSaved: parseInt(modelsMatch[1])
            };
        }
    });
    
    scraper.on('close', () => {
        const totalMatch = output.match(/Total de modelos salvas: (\d+)/);
        modelsScrapingStatus.totalModels = totalMatch ? parseInt(totalMatch[1]) : 0;
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
    
    scraper.stdout.on('data', (data) => {
        output += data.toString();
        const progressMatch = output.match(/\[(\d+)\/(\d+)\]/);
        if (progressMatch) {
            videoDetailsScrapingStatus.processed = parseInt(progressMatch[1]);
        }
        const successMatch = output.match(/Sucesso: (\d+)/);
        if (successMatch) {
            videoDetailsScrapingStatus.successCount = parseInt(successMatch[1]);
        }
    });
    
    scraper.on('close', () => {
        videoDetailsScrapingStatus.isRunning = false;
    });
}

app.get('/api/scraping/video-details/status', (req, res) => {
    res.json({
        success: true,
        status: videoDetailsScrapingStatus
    });
});

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
