# 🌐 Interface Web - PornX Scraper

Interface web moderna para gerenciar o scraping e visualizar dados coletados.

## 🚀 Iniciar Servidor

```bash
npm run server
```

O servidor estará disponível em: **http://localhost:3000**

## 📱 Páginas Disponíveis

### 1. Página Inicial
**URL:** `http://localhost:3000`

Página de boas-vindas com acesso rápido às funcionalidades.

### 2. Dashboard
**URL:** `http://localhost:3000/dashboard.html`

**Funcionalidades:**
- ✅ Configurar número de páginas para scraping (1-100)
- ✅ Escolher entre salvar no banco de dados ou em JSON
- ✅ Iniciar scraping com um clique
- ✅ Acompanhar progresso em tempo real
- ✅ Visualizar logs do scraping
- ✅ Estatísticas gerais (total de modelos, vídeos, fotos)

**Como usar:**
1. Defina o número de páginas
2. Marque/desmarque "Salvar no banco de dados"
3. Clique em "Iniciar Scraping"
4. Acompanhe o progresso nos logs

### 3. Visualizar Modelos
**URL:** `http://localhost:3000/models.html`

**Funcionalidades:**
- ✅ Grid visual com todas as modelos coletadas
- ✅ Imagem de capa de cada modelo
- ✅ Nome, quantidade de vídeos e fotos
- ✅ Link direto para o perfil da modelo
- ✅ Paginação (20 modelos por página)
- ✅ Estatísticas em tempo real
- ✅ Atualização automática a cada 30 segundos

## 🔌 API Endpoints

### GET `/api/models`
Retorna lista de modelos com paginação.

**Query Parameters:**
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 20)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "models": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    },
    "stats": {
      "total_videos": "5000",
      "total_photos": "500",
      "avg_videos": "50.00",
      "avg_photos": "5.00"
    }
  }
}
```

### POST `/api/scrape/start`
Inicia o processo de scraping.

**Body:**
```json
{
  "pages": 5,
  "useDatabase": true
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Scraping iniciado para 5 página(s)",
  "useDatabase": true
}
```

### GET `/api/scrape/status`
Retorna status atual do scraping.

**Resposta:**
```json
{
  "success": true,
  "isRunning": true,
  "logs": [
    {
      "type": "info",
      "message": "Iniciando scraping...",
      "timestamp": "2026-01-28T06:30:00.000Z"
    }
  ]
}
```

### GET `/api/stats`
Retorna estatísticas gerais.

**Resposta:**
```json
{
  "success": true,
  "stats": {
    "total_models": "100",
    "total_videos": "5000",
    "total_photos": "500",
    "avg_videos": "50.00",
    "avg_photos": "5.00",
    "last_scrape": "2026-01-28T06:30:00.000Z"
  }
}
```

### DELETE `/api/models/:id`
Remove uma modelo do banco de dados.

**Resposta:**
```json
{
  "success": true,
  "message": "Modelo removida com sucesso"
}
```

## ⚙️ Configuração

### Variáveis de Ambiente

Adicione no arquivo `.env`:

```env
PORT=3000
```

### Requisitos

- ✅ Node.js 18+
- ✅ PostgreSQL (para funcionalidade completa)
- ✅ Dependências instaladas (`npm install`)

## 🎨 Recursos da Interface

### Design Moderno
- Gradiente roxo/azul
- Cards com sombras e animações
- Responsivo para mobile e desktop
- Ícones e emojis para melhor UX

### Tempo Real
- Logs atualizados automaticamente
- Status do scraping em tempo real
- Estatísticas que atualizam a cada 30s

### Facilidade de Uso
- Interface intuitiva
- Feedback visual claro
- Mensagens de erro amigáveis

## 🔧 Solução de Problemas

### Erro: "Cannot GET /"
**Solução:** Certifique-se de que o servidor está rodando com `npm run server`

### Erro: "Erro ao conectar ao banco"
**Solução:** 
1. Verifique se o PostgreSQL está rodando
2. Confirme as credenciais no arquivo `.env`
3. Execute `npm run init-db` para criar as tabelas

### Scraping não inicia
**Solução:**
1. Verifique os logs no console do servidor
2. Certifique-se de que não há outro scraping em execução
3. Reinicie o servidor

## 📊 Exemplo de Uso Completo

```bash
# 1. Configurar banco de dados
npm run init-db

# 2. Iniciar servidor web
npm run server

# 3. Acessar no navegador
# http://localhost:3000

# 4. No Dashboard:
#    - Definir 10 páginas
#    - Marcar "Salvar no banco de dados"
#    - Clicar em "Iniciar Scraping"

# 5. Acompanhar progresso nos logs

# 6. Ir para "Visualizar Dados" para ver resultados
```

## 🚀 Próximos Passos

Após coletar dados:
1. Acesse o Dashboard para ver estatísticas
2. Vá para "Visualizar Dados" para explorar as modelos
3. Clique em "Ver Perfil" para acessar o perfil original
4. Execute novos scrapings conforme necessário
