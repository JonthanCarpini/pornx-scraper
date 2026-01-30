-- Migration: Sistema Completo de Usuários
-- Cria todas as tabelas necessárias para o sistema de usuários, assinaturas, favoritos, comentários, etc.

-- ===== TABELA USERS =====
-- Armazena todos os usuários do sistema (admins e usuários finais)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

-- Índices para performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ===== TABELA SUBSCRIPTIONS =====
-- Gerencia assinaturas dos usuários (ativação manual pelo admin)
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_months INTEGER NOT NULL CHECK (plan_months >= 0),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_trial BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_admin_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX idx_subscriptions_is_active ON subscriptions(is_active);

-- Constraint: apenas 1 assinatura ativa por usuário
CREATE UNIQUE INDEX idx_subscriptions_user_active ON subscriptions(user_id) WHERE is_active = true;

-- ===== TABELA FAVORITES =====
-- Vídeos favoritados pelos usuários
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(20) NOT NULL CHECK (video_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    video_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_source, video_id)
);

-- Índices
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_video ON favorites(video_source, video_id);
CREATE INDEX idx_favorites_created_at ON favorites(created_at DESC);

-- ===== TABELA FOLLOWS =====
-- Modelos seguidas pelos usuários
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_source VARCHAR(20) NOT NULL CHECK (model_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    model_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, model_source, model_id)
);

-- Índices
CREATE INDEX idx_follows_user_id ON follows(user_id);
CREATE INDEX idx_follows_model ON follows(model_source, model_id);
CREATE INDEX idx_follows_created_at ON follows(created_at DESC);

-- ===== TABELA COMMENTS =====
-- Comentários em vídeos (requer aprovação do admin)
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(20) NOT NULL CHECK (video_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    video_id INTEGER NOT NULL,
    content TEXT NOT NULL CHECK (LENGTH(content) <= 1000),
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by_admin_id INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_video ON comments(video_source, video_id);
CREATE INDEX idx_comments_is_approved ON comments(is_approved);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- ===== TABELA VIDEO_VIEWS =====
-- Histórico de visualização de vídeos
CREATE TABLE IF NOT EXISTS video_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(20) NOT NULL CHECK (video_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    video_id INTEGER NOT NULL,
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    watch_duration INTEGER DEFAULT 0
);

-- Índices
CREATE INDEX idx_video_views_user_id ON video_views(user_id);
CREATE INDEX idx_video_views_watched_at ON video_views(watched_at DESC);
CREATE INDEX idx_video_views_video ON video_views(video_source, video_id);

-- ===== TABELA NOTIFICATIONS =====
-- Notificações em tempo real para usuários
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_source VARCHAR(20),
    related_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ===== FUNÇÃO PARA ATUALIZAR updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===== CRIAR USUÁRIO ADMIN PADRÃO =====
-- Senha padrão: admin123 (hash bcrypt)
INSERT INTO users (username, email, password_hash, full_name, role, is_active)
VALUES (
    'admin',
    'admin@pornx.com',
    '$2b$10$8mRgUC/lHM6BCT9m1CgAh.V37O4fIVGL4W0yxrp4m.dTdSTdiKV/K',
    'Administrador',
    'admin',
    true
)
ON CONFLICT (username) DO NOTHING;

-- ===== VIEWS ÚTEIS =====

-- View: Usuários com assinatura ativa
CREATE OR REPLACE VIEW users_with_active_subscription AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.avatar_url,
    u.is_active,
    u.created_at,
    u.last_login,
    s.id as subscription_id,
    s.plan_months,
    s.start_date,
    s.end_date,
    s.is_trial,
    CASE 
        WHEN s.end_date >= CURRENT_TIMESTAMP THEN true
        ELSE false
    END as subscription_is_valid
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.is_active = true;

-- View: Assinaturas expirando nos próximos 7 dias
CREATE OR REPLACE VIEW subscriptions_expiring_soon AS
SELECT 
    s.id,
    s.user_id,
    u.username,
    u.email,
    s.end_date,
    EXTRACT(DAY FROM (s.end_date - CURRENT_TIMESTAMP)) as days_remaining
FROM subscriptions s
JOIN users u ON s.user_id = u.id
WHERE s.is_active = true
  AND s.end_date BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '7 days'
ORDER BY s.end_date ASC;

-- View: Comentários pendentes de aprovação
CREATE OR REPLACE VIEW comments_pending_approval AS
SELECT 
    c.id,
    c.user_id,
    u.username,
    u.avatar_url,
    c.video_source,
    c.video_id,
    c.content,
    c.created_at
FROM comments c
JOIN users u ON c.user_id = u.id
WHERE c.is_approved = false
ORDER BY c.created_at ASC;

-- View: Estatísticas de usuários
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.username,
    COUNT(DISTINCT f.id) as favorites_count,
    COUNT(DISTINCT fo.id) as follows_count,
    COUNT(DISTINCT c.id) as comments_count,
    COUNT(DISTINCT v.id) as views_count
FROM users u
LEFT JOIN favorites f ON u.id = f.user_id
LEFT JOIN follows fo ON u.id = fo.user_id
LEFT JOIN comments c ON u.id = c.user_id AND c.is_approved = true
LEFT JOIN video_views v ON u.id = v.user_id
WHERE u.role = 'user'
GROUP BY u.id, u.username;

-- ===== VERIFICAR RESULTADOS =====
SELECT 
    'users' as table_name,
    COUNT(*) as count
FROM users
UNION ALL
SELECT 
    'subscriptions' as table_name,
    COUNT(*) as count
FROM subscriptions
UNION ALL
SELECT 
    'favorites' as table_name,
    COUNT(*) as count
FROM favorites
UNION ALL
SELECT 
    'follows' as table_name,
    COUNT(*) as count
FROM follows
UNION ALL
SELECT 
    'comments' as table_name,
    COUNT(*) as count
FROM comments
UNION ALL
SELECT 
    'video_views' as table_name,
    COUNT(*) as count
FROM video_views
UNION ALL
SELECT 
    'notifications' as table_name,
    COUNT(*) as count
FROM notifications;

-- Verificar usuário admin criado
SELECT id, username, email, role FROM users WHERE role = 'admin';
