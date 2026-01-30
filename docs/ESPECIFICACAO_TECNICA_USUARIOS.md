# 📘 ESPECIFICAÇÃO TÉCNICA - Sistema de Usuários

## 🎯 Visão Geral

Sistema completo de gerenciamento de usuários para plataforma de conteúdo adulto com funcionalidades tipo TikTok, incluindo autenticação, assinaturas, favoritos, comentários, feed personalizado e notificações em tempo real.

---

## 🗄️ ARQUITETURA DE BANCO DE DADOS

### 1. Tabela `users`
**Descrição:** Armazena todos os usuários do sistema (admins e usuários finais)

```sql
CREATE TABLE users (
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
```

**Índices:**
- `idx_users_username` ON username
- `idx_users_email` ON email
- `idx_users_role` ON role

---

### 2. Tabela `subscriptions`
**Descrição:** Gerencia assinaturas dos usuários (ativação manual pelo admin)

```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_months INTEGER NOT NULL CHECK (plan_months IN (1, 3, 6, 12)),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_trial BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_admin_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Índices:**
- `idx_subscriptions_user_id` ON user_id
- `idx_subscriptions_end_date` ON end_date
- `idx_subscriptions_is_active` ON is_active

**Regras de Negócio:**
- Apenas 1 assinatura ativa por usuário
- Teste grátis: 1 dia (plan_months = 0, is_trial = true)
- Bloqueio automático quando end_date < CURRENT_TIMESTAMP

---

### 3. Tabela `favorites`
**Descrição:** Vídeos favoritados pelos usuários

```sql
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(20) NOT NULL CHECK (video_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    video_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_source, video_id)
);
```

**Índices:**
- `idx_favorites_user_id` ON user_id
- `idx_favorites_video` ON (video_source, video_id)

---

### 4. Tabela `follows`
**Descrição:** Modelos seguidas pelos usuários

```sql
CREATE TABLE follows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_source VARCHAR(20) NOT NULL CHECK (model_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    model_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, model_source, model_id)
);
```

**Índices:**
- `idx_follows_user_id` ON user_id
- `idx_follows_model` ON (model_source, model_id)

---

### 5. Tabela `comments`
**Descrição:** Comentários em vídeos (requer aprovação do admin)

```sql
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(20) NOT NULL CHECK (video_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    video_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by_admin_id INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Índices:**
- `idx_comments_user_id` ON user_id
- `idx_comments_video` ON (video_source, video_id)
- `idx_comments_is_approved` ON is_approved

**Regras de Negócio:**
- Comentários não aprovados não aparecem para outros usuários
- Apenas admins podem aprovar/rejeitar comentários
- Usuário pode deletar seus próprios comentários

---

### 6. Tabela `video_views`
**Descrição:** Histórico de visualização de vídeos

```sql
CREATE TABLE video_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_source VARCHAR(20) NOT NULL CHECK (video_source IN ('xxxfollow', 'clubeadulto', 'nsfw247')),
    video_id INTEGER NOT NULL,
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    watch_duration INTEGER DEFAULT 0
);
```

**Índices:**
- `idx_video_views_user_id` ON user_id
- `idx_video_views_watched_at` ON watched_at DESC
- `idx_video_views_video` ON (video_source, video_id)

**Regras de Negócio:**
- Registra cada visualização (permite duplicatas para analytics)
- watch_duration em segundos

---

### 7. Tabela `notifications`
**Descrição:** Notificações em tempo real para usuários

```sql
CREATE TABLE notifications (
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
```

**Índices:**
- `idx_notifications_user_id` ON user_id
- `idx_notifications_is_read` ON is_read
- `idx_notifications_created_at` ON created_at DESC

**Tipos de Notificação:**
- `new_video_from_followed_model` - Nova publicação de modelo seguida
- `comment_approved` - Comentário foi aprovado
- `comment_reply` - Resposta ao comentário
- `subscription_expiring` - Assinatura expirando em 3 dias
- `subscription_expired` - Assinatura expirou

---

## 🔐 AUTENTICAÇÃO E SEGURANÇA

### JWT (JSON Web Token)
- **Secret:** Variável de ambiente `JWT_SECRET`
- **Expiração:** 7 dias
- **Payload:** `{ userId, username, role }`
- **Storage:** Cookie httpOnly + Header Authorization

### Middleware de Autenticação
```javascript
// Verifica se usuário está autenticado
authenticateUser(req, res, next)

// Verifica se usuário tem assinatura ativa
requireActiveSubscription(req, res, next)

// Verifica se usuário é admin
requireAdmin(req, res, next)
```

### Hash de Senha
- **Algoritmo:** bcrypt
- **Rounds:** 10

---

## 🌐 ENDPOINTS DA API

### Autenticação (`/api/auth`)

#### `POST /api/auth/register`
**Descrição:** Registrar novo usuário (público)

**Request Body:**
```json
{
  "username": "string (3-50 chars)",
  "email": "string (valid email)",
  "password": "string (min 6 chars)",
  "full_name": "string (optional)"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com"
  }
}
```

**Validações:**
- Username único, 3-50 caracteres, apenas letras, números e underscore
- Email único e válido
- Senha mínimo 6 caracteres

---

#### `POST /api/auth/login`
**Descrição:** Login de usuário

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response 200:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user",
    "hasActiveSubscription": true
  }
}
```

**Erros:**
- 401: Credenciais inválidas
- 403: Usuário bloqueado (is_active = false)

---

#### `POST /api/auth/logout`
**Descrição:** Logout (limpa cookie)

**Response 200:**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

---

#### `GET /api/auth/me`
**Descrição:** Dados do usuário logado
**Auth:** Required

**Response 200:**
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://...",
  "bio": "...",
  "role": "user",
  "subscription": {
    "is_active": true,
    "end_date": "2026-02-28T23:59:59Z",
    "plan_months": 1,
    "is_trial": false
  }
}
```

