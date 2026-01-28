-- Tabelas para clubeadulto.net

CREATE TABLE IF NOT EXISTS clubeadulto_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    profile_url TEXT NOT NULL UNIQUE,
    cover_url TEXT,
    video_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_slug ON clubeadulto_models(slug);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_models_profile_url ON clubeadulto_models(profile_url);

CREATE TABLE IF NOT EXISTS clubeadulto_videos (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES clubeadulto_models(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    video_url TEXT NOT NULL UNIQUE,
    thumbnail_url TEXT,
    poster_url TEXT,
    video_source_url TEXT,
    m3u8_url TEXT,
    duration VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clubeadulto_videos_model_id ON clubeadulto_videos(model_id);
CREATE INDEX IF NOT EXISTS idx_clubeadulto_videos_video_url ON clubeadulto_videos(video_url);

CREATE TRIGGER update_clubeadulto_models_updated_at BEFORE UPDATE ON clubeadulto_models
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clubeadulto_videos_updated_at BEFORE UPDATE ON clubeadulto_videos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
