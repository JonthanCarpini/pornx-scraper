-- Adicionar campo device_token para push notifications
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS device_token VARCHAR(500),
ADD COLUMN IF NOT EXISTS device_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS device_model VARCHAR(255),
ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);

-- Criar índice para busca rápida por device_token
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_token ON user_sessions(device_token);

COMMENT ON COLUMN user_sessions.device_token IS 'Token do dispositivo para push notifications (FCM/APNS)';
COMMENT ON COLUMN user_sessions.device_name IS 'Nome do dispositivo do usuário';
COMMENT ON COLUMN user_sessions.device_model IS 'Modelo do dispositivo (ex: iPhone 13, Galaxy S21)';
COMMENT ON COLUMN user_sessions.os_version IS 'Versão do sistema operacional';
