# PornX Scraper

Sistema de scraping para coletar dados de modelos do site pornx.tube.

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`
2. Configure as credenciais do banco de dados PostgreSQL
3. Execute o script de inicialização do banco:

```bash
npm run init-db
```

## Uso

Para executar o scraper:

```bash
npm run scrape
```

## Estrutura do Banco de Dados

A tabela `models` armazena:
- `id`: ID único da modelo
- `name`: Nome da modelo
- `profile_url`: URL da página da modelo
- `cover_url`: URL da imagem de capa
- `video_count`: Quantidade de vídeos
- `photo_count`: Quantidade de fotos
- `created_at`: Data de criação do registro
- `updated_at`: Data da última atualização
