# Estrutura Completa do Banco de Dados - PornX

## Tabelas Existentes no Servidor

### ✅ xxxfollow_videos
```sql
- id (PK)
- model_id (FK -> xxxfollow_models.id)
- xxxfollow_post_id (UNIQUE)
- xxxfollow_media_id
- title (text)
- description (text)
- video_url (text, NOT NULL)
- sd_url (text)
- thumbnail_url (text)
- poster_url (text)
- duration (integer)
- width (integer)
- height (integer)
- like_count (integer, default 0)
- view_count (integer, default 0)
- comment_count (integer, default 0)
- has_audio (boolean, default true)
- posted_at (timestamp)
- created_at (timestamp, default CURRENT_TIMESTAMP)
- updated_at (timestamp, default CURRENT_TIMESTAMP)
- status (varchar(20), default 'active')
```

### ✅ xxxfollow_models
```sql
- id (PK)
- xxxfollow_id (UNIQUE)
- username (varchar(255), NOT NULL, UNIQUE)
- display_name (varchar(255))
- avatar_url (text)
- cover_url (text)
- cover_video_url (text)
- gender (varchar(10))
- bio (text)
- follower_count (integer, default 0)
- like_count (integer, default 0)
- view_count (integer, default 0)
- post_count (integer, default 0)
- videos_scraped (boolean, default false)
- videos_scraped_at (timestamp)
- created_at (timestamp, default CURRENT_TIMESTAMP)
- updated_at (timestamp, default CURRENT_TIMESTAMP)
- status (varchar(20), default 'active')
- video_count (integer, default 0)
```

### ✅ clubeadulto_videos
```sql
- id (PK)
- model_id (FK -> clubeadulto_models.id)
- title (varchar(500), NOT NULL)
- video_url (varchar(500), NOT NULL, UNIQUE)
- thumbnail_url (varchar(500))
- poster_url (varchar(500))
- video_source_url (varchar(500))
- m3u8_url (varchar(500))
- created_at (timestamp, default CURRENT_TIMESTAMP)
- updated_at (timestamp, default CURRENT_TIMESTAMP)
- status (varchar(20), default 'active')
- view_count (integer, default 0)
- like_count (integer, default 0)
- comment_count (integer, default 0)
- duration (integer)
```

### ✅ clubeadulto_models
```sql
- id (PK)
- name (varchar, NOT NULL)
- url (varchar)
- image_url (text)
- videos_scraped (boolean)
- videos_scraped_at (timestamp)
- details_scraped (boolean)
- details_scraped_at (timestamp)
- created_at (timestamp, default CURRENT_TIMESTAMP)
- updated_at (timestamp, default CURRENT_TIMESTAMP)
- slug (varchar)
- profile_url (varchar)
- cover_url (text)
- video_count (integer, default 0)
- status (varchar(20), default 'active')
- gender (varchar)
- bio (text)
- follower_count (integer, default 0)
- like_count (integer, default 0)
- view_count (integer, default 0)
- post_count (integer, default 0)
```

### ✅ videos (NSFW247)
```sql
- id (PK)
- model_id (FK -> models.id)
- title (varchar(500), NOT NULL)
- video_url (text, NOT NULL, UNIQUE)
- thumbnail_url (text)
- poster_url (text)
- video_source_url (text) -- URL M3U8
- created_at (timestamp, default CURRENT_TIMESTAMP)
- updated_at (timestamp, default CURRENT_TIMESTAMP)
- status (varchar(20), default 'active')
- duration (integer)
- view_count (integer, default 0)
- like_count (integer, default 0)
- comment_count (integer, default 0)
```

### ✅ models (NSFW247)
```sql
- id (PK)
- name (varchar(255), NOT NULL)
- profile_url (text, NOT NULL, UNIQUE)
- cover_url (text)
- created_at (timestamp, default CURRENT_TIMESTAMP)
- updated_at (timestamp, default CURRENT_TIMESTAMP)
- video_count (integer, default 0)
- videos_scraped (boolean, default false)
- videos_scraped_at (timestamp)
- details_scraped (boolean, default false)
- details_scraped_at (timestamp)
- status (varchar(20), default 'active')
- gender (varchar(10))
- bio (text)
- follower_count (integer, default 0)
- like_count (integer, default 0)
- view_count (integer, default 0)
- post_count (integer, default 0)
```

---

## VIEW unified_videos (CORRETA)