---

### Admin - Usuários (`/api/admin/users`)

#### `GET /api/admin/users`
**Auth:** Admin only

**Query Params:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (username ou email)
- `role` (user, admin)
- `is_active` (true, false)

**Response 200:**
```json
{
  "users": [
    {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "full_name": "John Doe",
      "is_active": true,
      "role": "user",
      "created_at": "2026-01-01T00:00:00Z",
      "last_login": "2026-01-30T12:00:00Z",
      "subscription": {
        "is_active": true,
        "end_date": "2026-02-28T23:59:59Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

#### `POST /api/admin/users`
**Auth:** Admin only
**Descrição:** Criar usuário manualmente

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "full_name": "string",
  "role": "user"
}
```

---

#### `PUT /api/admin/users/:id`
**Auth:** Admin only
**Descrição:** Editar usuário

**Request Body:**
```json
{
  "email": "string (optional)",
  "full_name": "string (optional)",
  "bio": "string (optional)",
  "is_active": "boolean (optional)"
}
```

---

#### `DELETE /api/admin/users/:id`
**Auth:** Admin only
**Descrição:** Deletar usuário (CASCADE em todas as tabelas relacionadas)

---

### Admin - Assinaturas (`/api/admin/subscriptions`)

#### `POST /api/admin/subscriptions`
**Auth:** Admin only
**Descrição:** Criar/Ativar assinatura para usuário

**Request Body:**
```json
{
  "user_id": 1,
  "plan_months": 1,
  "is_trial": false
}
```

**Lógica:**
- Se `is_trial = true`: end_date = start_date + 1 dia
- Senão: end_date = start_date + plan_months meses
- Desativa assinatura anterior se existir

---

#### `PUT /api/admin/subscriptions/:id/renew`
**Auth:** Admin only
**Descrição:** Renovar assinatura

**Request Body:**
```json
{
  "plan_months": 3
}
```

**Lógica:**
- Se assinatura ainda ativa: end_date += plan_months
- Se expirada: start_date = NOW, end_date = NOW + plan_months

---

#### `GET /api/admin/subscriptions/expiring`
**Auth:** Admin only
**Descrição:** Listar assinaturas expirando nos próximos 7 dias

---

### Favoritos (`/api/favorites`)

#### `GET /api/favorites`
**Auth:** Required

**Response 200:**
```json
{
  "favorites": [
    {
      "id": 1,
      "video": {
        "source": "xxxfollow",
        "id": 123,
        "title": "...",
        "thumbnail_url": "...",
        "model_name": "..."
      },
      "created_at": "2026-01-30T12:00:00Z"
    }
  ]
}
```

---

#### `POST /api/favorites`
**Auth:** Required + Active Subscription

