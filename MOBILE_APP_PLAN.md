# 📱 PLANO DE DESENVOLVIMENTO - APP MOBILE PORNX

**Data:** 31/01/2026  
**Versão:** 1.0  
**Status:** Planejamento Aprovado

---

## 🎯 VISÃO GERAL

Desenvolvimento de aplicativo mobile Android nativo usando React Native, replicando e otimizando as funcionalidades da versão web com foco em experiência mobile-first estilo TikTok/Reels.

---

## 📊 DECISÕES TÉCNICAS

### Stack Tecnológica
- **Framework:** React Native (TypeScript)
- **Plataforma:** Android (MVP)
- **Backend:** Node.js existente (sem alterações iniciais)
- **Banco de Dados:** PostgreSQL existente
- **Player:** react-native-video + ExoPlayer (Android)
- **Navegação:** React Navigation v6
- **Estado:** Context API + AsyncStorage
- **Requisições:** Axios

### Bibliotecas Principais
```json
{
  "react-native": "^0.73.x",
  "react-native-video": "^6.0.x",
  "react-navigation": "^6.x",
  "axios": "^1.6.x",
  "@react-native-async-storage/async-storage": "^1.21.x",
  "react-native-gesture-handler": "^2.14.x",
  "react-native-reanimated": "^3.6.x",
  "react-native-fast-image": "^8.6.x"
}
```

---

## 🏗️ ARQUITETURA DO PROJETO

```
pornx-mobile/
├── android/                    # Configurações Android nativas
├── ios/                        # (Futuro) Configurações iOS
├── src/
│   ├── api/                    # Serviços de API
│   │   ├── client.ts          # Axios configurado
│   │   ├── auth.ts            # Endpoints de autenticação
│   │   ├── videos.ts          # Endpoints de vídeos
│   │   ├── models.ts          # Endpoints de modelos
│   │   └── user.ts            # Favoritos, follows, etc
│   │
│   ├── components/             # Componentes reutilizáveis
│   │   ├── VideoPlayer/       # Player de vídeo otimizado
│   │   ├── VideoCard/         # Card de vídeo para grid
│   │   ├── ModelCard/         # Card de modelo
│   │   ├── SearchBar/         # Barra de busca
│   │   ├── FilterChips/       # Chips de filtro
│   │   └── LoadingSpinner/    # Loading
│   │
│   ├── screens/                # Telas do app
│   │   ├── Auth/
│   │   │   └── LoginScreen.tsx
│   │   ├── Feed/
│   │   │   └── FeedScreen.tsx          # Feed vertical
│   │   ├── Home/
│   │   │   └── HomeScreen.tsx          # Grid de vídeos
│   │   ├── Models/
│   │   │   ├── ModelsListScreen.tsx    # Lista de modelos
│   │   │   └── ModelProfileScreen.tsx  # Perfil da modelo
│   │   ├── Search/
│   │   │   └── SearchScreen.tsx
│   │   ├── Favorites/
│   │   │   └── FavoritesScreen.tsx
│   │   └── Profile/
│   │       └── ProfileScreen.tsx       # Perfil do usuário
│   │
│   ├── navigation/             # Navegação
│   │   ├── AppNavigator.tsx   # Navegação principal
│   │   ├── AuthNavigator.tsx  # Stack de autenticação
│   │   └── MainNavigator.tsx  # Tab Navigator
│   │
│   ├── contexts/               # Context API
│   │   ├── AuthContext.tsx    # Estado de autenticação
│   │   ├── VideoContext.tsx   # Estado de vídeos
│   │   └── UserContext.tsx    # Favoritos, follows
│   │
│   ├── hooks/                  # Custom Hooks
│   │   ├── useAuth.ts
│   │   ├── useVideos.ts
│   │   ├── useModels.ts
│   │   └── useInfiniteScroll.ts
│   │
│   ├── utils/                  # Utilitários
│   │   ├── storage.ts         # AsyncStorage helpers
│   │   ├── formatters.ts      # Formatação de dados
│   │   └── constants.ts       # Constantes
│   │
│   ├── types/                  # TypeScript types
│   │   ├── video.ts
│   │   ├── model.ts
│   │   └── user.ts
│   │
│   └── theme/                  # Tema e estilos
│       ├── colors.ts
│       ├── typography.ts
│       └── spacing.ts
│
├── App.tsx                     # Entry point
├── package.json
└── tsconfig.json
```

---

## 🎯 FUNCIONALIDADES - MVP (V1)

### ✅ Prioridade Máxima
1. **Feed Vertical (FeedScreen)**
   - Scroll vertical infinito
   - Autoplay ao entrar na viewport
   - Pause ao sair da viewport
   - Gestos: swipe up/down
   - Animações de transição
   - Barra de progresso
   - Sidebar: like, follow, share, perfil
   - Otimização: carregar apenas 3 vídeos (anterior, atual, próximo)
   - Cancelamento de requisições ao trocar vídeo

2. **Lista de Vídeos (HomeScreen)**
   - Grid 2 colunas
   - Thumbnail + duração
   - Infinite scroll
   - Pull to refresh
   - Filtros por source (xxxfollow, clubeadulto, nsfw247)
   - Click abre modal de player

