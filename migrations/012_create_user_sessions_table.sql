-- Tabela para controlar sessões ativas dos usuários
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(45),
    last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Índices para melhor performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, last_heartbeat);

-- Função para limpar sessões expiradas automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions
    SET is_active = FALSE
    WHERE is_active = TRUE
    AND (
        expires_at < NOW()
        OR last_heartbeat < NOW() - INTERVAL '5 minutes'
    );
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE user_sessions IS 'Controla sessões ativas dos usuários para limitar conexões simultâneas';
COMMENT ON COLUMN user_sessions.session_token IS 'Token único da sessão (JWT ou UUID)';
COMMENT ON COLUMN user_sessions.last_heartbeat IS 'Último ping recebido do cliente';
COMMENT ON COLUMN user_sessions.expires_at IS 'Data de expiração da sessão';