**Request Body:**
```json
{
  "video_source": "xxxfollow",
  "video_id": 123
}
```

---

#### `DELETE /api/favorites/:id`
**Auth:** Required

---

### Seguir Modelos (`/api/follows`)

#### `GET /api/follows`
**Auth:** Required

**Response 200:**
```json
{
  "follows": [
    {
      "id": 1,
      "model": {
        "source": "xxxfollow",
        "id": 456,
        "name": "...",
        "avatar_url": "...",
        "video_count": 100
      },
      "created_at": "2026-01-30T12:00:00Z"
    }
  ]
}
```

---

#### `POST /api/follows`
**Auth:** Required + Active Subscription

**Request Body:**
```json
{
  "model_source": "xxxfollow",
  "model_id": 456
}
```

---

#### `DELETE /api/follows/:id`
**Auth:** Required

---

### Comentários (`/api/comments`)

#### `GET /api/comments/:source/:videoId`
**Auth:** Optional (apenas comentários aprovados)

**Response 200:**
```json
{
  "comments": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "username": "johndoe",
        "avatar_url": "..."
      },
      "content": "Ótimo vídeo!",
      "created_at": "2026-01-30T12:00:00Z"
    }
  ]
}
```

---

#### `POST /api/comments`
**Auth:** Required + Active Subscription

**Request Body:**
```json
{
  "video_source": "xxxfollow",
  "video_id": 123,
  "content": "string (max 1000 chars)"
}
```

**Regras:**
- Comentário criado com `is_approved = false`
- Aguarda aprovação do admin

---

#### `DELETE /api/comments/:id`
**Auth:** Required (apenas próprios comentários)

---

### Admin - Comentários (`/api/admin/comments`)

#### `GET /api/admin/comments/pending`
**Auth:** Admin only

**Response 200:**
```json
{
  "comments": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "username": "johndoe"
      },
      "video": {
        "source": "xxxfollow",
        "id": 123,
        "title": "..."
      },
      "content": "...",
      "created_at": "2026-01-30T12:00:00Z"
    }
  ]
}
```

---

#### `POST /api/admin/comments/:id/approve`
**Auth:** Admin only

**Lógica:**
- Define `is_approved = true`
- Define `approved_by_admin_id` e `approved_at`
- Cria notificação para o usuário

---

#### `DELETE /api/admin/comments/:id`
**Auth:** Admin only

---

### Feed (`/api/feed`)

#### `GET /api/feed`
**Auth:** Required + Active Subscription

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20)

**Response 200:**
```json
{
  "videos": [
    {
      "source": "xxxfollow",
      "id": 123,
      "title": "...",
      "thumbnail_url": "...",
      "model": {
        "id": 456,
        "name": "...",
        "avatar_url": "..."
      },
      "is_favorited": false,
      "is_following_model": true,
      "view_count": 1000,
      "comment_count": 50
    }
  ],
  "pagination": {...}
}
```

**Algoritmo de Recomendação:**
1. Vídeos de modelos seguidas (50%)
2. Vídeos similares aos favoritados (30%)
3. Vídeos populares (20%)

---

### Perfil (`/api/profile`)

#### `GET /api/profile`
**Auth:** Required

---

#### `PUT /api/profile`
**Auth:** Required

**Request Body:**
```json
{
  "full_name": "string (optional)",
  "bio": "string (optional)",
  "email": "string (optional)"
}
```

---

#### `POST /api/profile/avatar`
**Auth:** Required
**Content-Type:** multipart/form-data

**Request:**
- `avatar`: File (jpg, png, max 5MB)

---

### Histórico (`/api/history`)

#### `GET /api/history`
**Auth:** Required

**Response 200:**
```json
{
  "history": [
    {
      "id": 1,
      "video": {
        "source": "xxxfollow",
        "id": 123,
        "title": "...",
        "thumbnail_url": "..."
      },
      "watched_at": "2026-01-30T12:00:00Z",
      "watch_duration": 120
    }
  ]
}
```

---

#### `POST /api/videos/view`
**Auth:** Required + Active Subscription

**Request Body:**
```json
{
  "video_source": "xxxfollow",
  "video_id": 123,
  "watch_duration": 120
}
```

---

### Notificações (`/api/notifications`)

#### `GET /api/notifications`
**Auth:** Required

