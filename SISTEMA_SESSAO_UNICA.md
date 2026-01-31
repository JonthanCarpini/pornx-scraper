# Sistema de Controle de Sessão Única

## 📋 Visão Geral

Sistema completo para controlar sessões de usuários, garantindo que cada usuário possa ter apenas **uma conexão ativa por vez**. Quando o usuário faz login em um novo dispositivo, todas as sessões anteriores são automaticamente invalidadas.

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `user_sessions`

```sql
CREATE TABLE user_sessions (
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
```

**Campos:**
- `session_token`: Token único da sessão (usado como Bearer token)
- `last_heartbeat`: Último ping recebido do cliente
- `expires_at`: Data de expiração (30 dias após criação)
- `is_active`: Se a sessão está ativa

**Regras:**
- Sessões expiram após 30 dias
- Sessões são invalidadas se não receberem heartbeat por 5 minutos
- Apenas uma sessão ativa por usuário

---

## 🔌 Endpoints da API

### 1. Criar Sessão (Login)

**POST** `/api/session/create`

```json
{
  "userId": 123,
  "deviceInfo": "iPhone 13 Pro - iOS 15.0",
  "ipAddress": "192.168.1.100"
}
```

**Resposta:**
```json
{
  "success": true,
  "session": {
    "id": 456,
    "session_token": "abc123...",
    "expires_at": "2026-03-02T20:00:00Z"
  },
  "message": "Sessão criada com sucesso. Sessões anteriores foram invalidadas."
}
```

**Comportamento:**
- Invalida todas as sessões ativas anteriores do usuário
- Cria nova sessão com token único
- Retorna token que deve ser usado como Bearer token

---

### 2. Heartbeat (Manter Sessão Ativa)

**POST** `/api/session/heartbeat`

**Headers:**
```
Authorization: Bearer abc123...
```

**Resposta:**
```json
{
  "success": true,
  "message": "Heartbeat registrado"
}
```

**Comportamento:**
- Atualiza `last_heartbeat` para NOW()
- Deve ser chamado a cada 2 minutos
- Se não receber heartbeat por 5 minutos, sessão é invalidada

---

### 3. Verificar Status da Sessão

**GET** `/api/session/status`

**Headers:**
```
Authorization: Bearer abc123...
```

**Resposta:**
```json
{
  "success": true,
  "session": {
    "id": 456,
    "user_id": 123,
    "device_info": "iPhone 13 Pro",
    "last_heartbeat": "2026-01-31T20:00:00Z",
    "created_at": "2026-01-31T19:00:00Z",
    "expires_at": "2026-03-02T19:00:00Z",
    "is_active": true
  }
}
```

---

### 4. Logout

**POST** `/api/session/logout`

**Headers:**
```
Authorization: Bearer abc123...
```

**Resposta:**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

**Comportamento:**
- Invalida a sessão atual
- Define `is_active = FALSE`

---

### 5. Limpar Sessões Expiradas

**POST** `/api/session/cleanup`

**Resposta:**
```json
{
  "success": true,
  "cleaned": 15,
  "message": "15 sessões expiradas foram limpas"
}
```

**Comportamento:**
- Invalida sessões expiradas ou inativas
- Pode ser chamado por um cron job periodicamente

---

## 📱 Uso no App Mobile

### 1. Importar o Serviço

```typescript
import { sessionService } from '../services/sessionService';
```

### 2. Criar Sessão no Login

```typescript
// Após login bem-sucedido
const userId = 123;
const deviceInfo = `${Platform.OS} ${Platform.Version}`;

try {
  const sessionToken = await sessionService.createSession(userId, deviceInfo);
  console.log('Sessão criada:', sessionToken);
  
  // Heartbeat automático já foi iniciado
} catch (error) {
  console.error('Erro ao criar sessão:', error);
}
```

### 3. Heartbeat Automático

O heartbeat é **iniciado automaticamente** após criar a sessão:
- Envia ping a cada 2 minutos
- Monitora estado do app (foreground/background)
- Envia heartbeat quando app volta para foreground

**Não é necessário chamar manualmente!**

### 4. Logout

```typescript
await sessionService.logout();
// Sessão invalidada e heartbeat parado
```

### 5. Verificar Sessão Ativa

```typescript
const hasSession = await sessionService.hasActiveSession();
if (hasSession) {
  console.log('Usuário tem sessão ativa');
}
```

---

## 🔒 Middleware de Validação

### Proteger Rotas

```typescript
import { validateSession } from '../middleware/sessionMiddleware.js';

// Proteger rota
router.get('/protected', validateSession, async (req, res) => {
  // req.userId e req.sessionId estão disponíveis
  const { userId, sessionId } = req;
  
  res.json({ message: 'Rota protegida', userId });
});
```