3. **Autenticação (LoginScreen)**
   - Login com email/senha
   - Persistência de sessão (AsyncStorage)
   - Validação de campos
   - Feedback de erro
   - **Sem cadastro** (usuários criados manualmente)

### ✅ Essencial
4. **Lista de Modelos (ModelsListScreen)**
   - Grid 2 colunas
   - Avatar + nome + vídeos count
   - Infinite scroll
   - Pull to refresh
   - Click abre perfil

5. **Perfil da Modelo (ModelProfileScreen)**
   - Header: avatar, nome, bio, botão seguir
   - Grid de vídeos da modelo
   - Estatísticas: vídeos, seguidores
   - Click em vídeo abre feed da modelo

6. **Busca e Filtros (SearchScreen)**
   - Busca por título/modelo
   - Filtros: source, ordenação
   - Resultados em grid
   - Histórico de buscas

7. **Favoritos (FavoritesScreen)**
   - Grid de vídeos favoritados
   - Remover favorito
   - Empty state

8. **Follows**
   - Lista de modelos seguidas
   - Deixar de seguir
   - Empty state

---

## 📱 COMPONENTES PRINCIPAIS

### 1. VideoPlayer Component
```typescript
interface VideoPlayerProps {
  videoUrl: string;
  isActive: boolean;
  onEnd?: () => void;
  onProgress?: (progress: number) => void;
}

// Features:
// - ExoPlayer para Android
// - Suporte HLS (m3u8, ts)
// - Suporte MP4
// - Autoplay quando isActive=true
// - Pause quando isActive=false
// - Controles mínimos (play/pause, mute)
// - Barra de progresso
// - Gesture: double tap para like
// - Gesture: tap para play/pause
```

### 2. FeedScreen Component
```typescript
// Lógica:
// - FlatList com windowSize={3} (otimização)
// - onViewableItemsChanged para detectar vídeo ativo
// - Pré-carregamento do próximo vídeo
// - Cancelamento de requisições ao sair da viewport
// - Animações de transição (Reanimated)
// - Sidebar com ações
```

### 3. VideoCard Component
```typescript
interface VideoCardProps {
  video: Video;
  onPress: () => void;
}

// Features:
// - Thumbnail com FastImage
// - Duração overlay
// - Título (2 linhas max)
// - Nome da modelo
// - Like count
// - Skeleton loading
```

---

## 🔌 INTEGRAÇÃO COM BACKEND

### Endpoints Utilizados (Existentes)
```typescript
// Autenticação
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

// Vídeos
GET  /api/unified-videos?page=1&limit=20&source=&search=&modelId=&random=
GET  /api/proxy/m3u8?url=

// Modelos
GET  /api/unified-models?page=1&limit=20&search=

// Favoritos
GET    /api/favorites
POST   /api/favorites { video_source, video_id }
DELETE /api/favorites/:source/:id

// Follows
GET    /api/follows
POST   /api/follows { source, model_id }
DELETE /api/follows/:source/:id

// Analytics
POST /api/views { video_source, video_id }
POST /api/likes { video_source, video_id }
```

### Ajustes Necessários no Backend (Futuro)
- [ ] Endpoint para notificações push (V2)
- [ ] Tabela de tokens de dispositivos (V2)
- [ ] Endpoint de refresh token (opcional)

---

## 🎨 DESIGN MOBILE-FIRST

### Paleta de Cores (Baseada no Web)
```typescript
export const colors = {
  primary: '#667eea',
  secondary: '#764ba2',
  background: '#0a0a0a',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#999999',
  error: '#ff4444',
  success: '#00C851',
  overlay: 'rgba(0, 0, 0, 0.5)',
};
```

### Componentes de UI
- Bottom Tab Navigator (Home, Feed, Search, Profile)
- Cards com sombras e bordas arredondadas
- Skeleton loaders
- Pull to refresh
- Empty states
- Error states
- Loading states

---

## 📋 FASES DE IMPLEMENTAÇÃO

### **FASE 1: Setup e Estrutura (1-2 dias)**
- [ ] Criar projeto React Native
- [ ] Configurar TypeScript
- [ ] Configurar ESLint + Prettier
- [ ] Estrutura de pastas
- [ ] Configurar navegação básica
- [ ] Configurar tema e estilos globais
- [ ] Setup de API client (Axios)

### **FASE 2: Autenticação (2-3 dias)**
- [ ] Tela de Login
- [ ] AuthContext
- [ ] Integração com API de login
- [ ] Persistência de sessão (AsyncStorage)
- [ ] Proteção de rotas
- [ ] Tela de splash

### **FASE 3: Home - Lista de Vídeos (3-4 dias)**
- [ ] HomeScreen com grid
- [ ] VideoCard component
- [ ] Integração com API de vídeos
- [ ] Infinite scroll
- [ ] Pull to refresh
- [ ] Filtros por source
- [ ] Modal de player básico
- [ ] Loading e error states

