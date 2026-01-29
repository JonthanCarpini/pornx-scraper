# 🚀 Deploy no Easypanel (VPS com Docker)

Este guia mostra como fazer deploy da aplicação PornX Scraper em uma VPS usando Easypanel.

## 📋 Pré-requisitos

- VPS com Docker instalado
- Easypanel instalado na VPS
- Acesso SSH à VPS
- Backup do banco de dados local

## 🔧 Passo 1: Backup do Banco de Dados Local

No seu computador local, execute:

```bash
npm run backup:db
```

Isso criará um arquivo em `backups/pornx_backup_YYYY-MM-DD.sql`

## 📦 Passo 2: Preparar Arquivos para Deploy

1. **Criar arquivo .env para produção:**

```bash
cp .env.production .env
```

2. **Editar .env e configurar senha segura:**

```env
DB_PASSWORD=SUA_SENHA_SEGURA_AQUI
```

## 🌐 Passo 3: Deploy no Easypanel

### Opção A: Deploy via Git (Recomendado)

1. **Fazer push do código para repositório Git:**

```bash
git add .
git commit -m "Preparar para deploy em produção"
git push origin main
```

2. **No Easypanel:**
   - Criar novo projeto
   - Conectar ao repositório Git
   - Configurar build:
     - Build Command: `docker build -t pornx-app .`
     - Start Command: `docker-compose up -d`

3. **Configurar variáveis de ambiente no Easypanel:**
   - `DB_NAME=pornx_db`
   - `DB_USER=postgres`
   - `DB_PASSWORD=SUA_SENHA_SEGURA`
   - `NODE_ENV=production`
   - `SCRAPE_DELAY=2000`

### Opção B: Deploy Manual via SSH

1. **Conectar à VPS via SSH:**

```bash
ssh user@seu-servidor.com
```

2. **Criar diretório do projeto:**

```bash
mkdir -p /app/pornx
cd /app/pornx
```

3. **Copiar arquivos do projeto para VPS:**

```bash
# No seu computador local
scp -r . user@seu-servidor.com:/app/pornx/
```

4. **Na VPS, iniciar containers:**

```bash
cd /app/pornx
docker-compose up -d
```

## 📊 Passo 4: Restaurar Banco de Dados

1. **Copiar backup para VPS:**

```bash
# No seu computador local
scp backups/pornx_backup_*.sql user@seu-servidor.com:/app/pornx/backups/
```

2. **Na VPS, executar restore:**

```bash
# Aguardar containers iniciarem
docker-compose ps

# Executar restore dentro do container
docker-compose exec app node restore-database.js /backups/pornx_backup_YYYY-MM-DD.sql
```

Ou diretamente no PostgreSQL:

```bash
docker-compose exec postgres psql -U postgres -d pornx_db -f /backups/pornx_backup_YYYY-MM-DD.sql
```

## ✅ Passo 5: Verificar Deploy

1. **Verificar containers rodando:**

```bash
docker-compose ps
```

2. **Verificar logs:**

```bash
docker-compose logs -f app
```

3. **Acessar aplicação:**

```
http://seu-servidor.com:3000/home.html
```

## 🔄 Passo 6: Executar Migrations

```bash
docker-compose exec app node run-migration.js
docker-compose exec app node update-scraping-flags.js
```

## 🛠️ Comandos Úteis

### Gerenciar containers:

```bash
# Parar containers
docker-compose down

# Reiniciar containers
docker-compose restart

# Ver logs
docker-compose logs -f

# Executar comando no container
docker-compose exec app npm run scrape:videos
```

### Backup e Restore:

```bash
# Backup do banco (dentro do container)
docker-compose exec app node backup-database.js

# Restore do banco
docker-compose exec app node restore-database.js /backups/arquivo.sql
```

### Atualizar aplicação:

```bash
# Pull do código atualizado
git pull origin main

# Rebuild e restart
docker-compose up -d --build
```

## 🔒 Segurança

1. **Alterar senha padrão do PostgreSQL**
2. **Configurar firewall para expor apenas portas necessárias**
3. **Usar HTTPS com certificado SSL (Nginx/Caddy)**
4. **Configurar backups automáticos**

## 📝 Configuração de Domínio

Se usar domínio personalizado, configure proxy reverso no Easypanel:

```
Domain: pornx.seudominio.com
Port: 3000
SSL: Enabled
```

## 🐛 Troubleshooting

### Container não inicia:

```bash
docker-compose logs app
```

### Banco de dados não conecta:

```bash
docker-compose exec postgres pg_isready -U postgres
```

### Erro de permissão:

```bash
docker-compose exec app chown -R node:node /app
```

## 📊 Monitoramento

Configure monitoramento no Easypanel para:
- CPU e memória
- Espaço em disco
- Status dos containers
- Logs de erro

## 🎉 Pronto!

Sua aplicação está rodando em produção com Docker! 🚀