**Validações realizadas:**
1. Token presente no header Authorization
2. Sessão existe e está ativa
3. Sessão não expirou
4. Último heartbeat foi há menos de 5 minutos

**Códigos de erro:**
- `SESSION_INVALID`: Sessão não encontrada
- `SESSION_EXPIRED`: Sessão expirou
- `SESSION_INACTIVE`: Sem heartbeat há mais de 5 minutos

---

## 🚀 Instalação e Configuração

### 1. Executar Migration

```bash
node run-migration.js 012_create_user_sessions_table.sql
```

### 2. Reiniciar Servidor

```bash
npm start
```

### 3. Testar Endpoints

```bash
# Criar sessão
curl -X POST http://localhost:3000/api/session/create \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "deviceInfo": "Test Device"}'

# Heartbeat
curl -X POST http://localhost:3000/api/session/heartbeat \
  -H "Authorization: Bearer TOKEN_AQUI"

# Status
curl -X GET http://localhost:3000/api/session/status \
  -H "Authorization: Bearer TOKEN_AQUI"
```

---

## 🔄 Fluxo Completo

### Login
1. Usuário faz login
2. Backend cria nova sessão
3. Backend invalida sessões antigas do usuário
4. Retorna `session_token`
5. Mobile salva token no AsyncStorage
6. Mobile inicia heartbeat automático

### Durante Uso
1. A cada 2 minutos, mobile envia heartbeat
2. Backend atualiza `last_heartbeat`
3. Sessão permanece ativa

### Segundo Login (Outro Dispositivo)
1. Usuário faz login em outro dispositivo
2. Backend invalida sessão do primeiro dispositivo
3. Primeiro dispositivo recebe erro no próximo heartbeat
4. Primeiro dispositivo faz logout automático

### Logout
1. Usuário faz logout
2. Backend invalida sessão
3. Mobile para heartbeat
4. Mobile limpa token local

---

## ⚙️ Configurações

### Intervalos de Tempo

```typescript
// sessionService.ts
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutos

// sessionMiddleware.js
const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutos

// session.js (create endpoint)
const SESSION_EXPIRATION = 30 * 24 * 60 * 60 * 1000; // 30 dias
```

### Ajustar Intervalos

Para alterar os intervalos, edite as constantes nos arquivos correspondentes.

---

## 🧪 Testes

### Teste 1: Sessão Única
1. Faça login no dispositivo A
2. Faça login no dispositivo B
3. Verifique que dispositivo A foi desconectado

### Teste 2: Heartbeat
1. Faça login
2. Aguarde 2 minutos
3. Verifique logs do heartbeat

### Teste 3: Inatividade
1. Faça login
2. Feche o app por 6 minutos
3. Abra o app
4. Verifique que sessão foi invalidada

---

## 📊 Monitoramento

### Verificar Sessões Ativas

```sql
SELECT 
  us.id,
  us.user_id,
  us.device_info,
  us.last_heartbeat,
  us.created_at,
  NOW() - us.last_heartbeat as tempo_inativo
FROM user_sessions us
WHERE us.is_active = TRUE
ORDER BY us.last_heartbeat DESC;
```

### Limpar Sessões Expiradas Manualmente

```sql
UPDATE user_sessions
SET is_active = FALSE
WHERE is_active = TRUE
AND (
  expires_at < NOW()
  OR last_heartbeat < NOW() - INTERVAL '5 minutes'
);
```

---

## 🎯 Benefícios

✅ **Segurança:** Apenas uma sessão ativa por usuário
✅ **Controle:** Backend tem controle total sobre sessões
✅ **Automático:** Heartbeat funciona automaticamente
✅ **Eficiente:** Limpeza automática de sessões inativas
✅ **Escalável:** Suporta milhares de usuários simultâneos

---

## 📝 Notas Importantes

1. **Token é Bearer Token:** Use `Authorization: Bearer TOKEN` em todas as requisições protegidas
2. **Heartbeat Automático:** Não precisa chamar manualmente, é automático
3. **Sessões Antigas:** São invalidadas automaticamente no novo login
4. **Expiração:** Sessões expiram após 30 dias mesmo com heartbeat
5. **Inatividade:** Sessões sem heartbeat por 5 minutos são invalidadas

---

## 🔧 Troubleshooting

### Erro: "Sessão inválida"
- Verifique se o token está correto
- Verifique se a sessão não expirou
- Verifique se não houve login em outro dispositivo

### Heartbeat não funciona
- Verifique se `sessionService.startHeartbeat()` foi chamado
- Verifique logs do console
- Verifique conexão de rede

### Múltiplas sessões ativas
- Execute o cleanup: `POST /api/session/cleanup`
- Verifique se o código de invalidação está funcionando

---

**Sistema implementado e pronto para uso! 🚀**
