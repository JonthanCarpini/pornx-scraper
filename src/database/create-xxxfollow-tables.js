import pool from './db.js';

const createXXXFollowTables = `
-- Tabela de modelos do XXXFollow
CREATE TABLE IF NOT EXISTS xxxfollow_models (
    id SERIAL PRIMARY KEY,
    xxxfollow_id INTEGER UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    cover_url TEXT,
    cover_video_url TEXT,
    gender VARCHAR(10),
    bio TEXT,
    follower_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    videos_scraped BOOLEAN DEFAULT FALSE,
    videos_scraped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de vídeos do XXXFollow
CREATE TABLE IF NOT EXISTS xxxfollow_videos (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES xxxfollow_models(id) ON DELETE CASCADE,
    xxxfollow_post_id BIGINT UNIQUE NOT NULL,
    xxxfollow_media_id BIGINT NOT NULL,
    title TEXT,
    description TEXT,
    video_url TEXT NOT NULL,
    sd_url TEXT,
    thumbnail_url TEXT,
    poster_url TEXT,
    duration INTEGER,
    width INTEGER,
    height INTEGER,
    like_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    has_audio BOOLEAN DEFAULT TRUE,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_id, xxxfollow_media_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_xxxfollow_models_username ON xxxfollow_models(username);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_models_videos_scraped ON xxxfollow_models(videos_scraped);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_videos_model_id ON xxxfollow_videos(model_id);
CREATE INDEX IF NOT EXISTS idx_xxxfollow_videos_posted_at ON xxxfollow_videos(posted_at DESC);
`;

async function runMigration() {
    try {
        console.log('🔄 Criando tabelas do XXXFollow...');
        await pool.query(createXXXFollowTables);
        console.log('✅ Tabelas criadas com sucesso!');
        
        // Verificar tabelas criadas
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'xxxfollow%'
            ORDER BY table_name;
        `);
        
        console.log('\n📊 Tabelas XXXFollow criadas:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error.message);
        process.exit(1);
    }
}

runMigration();
