# PornX Scraper

Sistema completo de scraping para coletar dados de modelos do site pornx.tube com interface web moderna.

## 🚀 Instalação

```bash
npm install
```

## ⚙️ Configuração

1. Copie o arquivo `.env.example` para `.env`
2. Configure as credenciais do banco de dados PostgreSQL
3. Execute o script de inicialização do banco:

```bash
npm run init-db
```

## 💻 Interface Web (Recomendado)

### Iniciar Servidor Web
```bash
npm run server
```

Acesse: **http://localhost:3000**

### Funcionalidades da Interface:
- ✅ **Dashboard**: Configure e execute scraping com interface visual
- ✅ **Visualizar Dados**: Veja todas as modelos coletadas em grid visual
- ✅ **Logs em Tempo Real**: Acompanhe o progresso do scraping
- ✅ **Estatísticas**: Veja totais e médias automaticamente

📖 **Documentação completa:** [README_WEB.md](README_WEB.md)

## 🖥️ Linha de Comando

### Scraping com Banco de Dados
```bash
npm run scrape
```

### Scraping para JSON (sem banco)
```bash
npm run scrape:json
```

### Consultar Dados
```bash
npm run query
```

## 📊 Estrutura do Banco de Dados

A tabela `models` armazena:
- `id`: ID único da modelo
- `name`: Nome da modelo
- `profile_url`: URL da página da modelo
- `cover_url`: URL da imagem de capa
- `video_count`: Quantidade de vídeos
- `photo_count`: Quantidade de fotos
- `created_at`: Data de criação do registro
- `updated_at`: Data da última atualização

## 📝 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run server` | Inicia interface web |
| `npm run scrape` | Scraping com PostgreSQL |
| `npm run scrape:json` | Scraping para JSON |
| `npm run init-db` | Cria tabelas no banco |
| `npm run query` | Consulta dados do banco |
