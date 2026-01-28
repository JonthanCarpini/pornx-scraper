# 🚀 Guia de Instalação e Execução Local

## Pré-requisitos

1. **Node.js** (versão 18 ou superior)
   - Verificar: `node --version`
   - Download: https://nodejs.org/

2. **PostgreSQL** (versão 12 ou superior)
   - Verificar: `psql --version`
   - Download: https://www.postgresql.org/download/

## Passo a Passo

### 1. Instalar Dependências

```bash
cd c:/Users/admin/Documents/Projetos/pornx
npm install
```

### 2. Configurar Banco de Dados PostgreSQL

#### Opção A: Usar PostgreSQL Local

1. Inicie o PostgreSQL
2. Crie um banco de dados:

```sql
CREATE DATABASE pornx_db;
```

3. Copie o arquivo de configuração:

```bash
copy .env.example .env
```

4. Edite o arquivo `.env` com suas credenciais:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pornx_db
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui

SCRAPE_URL=https://pornx.tube/models/?by=model_viewed
SCRAPE_DELAY=2000
```

#### Opção B: Usar Docker (Recomendado)

Se você tiver Docker instalado, pode usar PostgreSQL em container:

```bash
docker run --name pornx-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pornx_db -p 5432:5432 -d postgres:15
```

Configure o `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pornx_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### 3. Inicializar Banco de Dados

```bash
npm run init-db
```

Você deve ver:
```
✓ Banco de dados criado com sucesso!
✓ Tabela "models" criada
✓ Índices criados
✓ Trigger de atualização configurado
```

### 4. Testar Conexão

```bash
npm start
```

Deve exibir:
```
✓ Conexão bem-sucedida!
Total de modelos no banco: 0
```

### 5. Executar Scraping

Para coletar dados de 5 páginas (padrão):
```bash
npm run scrape
```

Para coletar de um número específico de páginas:
```bash
node src/scraper.js 10
```

### 6. Consultar Dados Coletados

```bash
npm run query
```

## 📊 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm install` | Instala todas as dependências |
| `npm start` | Testa conexão com banco de dados |
| `npm run init-db` | Cria tabelas no banco de dados |
| `npm run scrape` | Executa o scraping (5 páginas) |
| `node src/scraper.js [N]` | Executa scraping de N páginas |
| `npm run query` | Consulta e exibe estatísticas |

## ⚙️ Configurações

### Ajustar Delay entre Páginas

No arquivo `.env`, altere:
```env
SCRAPE_DELAY=3000  # 3 segundos entre cada página
```

### Alterar URL de Scraping

```env
SCRAPE_URL=https://pornx.tube/models/?by=model_viewed
```

## 🐛 Solução de Problemas

### Erro de Conexão com Banco

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solução:** Verifique se o PostgreSQL está rodando:
```bash
# Windows
pg_ctl status

# Ou verifique os serviços do Windows
services.msc
```

### Erro de Permissão

```
Error: permission denied for database
```

**Solução:** Verifique as credenciais no arquivo `.env`

### Puppeteer não Funciona

```
Error: Failed to launch the browser process
```

**Solução:** Instale as dependências do Chromium:
```bash
npm install puppeteer --force
```

## 📈 Exemplo de Saída

```
🎯 Iniciando scraping de até 5 páginas...

🚀 Iniciando scraping da página 1...
📄 Acessando: https://pornx.tube/models/?by=model_viewed
✓ Encontradas 60 modelos na página 1
  ✓ [1/60] Ruby Li - 33 vídeos, 2 fotos
  ✓ [2/60] Alexis Texas - 45 vídeos, 5 fotos
  ...

✅ Página 1 concluída: 60/60 modelos salvas

============================================================
📊 RESUMO DO SCRAPING
============================================================
Total de modelos encontradas: 300
Total de modelos salvas: 300
============================================================
```
