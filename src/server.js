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
                video_count,
                photo_count,
                created_at,
                updated_at
            FROM models
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        const statsResult = await pool.query(`
            SELECT 
                SUM(video_count) as total_videos,
                SUM(photo_count) as total_photos,
                AVG(video_count) as avg_videos,
                AVG(photo_count) as avg_photos
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

app.post('/api/scrape/start', (req, res) => {
    if (scrapingProcess) {
        return res.status(400).json({
            success: false,
            error: 'Scraping já está em execução'
        });
    }
    
    const { pages = 5, useDatabase = true } = req.body;
    
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
                SUM(video_count) as total_videos,
                SUM(photo_count) as total_photos,
                AVG(video_count) as avg_videos,
                AVG(photo_count) as avg_photos,
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

const server = app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`🔍 Visualizar dados: http://localhost:${PORT}/models.html\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`\n⚠️  Porta ${PORT} já está em uso. Tentando porta ${FALLBACK_PORT}...\n`);
        app.listen(FALLBACK_PORT, () => {
            console.log(`\n🚀 Servidor rodando em http://localhost:${FALLBACK_PORT}`);
            console.log(`📊 Dashboard: http://localhost:${FALLBACK_PORT}/dashboard.html`);
            console.log(`🔍 Visualizar dados: http://localhost:${FALLBACK_PORT}/models.html\n`);
        });
    } else {
        console.error('Erro ao iniciar servidor:', err);
        process.exit(1);
    }
});
