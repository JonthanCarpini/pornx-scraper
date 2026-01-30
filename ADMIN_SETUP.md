# Sistema de Login Admin - XXXFollow Scraper

## 🔐 Configuração do Sistema de Autenticação

### 1. Instalar Dependências

```bash
npm install bcrypt cookie-parser express-session jsonwebtoken
```

### 2. Configurar Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# Autenticação Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=seu-secret-key-super-seguro-aqui-mude-em-producao

# Ou use senha em hash (mais seguro)
# ADMIN_PASSWORD=$2b$10$rZ5YhJKvX8qKqKqKqKqKqOqKqKqKqKqKqKqKqKqKqKqKqKqKqKqK
```

### 3. Gerar Hash de Senha (Opcional - Mais Seguro)

```javascript
const bcrypt = require('bcrypt');
const password = 'sua-senha-aqui';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

### 4. Estrutura de Arquivos

```
public/
  admin/
    login.html          # Página de login
    dashboard.html      # Dashboard principal
    xxxfollow.html      # Scraper XXXFollow (mover de xxxfollow-admin.html)
    
src/
  middleware/
    auth.js             # Middleware de autenticação JWT
  routes/
    auth.js             # Rotas de autenticação
```

### 5. Atualizar server.js

Adicionar no início do arquivo:

```javascript
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import { authenticateToken } from './middleware/auth.js';

// Após app.use(express.json())
app.use(cookieParser());

// Rotas de autenticação
app.use('/api/admin', authRoutes);

// Proteger rotas admin
app.use('/api/xxxfollow/*', authenticateToken);
app.use('/api/admin/*', authenticateToken);
```

### 6. Credenciais Padrão

**Usuário:** `admin`  
**Senha:** `admin123`

⚠️ **IMPORTANTE:** Altere as credenciais em produção!

### 7. Acessar o Sistema

1. Acesse: `http://localhost:3001/admin/login.html`
2. Faça login com as credenciais
3. Será redirecionado para o dashboard

### 8. Funcionalidades

- ✅ Login com JWT
- ✅ Cookie seguro (7 dias)
- ✅ Proteção de rotas admin
- ✅ Dashboard com estatísticas
- ✅ Logout
- ✅ Verificação de autenticação automática

### 9. Segurança

- Tokens JWT com expiração de 7 dias
- Cookies httpOnly
- Senhas em hash com bcrypt
- Middleware de autenticação em todas as rotas admin
- Redirecionamento automático se não autenticado

### 10. Próximos Passos

1. Instalar dependências: `npm install`
2. Configurar `.env` com credenciais seguras
3. Reiniciar servidor: `npm run server`
4. Acessar `/admin/login.html`
5. Mover `xxxfollow-admin.html` para `/admin/xxxfollow.html` e atualizar links