```sql
CREATE OR REPLACE VIEW unified_videos AS
-- XXXFollow videos
SELECT 
    'xxxfollow' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.video_url,
    NULL as video_source_url,
    v.sd_url,
    v.duration,
    v.model_id,
    m.username as model_name,
    m.avatar_url as model_avatar,
    COALESCE(v.view_count, 0) + COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'xxxfollow' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'xxxfollow' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM xxxfollow_videos v
LEFT JOIN xxxfollow_models m ON v.model_id = m.id

UNION ALL

-- ClubAdulto videos
SELECT 
    'clubeadulto' as source,
    v.id,
    v.title,
    v.thumbnail_url,
    v.video_url,
    v.m3u8_url as video_source_url,
    NULL as sd_url,
    v.duration,
    v.model_id,
    m.name as model_name,
    m.image_url as model_avatar,
    COALESCE(v.view_count, 0) + COALESCE((SELECT COUNT(*) FROM video_views WHERE video_source = 'clubeadulto' AND video_id = v.id), 0) as view_count,
    COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_source = 'clubeadulto' AND video_id = v.id), 0) as like_count,
    v.created_at
FROM clubeadulto_videos v
LEFT JOIN clubeadulto_models m ON v.model_id = m.id;
```

---

## VIEW unified_models (CORRETA)

```sql
CREATE OR REPLACE VIEW unified_models AS
-- XXXFollow models
SELECT 
    'xxxfollow' as source,
    m.id,
    m.username as name,
    NULL as profile_url,
    m.avatar_url,
    m.cover_url as banner_url,
    COALESCE(m.cover_url, m.avatar_url) as cover_url,
    m.bio,
    m.gender,
    COALESCE(m.follower_count, 0) + COALESCE((SELECT COUNT(*) FROM follows WHERE model_source = 'xxxfollow' AND model_id = m.id), 0) as follower_count,
    m.like_count,
    m.view_count,
    m.post_count,
    m.video_count,
    m.status,
    m.created_at
FROM xxxfollow_models m

UNION ALL

-- ClubAdulto models
SELECT 
    'clubeadulto' as source,
    m.id,
    m.name,
    m.profile_url,
    m.image_url as avatar_url,
    m.cover_url as banner_url,
    COALESCE(m.cover_url, m.image_url) as cover_url,
    m.bio,
    m.gender,
    COALESCE(m.follower_count, 0) + COALESCE((SELECT COUNT(*) FROM follows WHERE model_source = 'clubeadulto' AND model_id = m.id), 0) as follower_count,
    m.like_count,
    m.view_count,
    m.post_count,
    m.video_count,
    m.status,
    m.created_at
FROM clubeadulto_models m;
```

---

## Tabelas de Analytics

### ✅ video_views
```sql
- id (PK)
- user_id (FK -> users.id)
- video_source (varchar(50))
- video_id (integer)
- viewed_at (timestamp, default CURRENT_TIMESTAMP)
- UNIQUE(user_id, video_source, video_id)
```

### ✅ video_likes
```sql
- id (PK)
- user_id (FK -> users.id)
- video_source (varchar(50))
- video_id (integer)
- liked_at (timestamp, default CURRENT_TIMESTAMP)
- UNIQUE(user_id, video_source, video_id)
```

---

## Diferenças Importantes Entre Tabelas

### Comparação de Models

| Campo | xxxfollow_models | clubeadulto_models | models (NSFW247) |
|-------|------------------|-------------------|------------------|
| Nome | `username` | `name` | `name` |
| Avatar | `avatar_url` | `image_url` | `cover_url` |
| Banner | `cover_url` | `cover_url` | ❌ Não existe |
| Profile URL | ❌ Não existe | ✅ `profile_url` | ✅ `profile_url` |

### Comparação de Videos

| Campo | xxxfollow_videos | clubeadulto_videos | videos (NSFW247) |
|-------|------------------|-------------------|------------------|
| Video Source | ❌ Não existe | ✅ `m3u8_url` | ✅ `video_source_url` |
| SD URL | ✅ `sd_url` | ❌ Não existe | ❌ Não existe |
| Description | ✅ `description` | ❌ Não existe | ❌ Não existe |
| Thumbnail | `thumbnail_url` | `thumbnail_url` | `thumbnail_url` |

---

## ⚠️ IMPORTANTE

1. **NSFW247 usa tabelas `models` e `videos`** (sem prefixo nsfw247_)
2. **xxxfollow usa `username`** - Não usar `name`
3. **clubeadulto usa `name`** - Não usar `username`
4. **clubeadulto usa `image_url`** - Não usar `avatar_url`
5. **NSFW247 usa `name`** - Não usar `username`
6. **NSFW247 usa `cover_url`** como avatar - Não tem banner separado
7. **Sempre usar LEFT JOIN** para evitar perder registros
8. **Sempre usar COALESCE** para valores nulos

---

## Endpoints da API

### GET /api/unified-videos
- Retorna vídeos de xxxfollow, clubeadulto e nsfw247
- Parâmetros: page, limit, random, source, modelId

### GET /api/unified-models  
- Retorna modelos de xxxfollow, clubeadulto e nsfw247
- Parâmetros: page, limit, source, modelId, search

### POST /api/analytics/view
- Registra visualização de vídeo
- Body: { video_source, video_id }

### POST /api/analytics/like
- Curtir vídeo
- Body: { video_source, video_id }

### DELETE /api/analytics/like/:source/:videoId
- Descurtir vídeo