**Response 200:**
```json
{
  "notifications": [
    {
      "id": 1,
      "type": "new_video_from_followed_model",
      "title": "Nova publicação!",
      "message": "Maria postou um novo vídeo",
      "related_source": "xxxfollow",
      "related_id": 123,
      "is_read": false,
      "created_at": "2026-01-30T12:00:00Z"
    }
  ],
  "unread_count": 5
}
```

---

#### `PUT /api/notifications/:id/read`
**Auth:** Required

---

## 🔄 WEBSOCKET - Notificações em Tempo Real

### Conexão
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// Autenticação
ws.send(JSON.stringify({
  type: 'auth',
  token: 'jwt_token_here'
}));
```

### Eventos do Servidor
```javascript
// Nova notificação
{
  type: 'notification',
  data: {
    id: 1,
    type: 'new_video_from_followed_model',
    title: '...',
    message: '...'
  }
}

// Assinatura expirando
{
  type: 'subscription_warning',
  data: {
    days_remaining: 3
  }
}
```

---

## 🎨 PÁGINAS FRONTEND

### Públicas
- `/login.html` - Login
- `/register.html` - Registro

### Autenticadas (requer assinatura ativa)
- `/feed.html` - Feed personalizado
- `/favorites.html` - Vídeos favoritos
- `/following.html` - Modelos seguidas
- `/profile.html` - Perfil do usuário
- `/history.html` - Histórico de visualização
- `/video.html?source=xxx&id=123` - Player de vídeo com comentários

### Admin
- `/admin/users.html` - Gerenciar usuários
- `/admin/subscriptions.html` - Gerenciar assinaturas
- `/admin/comments.html` - Moderar comentários

---

## 🔒 REGRAS DE NEGÓCIO

### Bloqueio Automático
- **CRON Job:** Roda a cada hora
- **Lógica:** `UPDATE subscriptions SET is_active = false WHERE end_date < NOW()`
- **Middleware:** Verifica `is_active` em cada request

### Notificações Automáticas
- **Assinatura expirando:** 3 dias antes
- **Nova publicação:** Quando modelo seguida posta vídeo
- **Comentário aprovado:** Quando admin aprova

### Limites
- Comentários: Max 1000 caracteres
- Bio: Max 500 caracteres
- Avatar: Max 5MB, apenas jpg/png

---

## 📊 MÉTRICAS E ANALYTICS

### Tabelas de Analytics (Futuro)
- `user_activity_log` - Log de ações dos usuários
- `video_analytics` - Métricas de vídeos
- `model_analytics` - Métricas de modelos

---

## 🚀 DEPLOY E AMBIENTE

### Variáveis de Ambiente
```env
JWT_SECRET=your-secret-key-here
DATABASE_URL=postgresql://user:pass@host:5432/pornx_db
PORT=3000
NODE_ENV=production
```

### Dependências NPM
```json
{
  "jsonwebtoken": "^9.0.0",
  "bcrypt": "^5.1.0",
  "ws": "^8.13.0",
  "multer": "^1.4.5-lts.1",
  "express-validator": "^7.0.1"
}
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### SPRINT 1 - Base
- [ ] Migration com todas as tabelas
- [ ] Endpoints de autenticação
- [ ] Middleware de verificação
- [ ] Páginas de login/registro

### SPRINT 2 - Admin
- [ ] CRUD de usuários
- [ ] Gerenciamento de assinaturas
- [ ] Painel admin frontend

### SPRINT 3 - Interações
- [ ] Sistema de favoritos
- [ ] Sistema de seguir modelos
- [ ] Frontend das interações

### SPRINT 4 - Comentários
- [ ] CRUD de comentários
- [ ] Moderação admin
- [ ] Interface de comentários

### SPRINT 5 - Feed e Perfil
- [ ] Algoritmo de feed
- [ ] Perfil editável
- [ ] Upload de avatar

### SPRINT 6 - Histórico
- [ ] Registro de views
- [ ] Página de histórico

### SPRINT 7 - Notificações
- [ ] WebSocket setup
- [ ] Sistema de notificações
- [ ] Interface de notificações

### SPRINT 8 - Finalização
- [ ] CRON de bloqueio automático
- [ ] Documentação da API
- [ ] Testes

---

**Versão:** 1.0  
**Data:** 30/01/2026  
**Autor:** Sistema de Planejamento
