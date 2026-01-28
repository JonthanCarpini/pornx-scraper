# ⚙️ Configuração do Banco de Dados

## Problema: Erro ao salvar modelos

Se você está vendo erros como:
```
Erro ao salvar modelo: Ruby Li
✗ Erro ao salvar Ruby Li:
```

Isso significa que o banco de dados PostgreSQL não está configurado.

## Solução Rápida: Usar JSON (Sem Banco de Dados)

Se você não quer configurar PostgreSQL agora, use o scraper JSON:

```bash
# Pare o scraping atual (Ctrl+C no terminal do servidor)

# Use o scraper JSON
npm run scrape:json 10
```

Os dados serão salvos em `data/models-[timestamp].json`

## Solução Completa: Configurar PostgreSQL

### Passo 1: Instalar PostgreSQL

**Windows:**
1. Baixe: https://www.postgresql.org/download/windows/
2. Instale com as configurações padrão
3. Anote a senha que você definir

**Ou use Docker:**
```bash
docker run --name pornx-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pornx_db -p 5432:5432 -d postgres:15
```

### Passo 2: Criar arquivo .env

Crie um arquivo chamado `.env` na raiz do projeto com este conteúdo:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pornx_db
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_AQUI

SCRAPE_URL=https://pornx.tube/models/?by=model_viewed
SCRAPE_DELAY=2000
PORT=3000
```

**Importante:** Substitua `SUA_SENHA_AQUI` pela senha do PostgreSQL

### Passo 3: Criar o banco de dados

```bash
npm run init-db
```

Você deve ver:
```
✓ Banco de dados criado com sucesso!
✓ Tabela "models" criada
✓ Índices criados
```

### Passo 4: Testar conexão

```bash
npm start
```

Se aparecer "✓ Conexão bem-sucedida!", está tudo certo!

### Passo 5: Executar scraping

Agora você pode usar o Dashboard ou linha de comando:

```bash
npm run scrape 10
```

## Verificar se PostgreSQL está rodando

**Windows:**
```powershell
# Verificar serviço
Get-Service postgresql*

# Ou verificar porta
Test-NetConnection localhost -Port 5432
```

**Docker:**
```bash
docker ps | grep postgres
```

## Erros Comuns

### "ECONNREFUSED"
PostgreSQL não está rodando. Inicie o serviço.

### "password authentication failed"
Senha incorreta no arquivo `.env`

### "database does not exist"
Execute `npm run init-db`

### "relation models does not exist"
Execute `npm run init-db`

## Recomendação

Para testes rápidos, use `npm run scrape:json`

Para uso em produção com muitos dados, configure o PostgreSQL.