### **FASE 4: Feed Vertical (5-7 dias)**
- [ ] FeedScreen com FlatList otimizado
- [ ] VideoPlayer component com ExoPlayer
- [ ] Suporte HLS (m3u8, ts, mp4)
- [ ] Autoplay/pause baseado em viewport
- [ ] Gestos (swipe, double tap, tap)
- [ ] Sidebar com ações
- [ ] Barra de progresso
- [ ] Animações de transição
- [ ] Otimização de memória (windowSize)
- [ ] Cancelamento de requisições

### **FASE 5: Modelos (3-4 dias)**
- [ ] ModelsListScreen com grid
- [ ] ModelCard component
- [ ] Integração com API de modelos
- [ ] ModelProfileScreen
- [ ] Header do perfil
- [ ] Grid de vídeos da modelo
- [ ] Botão de seguir/deixar de seguir
- [ ] Abrir feed da modelo

### **FASE 6: Busca e Filtros (2-3 dias)**
- [ ] SearchScreen
- [ ] SearchBar component
- [ ] Integração com API de busca
- [ ] Filtros avançados
- [ ] Histórico de buscas (AsyncStorage)
- [ ] Resultados em grid

### **FASE 7: Favoritos e Follows (2-3 dias)**
- [ ] FavoritesScreen
- [ ] Integração com API de favoritos
- [ ] Adicionar/remover favorito
- [ ] FollowsScreen
- [ ] Integração com API de follows
- [ ] Seguir/deixar de seguir

### **FASE 8: Perfil do Usuário (1-2 dias)**
- [ ] ProfileScreen
- [ ] Exibir dados do usuário
- [ ] Logout
- [ ] Configurações básicas

### **FASE 9: Polimento e Otimização (3-4 dias)**
- [ ] Animações e transições
- [ ] Feedback visual (toasts, haptics)
- [ ] Otimização de performance
- [ ] Tratamento de erros
- [ ] Loading states
- [ ] Empty states
- [ ] Testes manuais
- [ ] Correção de bugs

### **FASE 10: Build e Deploy (1-2 dias)**
- [ ] Configurar assinatura Android
- [ ] Gerar APK/AAB
- [ ] Testar em dispositivos reais
- [ ] Preparar para Google Play (futuro)

**TOTAL ESTIMADO: 23-35 dias de desenvolvimento**

---

## 🚀 ROADMAP V2 (Futuro)

### Funcionalidades V2
- [ ] Notificações push
- [ ] Comentários em vídeos
- [ ] Compartilhamento
- [ ] Download de vídeos (offline)
- [ ] Modo escuro/claro
- [ ] Idiomas (i18n)
- [ ] Analytics avançado
- [ ] Deep linking
- [ ] Versão iOS

### Melhorias Técnicas V2
- [ ] Redux/Zustand para estado global
- [ ] React Query para cache
- [ ] Sentry para error tracking
- [ ] Firebase Analytics
- [ ] CodePush para updates OTA
- [ ] Testes automatizados (Jest, Detox)

---

## 🔧 OTIMIZAÇÕES DE PERFORMANCE

### Player de Vídeo
- Usar ExoPlayer nativo (melhor performance que JS)
- Carregar apenas 3 vídeos por vez (anterior, atual, próximo)
- Cancelar requisições de vídeos fora da viewport
- Cache de thumbnails com FastImage
- Lazy loading de componentes

### Lista/Grid
- FlatList com windowSize={5}
- getItemLayout para performance
- removeClippedSubviews={true}
- maxToRenderPerBatch={5}
- Skeleton loaders

### Rede
- Timeout de requisições (10s)
- Retry automático (3x)
- Cache de respostas (AsyncStorage)
- Compressão de imagens

---

## 📦 DEPENDÊNCIAS COMPLETAS

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.2",
    "react-native-video": "^6.0.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@react-navigation/stack": "^6.3.20",
    "axios": "^1.6.5",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "react-native-gesture-handler": "^2.14.1",
    "react-native-reanimated": "^3.6.1",
    "react-native-fast-image": "^8.6.3",
    "react-native-safe-area-context": "^4.8.2",
    "react-native-screens": "^3.29.0",
    "react-native-linear-gradient": "^2.8.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "@types/react-native": "^0.73.0",
    "typescript": "^5.3.3",
    "@typescript-eslint/eslint-plugin": "^6.16.0",
    "@typescript-eslint/parser": "^6.16.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

---

## ✅ CHECKLIST DE APROVAÇÃO

Antes de iniciar a implementação, confirme:

- [x] Stack: React Native + TypeScript
- [x] Plataforma: Android primeiro
- [x] Backend: Usar existente
- [x] Player: react-native-video + ExoPlayer
- [x] Suporte HLS: Sim (m3u8, ts, mp4)
- [x] Funcionalidades MVP definidas
- [x] Arquitetura aprovada
- [x] Fases de implementação claras
- [x] Estimativa de tempo: 23-35 dias

---

## 🎯 PRÓXIMOS PASSOS

1. **Aprovar este plano**
2. **Criar projeto React Native**
3. **Iniciar Fase 1: Setup e Estrutura**
4. **Implementar fase por fase**
5. **Testar continuamente**
6. **Deploy do MVP**

---

**Aguardando sua aprovação para iniciar a implementação! 🚀**
