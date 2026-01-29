# Como Configurar Cookies de Autenticação do XXXFollow

## 🔐 Por que preciso de cookies?

Alguns modelos do XXXFollow só disponibilizam vídeos completos para usuários autenticados. Sem autenticação, a API retorna apenas previews borradas (`blur_url`).

## 📋 Como obter os cookies

1. **Acesse** https://www.xxxfollow.com e faça login
2. **Abra as Ferramentas do Desenvolvedor** (F12)
3. **Vá para a aba "Application" ou "Armazenamento"**
4. **Clique em "Cookies" → "https://www.xxxfollow.com"**
5. **Copie os valores dos seguintes cookies:**
   - `auth_id`
   - `XSRF-TOKEN`
   - `www_cs_session`

## ⚙️ Como configurar no servidor

### Opção 1: Via arquivo .env (Recomendado)

Edite o arquivo `.env` no servidor e adicione:

```bash
XXXFOLLOW_AUTH_ID=eyJpdiI6InZ4dTV3eThWaGNEQnF1cERXb3ZXN3c9PSIsInZhbHVlIjoiWVArQWtKSkt4UFNGMEJIekxyRjY3ZzEzM1ZJelJaNEUwUFMrTFpTTjZFc1JKZ3VhUlFubkE3dWJOdGNEeFovYnZ3K1JHc1JoenpGN1hWNkw5TDY2NzdzVGo0VnFjTXI3dldLTTVSNlBKYmtqUUN5M21YM2E0d1pnclBaMGlvYVkiLCJtYWMiOiJlNGI0MDk4ODYzOWZjZGY1NDA2YTVjOWY3MmQ1Y2I2ZjhhZTZmZDUwZWM4MGUyNTJkZTliZDY4OTNhOThlM2U4IiwidGFnIjoiIn0%3D

XXXFOLLOW_XSRF_TOKEN=eyJpdiI6IitYT3F0NXJxK0djUmJwcHhValBscVE9PSIsInZhbHVlIjoidTZwR2l6LzhKVHJBZTJkZGtoTFN0RnYwdlR6WkplNjFja0JvdStFS1JjT3BneitDK2hEQjBiN3B4QTgveGJlNHpMMkNOR3I0R25uMWQvbTJ6REtZVzJtb1lSeWNYY1NPNU9ZVTJMeUk1SE95N1k5REhMZktzNW1UWEp0L25JK2oiLCJtYWMiOiJlN2NlY2U1Y2Q3NzA1MWQ0MzU5NWE1NjFiYzY1YzAxNjUzMzA4YTI5ODhhZmVlMDYwNGM5NWM4NjkyMDk2YTI0IiwidGFnIjoiIn0%3D

XXXFOLLOW_SESSION=eyJpdiI6IkU3Vm1wei9TUXNFN3pKS3RCNVZmOVE9PSIsInZhbHVlIjoibmVWN2lNbkw5VHNWcWszd0dGSjZoYzFKNTBxdTJhY3hEbjZVYjlsd1lhTkRNMS82bXJZd1AyUnJZUkppSVl2SXkvWG9sOEJEL1M2cDk2dzllUVZ3WFFHcytvd3ZIa1BMVWMyWVo3WnRoMUFkWTZTV2ZLTmdLNGtoOGhYLzlybUoiLCJtYWMiOiJkNGYzZjI0MDQ3OTQ5ODY3MDk4M2M1NTYxNDY5OWY0NTUyNmVlNDUzMjgwOGVkYjhlMzA0ODM1MDJlN2VhNDdmIiwidGFnIjoiIn0%3D
```

### Opção 2: Via Easypanel

1. Acesse o Easypanel
2. Vá para o projeto `pornx-scraper`
3. Clique em **"Environment"**
4. Adicione as 3 variáveis acima
5. Clique em **"Save"** e aguarde o redeploy

## 🔄 Renovação dos cookies

Os cookies expiram após 30 dias. Quando isso acontecer:

1. Faça login novamente no XXXFollow
2. Copie os novos valores dos cookies
3. Atualize as variáveis de ambiente
4. Reinicie o scraper

## ⚠️ Importante

- **Mantenha os cookies em segredo** - eles dão acesso à sua conta
- **Não compartilhe** os valores dos cookies
- **Use uma conta dedicada** para scraping (não sua conta pessoal)

## ✅ Como testar

Após configurar os cookies, teste com:

```bash
docker exec onlysuper_pornx-scraper-app-1 node test-api.js emmily-giraldo
```

Se configurado corretamente, você verá `fhd_url`, `sd_url` ou `url` nos vídeos (não apenas `blur_url`).
