# DocitoMapas — Guia 3D de Roteiros de Viagem

> Documento mestre de especificação do software. Serve como **fonte única de verdade** para qualquer agente desenvolvedor (humano ou IA) que implemente o projeto.
> **Versão:** 1.0.0 · **Data:** 2026-06-30 · **Idioma padrão do produto:** pt-BR

---

## 1. Visão Geral do Produto

**DocitoMapas** é uma aplicação web que permite ao usuário planejar um roteiro de viagem com **endereço de partida, múltiplas paradas intermediárias e destino final**, calcula automaticamente a **ordem ótima das paradas** (menor tempo total de percurso) e, ao final, reproduz um **vídeo cinematográfico com um boneco 3D percorrendo o caminho** sobre um mapa realista, com controles de **velocidade** e **níveis de zoom** — do zoom estratosférico até o zoom "rua real" (photorealistic 3D tiles).

### 1.1 Proposta de Valor
- Planejamento visual e lúdico de viagens (road trips, entregas, city tours, mudanças).
- Otimização automática de ordem de paradas (Traveling Salesman Problem — TSP).
- Experiência imersiva que substitui prints estáticos do Google Maps por uma "animação-filme" do trajeto.
- 100% executável no navegador; sem instalação.

### 1.2 Público-alvo
- Viajantes recreativos que planejam road trips.
- Criadores de conteúdo (YouTube, Instagram Reels, TikTok) que precisam de "flyover" do roteiro.
- Motoristas de aplicativo / entregadores que querem visualizar rota otimizada.
- Professores de geografia / educadores.

---

## 2. Requisitos Funcionais (RF)

| ID | Requisito | Prioridade |
|----|-----------|:---:|
| RF-01 | Cadastrar endereço de **partida** via busca com autocomplete. | Must |
| RF-02 | Adicionar **N paradas intermediárias** (≥ 1, ≤ 25 na v1). | Must |
| RF-03 | Definir endereço de **destino final**. | Must |
| RF-04 | Reordenar paradas manualmente (drag-and-drop). | Should |
| RF-05 | Marcar uma parada como "**fixa**" (ordem não pode ser alterada pelo otimizador). | Should |
| RF-06 | Calcular a **ordem ótima das paradas** minimizando o **tempo total** de percurso. | Must |
| RF-07 | Escolher **modo de transporte**: carro, moto, caminhão, bicicleta, pedestre. | Must |
| RF-08 | Exibir no mapa: rota traçada (polyline), pinos numerados em ordem, tempo e distância por trecho. | Must |
| RF-09 | Renderizar animação 3D de um **boneco/personagem** percorrendo a rota no mapa. | Must |
| RF-10 | Controle de **playback**: play, pause, seek, velocidade (1x, 2x, 4x, 8x, 16x, 32x). | Must |
| RF-11 | Controle de **zoom** com presets: Global (satélite), País, Cidade, Bairro, Rua, "Street View" (3D fotorrealista). | Must |
| RF-12 | Câmera com modos: **top-down**, **isométrica 45°**, **third-person** (atrás do boneco), **first-person** (POV). | Should |
| RF-13 | **Exportar vídeo** MP4/WebM do trajeto animado. | Should |
| RF-14 | Salvar roteiros no dispositivo (localStorage) e/ou conta de usuário. | Should |
| RF-15 | Compartilhar roteiro via link público (short URL). | Could |
| RF-16 | Preferências de rota: evitar pedágios, evitar rodovias, evitar balsas. | Could |
| RF-17 | Modo escuro / claro. | Could |
| RF-18 | i18n: pt-BR (default), en-US, es-ES. | Could |

---

## 3. Requisitos Não-Funcionais (RNF)

| ID | Requisito |
|----|-----------|
| RNF-01 | **Performance**: TTI (Time To Interactive) < 3s em 4G. Animação a **60 fps** em desktop, **≥ 30 fps** em mobile mid-range. |
| RNF-02 | **Custo**: usar preferencialmente APIs **gratuitas** ou com **free tier generoso**. Chaves de API nunca expostas no cliente. |
| RNF-03 | **Responsividade**: layout adaptável (desktop, tablet, mobile). |
| RNF-04 | **Acessibilidade**: WCAG 2.1 AA (contraste, navegação por teclado, ARIA). |
| RNF-05 | **PWA**: instalável, funciona offline para roteiros já baixados (cache dos tiles do mapa e da rota). |
| RNF-06 | **Segurança**: chaves de API no backend; rate-limit por IP; CORS restritivo. |
| RNF-07 | **Observabilidade**: logs estruturados, Sentry (erros), Plausible (analytics privacy-friendly). |
| RNF-08 | **Testabilidade**: cobertura ≥ 70% em módulos core (otimizador de rota, parser de geometria). |
| RNF-09 | **Internacionalização**: strings externalizadas (i18next). |

---

## 4. Stack Tecnológica Recomendada

> Todas as escolhas priorizam **gratuidade**, **maturidade** e **facilidade para IA-agent implementar**.

### 4.1 Frontend
| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework | **React 18 + TypeScript** | Ecossistema, tipagem, ampla base de conhecimento de LLMs. |
| Bundler | **Vite** | Build instantâneo, HMR rápido, config simples. |
| Estilos | **Tailwind CSS** + **shadcn/ui** | Prototipagem rápida e UI moderna. |
| Estado global | **Zustand** | Leve, sem boilerplate, ideal para estado do roteiro e do player. |
| Formulários | **React Hook Form** + **Zod** | Validação declarativa. |
| Rotas | **React Router v6** | Padrão de mercado. |
| Data fetching | **TanStack Query** | Cache e revalidação de chamadas às APIs de mapa. |
| Ícones | **lucide-react** | Consistente com shadcn/ui. |

### 4.2 Mapa e Visualização 3D
| Uso | Tecnologia | Custo |
|---|---|---|
| **Mapa 2D interativo** (planejamento) | **MapLibre GL JS** (fork open-source do Mapbox GL) com tiles do **OpenFreeMap** ou **Protomaps** | 100% grátis, sem chave |
| **Mapa 3D com terreno e edifícios** | **MapLibre GL JS** + **terrain-rgb tiles** do MapTiler (free tier 100k tiles/mês) ou AWS Terrain Tiles (grátis) | Grátis |
| **Zoom "mundo real" fotorrealista** | **Google Photorealistic 3D Tiles** via **Cesium.js** (free tier: 200k tile requests/mês) — fallback: **MapTiler 3D buildings** | Free tier |
| **Personagem 3D animado** | **Three.js** + modelo **glTF/GLB** do **Mixamo** (rig + animações "walk", "run" grátis) | Grátis |
| **Sincronização câmera 3D ↔ mapa** | **threebox-map** (MapLibre) ou camadas customizadas Three.js sobre Cesium | Grátis (MIT) |
| **Overlays vetoriais** (rota, pinos) | **deck.gl** | Grátis |

> **Decisão arquitetural:** dois "modos" de renderização.
> - **Modo Padrão**: MapLibre GL JS + Three.js (via threebox). Cobre 95% dos casos, zero custo.
> - **Modo Fotorrealista**: Cesium + Google 3D Tiles, ativado apenas nos zooms mais próximos ("Street View"), consumindo o free tier.

### 4.3 Rotas, Geocodificação e Otimização
| Serviço | Tecnologia | Custo | Limites |
|---|---|:---:|---|
| **Geocoding** (endereço → lat/lng) | **Nominatim** (OpenStreetMap) self-hosted ou instância pública | Grátis | 1 req/s (pública). Self-host = ilimitado. |
| **Autocomplete** | **Photon** (baseado em OSM) ou **Nominatim** | Grátis | — |
| **Routing** (cálculo de rota A→B) | **OSRM** (Open Source Routing Machine) — self-hosted ou instância demo | Grátis | Self-host recomendado para produção. |
| **Optimization** (ordem ótima de paradas — TSP) | **VROOM** (Vehicle Routing Open-source Optimization Machine) — self-hosted ou API pública | Grátis | Resolve TSP/VRP em milissegundos. |
| **Alternativa unificada (SaaS grátis)** | **OpenRouteService** (openrouteservice.org) — inclui geocoding, routing, optimization | Grátis | 2.000 req/dia (dev), 40 req/min. |
| **Fallback pago** (opcional) | **Mapbox Directions + Optimization API** | Free tier | 100k req/mês grátis. |

> **Recomendação v1:** **OpenRouteService** para MVP (1 chave, 3 endpoints, gratuito).
> **Recomendação v2 (escala):** self-host **OSRM + VROOM + Nominatim** via Docker.

### 4.4 Backend
| Camada | Tecnologia | Papel |
|---|---|---|
| Runtime | **Node.js 20 + TypeScript** | Compartilha types com o frontend. |
| Framework | **Fastify** (ou Encore.ts) | Alto desempenho, plugins, schema-first. |
| Cache | **Redis** (Upstash free tier) | Cache de rotas e geocoding. |
| Banco (opcional v2) | **PostgreSQL** (Neon/Supabase free tier) | Salvar roteiros de usuários. |
| Auth (opcional v2) | **Clerk** ou **Supabase Auth** | Free tier. |
| Hospedagem backend | **Fly.io** / **Railway** / **Render** free tier | Serverless-friendly. |
| Hospedagem frontend | **Vercel** / **Cloudflare Pages** | Grátis. |

### 4.5 Exportação de Vídeo
| Tecnologia | Uso |
|---|---|
| **MediaRecorder API** | Captura do `<canvas>` em WebM em tempo real. |
| **@ffmpeg/ffmpeg** (WASM) | Transcodificação WebM → MP4 no navegador. |
| **CCapture.js** (alternativa) | Captura frame-a-frame para vídeos "perfeitos" (sem drops). |

### 4.6 DevOps & Qualidade
| Uso | Ferramenta |
|---|---|
| Monorepo | **pnpm workspaces** |
| Lint / Format | **ESLint** + **Prettier** + **Biome** (opcional) |
| Testes unitários | **Vitest** |
| Testes E2E | **Playwright** |
| CI/CD | **GitHub Actions** |
| Erros em produção | **Sentry** (free tier) |
| Analytics | **Plausible** self-hosted ou **Umami** |

---

## 5. Arquitetura do Sistema

### 5.1 Diagrama de Alto Nível

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  React SPA (Vite)                                      │  │
│  │  ├── UI (shadcn/ui + Tailwind)                         │  │
│  │  ├── State (Zustand: routeStore, playerStore)          │  │
│  │  ├── Map Engine (MapLibre GL) ◄──► Three.js (character)│  │
│  │  ├── 3D Photorealistic Layer (Cesium, sob demanda)     │  │
│  │  └── Video Recorder (MediaRecorder + ffmpeg.wasm)      │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS (REST/JSON)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND (Fastify)                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  /api/geocode      → OpenRouteService / Nominatim      │  │
│  │  /api/route        → OpenRouteService / OSRM           │  │
│  │  /api/optimize     → OpenRouteService / VROOM (TSP)    │  │
│  │  /api/roadtrip     → CRUD roteiros salvos              │  │
│  │  Redis Cache (rota + geocode 24h)                      │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   OpenRouteService   OSRM/VROOM      PostgreSQL
   (SaaS grátis)     (self-host)       (Neon)
```

### 5.2 Estrutura de Pastas (Monorepo)

```
docitomapas/
├── apps/
│   ├── web/                      # Frontend React + Vite
│   │   ├── src/
│   │   │   ├── components/       # UI components (shadcn)
│   │   │   ├── features/
│   │   │   │   ├── planner/      # Formulário de paradas
│   │   │   │   ├── map/          # MapLibre + camadas
│   │   │   │   ├── character/    # Three.js personagem
│   │   │   │   ├── player/       # Controles play/zoom/speed
│   │   │   │   └── recorder/     # Exportação de vídeo
│   │   │   ├── stores/           # Zustand
│   │   │   ├── services/         # Chamadas API (TanStack Query)
│   │   │   ├── lib/              # utils (geometry, easing)
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   └── main.tsx
│   │   ├── public/
│   │   │   └── models/           # .glb do personagem + animações
│   │   └── vite.config.ts
│   └── api/                      # Backend Fastify
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── plugins/          # cache, auth, rate-limit
│       │   └── server.ts
│       └── package.json
├── packages/
│   ├── shared/                   # Types e schemas Zod compartilhados
│   └── ui/                       # Design system (opcional)
├── infra/
│   ├── docker/
│   │   ├── osrm.Dockerfile       # Self-host OSRM (v2)
│   │   └── nominatim.Dockerfile  # Self-host Nominatim (v2)
│   └── docker-compose.yml
├── .github/workflows/
├── pnpm-workspace.yaml
├── package.json
├── README.md
└── PROJETO.md                    # este arquivo
```

### 5.3 Modelos de Dados (Shared Types)

```ts
// packages/shared/src/types.ts

export interface Waypoint {
  id: string;                    // uuid
  label?: string;                // "Casa", "Restaurante X"
  address: string;               // texto original digitado
  location: { lat: number; lng: number };
  fixedOrder?: boolean;          // se true, otimizador não move
  stopDurationMin?: number;      // tempo parado (default 0)
}

export type TravelMode =
  | "driving-car"
  | "driving-hgv"     // caminhão
  | "cycling-regular"
  | "foot-walking"
  | "foot-hiking";

export interface RoutePreferences {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

export interface Roadtrip {
  id: string;
  name: string;
  origin: Waypoint;
  destination: Waypoint;
  stops: Waypoint[];             // ordem digitada pelo usuário
  optimizedOrder?: string[];     // array de ids na ordem ótima
  mode: TravelMode;
  preferences: RoutePreferences;
  createdAt: string;
  updatedAt: string;
}

export interface RouteLeg {
  fromId: string;
  toId: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoJSON.LineString;  // caminho detalhado
  instructions: RouteStep[];
}

export interface RouteStep {
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;           // "Vire à direita na Av. X"
  location: [number, number];
}

export interface OptimizedRoute {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
  fullGeometry: GeoJSON.LineString;  // polyline completa concatenada
}
```

### 5.4 Contratos de API (Backend)

```
POST /api/geocode
Body:    { query: string, limit?: number }
Return:  { results: Array<{ label, location, boundingBox }> }

POST /api/route
Body:    { waypoints: Array<{lat,lng}>, mode, preferences }
Return:  RouteLeg[] + fullGeometry

POST /api/optimize
Body:    { origin, destination, stops[], mode, preferences }
Return:  { optimizedOrder: string[], route: OptimizedRoute }

GET/POST/PUT/DELETE /api/roadtrip[/:id]
CRUD    Roadtrip
```

---

## 6. Algoritmo de Otimização de Rota (TSP)

### 6.1 Formulação
Dadas `n` paradas + origem + destino, encontrar permutação das paradas que minimiza o **tempo total** (não a distância) considerando a matriz de tempos `T[i][j]` obtida de OSRM/ORS.

### 6.2 Estratégia
| n | Algoritmo |
|:-:|-----------|
| ≤ 12 | **Força bruta** ou **DP Held–Karp** (O(n²·2ⁿ)) — resposta ótima em ms. |
| 13–25 | **VROOM** ou heurística **2-opt / OR-Tools** — quase-ótima em < 1s. |
| > 25 (futuro) | Meta-heurísticas (simulated annealing, GA). |

### 6.3 Implementação Recomendada
Delegar 100% ao **OpenRouteService `/v2/optimization`** (endpoint gratuito, resolve TSP com waypoints fixos/livres). Fallback local em TypeScript para offline: Held–Karp para n ≤ 12.

### 6.4 Pseudocódigo do fluxo

```
1. Geocodificar todos os endereços → coordenadas.
2. Se n_paradas > 0:
     matriz T = ORS /matrix (durations)
     ordem = ORS /optimization (respeitando fixedOrder)
   Senão:
     ordem = []
3. Chamar ORS /directions com [origem, ...ordem, destino]
   → obter geometria + steps + duração por trecho.
4. Concatenar geometria em fullGeometry (LineString).
5. Persistir/retornar OptimizedRoute.
```

---

## 7. Motor de Animação 3D

### 7.1 Objetivo
Reproduzir um **avatar 3D** (humano estilizado) andando/dirigindo sobre a polyline calculada, com câmera cinematográfica seguindo o movimento.

### 7.2 Componentes
- **`useRouteAnimator` (hook)**: consome `OptimizedRoute` e produz `progress` (0 → 1) em função do tempo × velocidade.
- **`interpolatePosition(progress)`**: retorna `{ lat, lng, heading }` interpolando ao longo da `fullGeometry` (great-circle interpolation preservando ritmo por segmento).
- **Threebox layer**: converte lat/lng → coordenadas Mercator do MapLibre; renderiza o modelo glTF na posição interpolada, rotacionado pelo `heading`.
- **Animação do modelo**: `THREE.AnimationMixer` alterna clipes `walk`/`run`/`drive` conforme `mode` e `speedMultiplier`.
- **Câmera**: sincronizada com o mapa via `map.easeTo({ center, bearing, pitch, zoom })` a cada frame (com `duration:0` ou usando `map.jumpTo` no loop `requestAnimationFrame`).

### 7.3 Presets de Câmera / Zoom
| Preset | Zoom (MapLibre) | Pitch | Descrição |
|--------|:--------------:|:-----:|-----------|
| **Global** | 2  | 0°  | Vista de globo, plano. |
| **País** | 5  | 0°  | Cobre estado/país. |
| **Cidade** | 11 | 30° | Perspectiva urbana. |
| **Bairro** | 15 | 45° | Ruas visíveis, edifícios 3D. |
| **Rua** | 18 | 60° | Nível de calçada. |
| **Fotorrealista ("Google 3D")** | 20 | 75° | Ativa camada Cesium + Google 3D Tiles. |

### 7.4 Controles do Player
```
[⏮  ⏯  ⏭ ]   [🔊]  Velocidade: [1x▼]  Zoom: [Rua▼]  Câmera: [3ª pessoa▼]
━━━━━━━━━━━●────────  00:02:14 / 00:38:52
```

### 7.5 Ativos 3D (Assets)
- Personagem: baixar de **Mixamo** (ex.: "Ch14_nonPBR") + animações `Walking.fbx`, `Running.fbx`, `Idle.fbx`. Converter para `.glb` com Blender ou `gltf-pipeline`.
- Marcadores 3D de paradas: pinos numerados em glTF (gerar procedural em Three.js).
- Textura de neve/pó no chão (opcional, futuro).

---

## 8. Exportação de Vídeo

### 8.1 Fluxo
1. Usuário clica **Exportar Vídeo**.
2. Selecionar: resolução (720p/1080p/4K), FPS (30/60), formato (WebM/MP4), qualidade.
3. Reset da animação para `progress = 0`.
4. Iniciar `MediaRecorder` capturando o `<canvas>` do MapLibre + Three.js.
5. Rodar animação em **tempo real acelerado** (usa `speedMultiplier` interno, ex.: 10x) enquanto grava.
6. Ao terminar, se MP4 solicitado: transcodificar com `ffmpeg.wasm`.
7. Disparar download `.mp4` / `.webm`.

### 8.2 Alternativa "cinematográfica"
Usar **CCapture.js** com passo determinístico (`deltaTime` fixo), garantindo 60 fps perfeitos independentemente da GPU. Ideal para vídeos longos.

---

## 9. UX / Wireframes (descrição textual)

### 9.1 Tela Principal — Planejador
```
┌─────────────────────────────────────────────────────────────┐
│ [LOGO DocitoMapas]        [Roteiros] [Login]  [🌙 Dark]     │
├───────────────┬─────────────────────────────────────────────┤
│ PLANNER       │                                             │
│               │                                             │
│ 🟢 Partida    │                                             │
│ [ Buscar... ] │                                             │
│               │              MAPA (MapLibre)                │
│ 📍 Parada 1   │              — pinos numerados              │
│ [ Buscar... ] │              — polyline da rota             │
│               │              — controles zoom/norte         │
│ + Adicionar   │                                             │
│               │                                             │
│ 🏁 Destino    │                                             │
│ [ Buscar... ] │                                             │
│               │                                             │
│ Modo: [Carro▼]│                                             │
│ [x] Otimizar  │                                             │
│               │                                             │
│ [CALCULAR]    │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

### 9.2 Tela Cinematográfica — Player
- Mapa em tela cheia.
- Barra inferior com timeline, botões play/pause/seek, velocidade, zoom, câmera.
- Botão flutuante `Exportar Vídeo` (canto superior direito).
- Botão `Voltar ao Planner`.

---

## 10. Segurança e Privacidade

- Chaves de API **apenas no backend** (`.env`, nunca no cliente).
- Rate-limit por IP (`@fastify/rate-limit`): 60 req/min.
- CORS: aceitar apenas o domínio do frontend em produção.
- LGPD/GDPR: não coletar dados pessoais sem consentimento; endereços digitados ficam no `localStorage` do próprio usuário por padrão.
- Termos de uso das APIs (OSM Nominatim exige atribuição visível — incluir footer "© OpenStreetMap contributors").

---

## 11. Testes

| Camada | Ferramenta | Foco |
|---|---|---|
| Unit (frontend) | Vitest + React Testing Library | Componentes, hooks, `interpolatePosition`. |
| Unit (backend) | Vitest | Serviços de rota/otimização, cache. |
| Integração | Vitest + `msw` | Mock das APIs externas. |
| E2E | Playwright | Fluxo: adicionar paradas → calcular → ver animação. |
| Visual regression | Playwright screenshots | Presets de câmera. |
| Perf | Lighthouse CI | LCP, TTI, CLS. |

---

## 12. Roadmap de Desenvolvimento (Fases)

### **Fase 0 — Setup (Semana 1)**
- [ ] Inicializar monorepo pnpm.
- [ ] Scaffold `apps/web` com Vite + React + TS + Tailwind + shadcn.
- [ ] Scaffold `apps/api` com Fastify + TS.
- [ ] Configurar ESLint, Prettier, Vitest, Playwright, GitHub Actions.
- [ ] Criar conta e obter chave **OpenRouteService**.
- [ ] Deploy inicial "hello world" (Vercel + Fly.io).

### **Fase 1 — Planner básico (Semanas 2–3)**
- [ ] Componentes UI: `AddressInput` com autocomplete (endpoint `/api/geocode`).
- [ ] Lista de paradas com drag-and-drop (`dnd-kit`).
- [ ] Store Zustand `useRouteStore` (origem, paradas, destino, modo).
- [ ] Endpoints `/api/geocode` e `/api/route`.
- [ ] Renderizar mapa MapLibre + polyline básica.

### **Fase 2 — Otimização (Semana 4)**
- [ ] Endpoint `/api/optimize` (delegando a ORS).
- [ ] UI: toggle "Otimizar ordem", exibir ordem final numerada.
- [ ] Fallback Held–Karp em TS para n ≤ 10 (offline).
- [ ] Testes unitários da matriz de tempos.

### **Fase 3 — Animação 3D (Semanas 5–7)**
- [ ] Integrar Three.js via **threebox** com MapLibre.
- [ ] Carregar personagem `.glb` do Mixamo.
- [ ] Implementar `interpolatePosition` (haversine + heading).
- [ ] Loop `requestAnimationFrame` sincronizando personagem + câmera.
- [ ] Trocar animação (walk/run) conforme velocidade.

### **Fase 4 — Player e Zoom (Semana 8)**
- [ ] Componente `PlayerControls` (play/pause/seek/speed).
- [ ] Presets de zoom e câmera.
- [ ] Modos de câmera: top-down, isométrica, 3ª pessoa, 1ª pessoa.

### **Fase 5 — Modo Fotorrealista (Semana 9)**
- [ ] Integrar **Cesium** + **Google Photorealistic 3D Tiles**.
- [ ] Alternador MapLibre ↔ Cesium ao atingir zoom "Rua real".
- [ ] Manter posição/câmera consistente entre engines.

### **Fase 6 — Exportação de Vídeo (Semana 10)**
- [ ] Integrar MediaRecorder.
- [ ] Modal de exportação (resolução, fps, formato).
- [ ] Transcodificação MP4 via `ffmpeg.wasm`.
- [ ] Barra de progresso.

### **Fase 7 — Persistência e Compartilhamento (Semana 11)**
- [ ] Salvar roteiros no `localStorage`.
- [ ] Auth opcional (Clerk).
- [ ] CRUD `/api/roadtrip` + PostgreSQL.
- [ ] URL curta compartilhável.

### **Fase 8 — Polimento (Semana 12)**
- [ ] PWA (manifest + service worker).
- [ ] i18n pt/en/es.
- [ ] Acessibilidade (WCAG AA).
- [ ] Analytics + Sentry.
- [ ] Documentação final e vídeo-demo.

---

## 13. Critérios de Aceitação (MVP — fim da Fase 6)

Um usuário anônimo consegue, sem tutorial:
1. Digitar endereço de partida e ver sugestões válidas.
2. Adicionar pelo menos 3 paradas + destino.
3. Clicar **Calcular** e ver a rota traçada + ordem otimizada em ≤ 3 s.
4. Iniciar a animação e ver o boneco 3D percorrer a rota.
5. Alterar velocidade (1x→16x) e zoom (país→rua) sem travamentos.
6. Exportar um vídeo MP4 de 1080p em ≤ 2 min para uma rota de 30 min.

---

## 14. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Limite de free tier do ORS excedido em produção. | Cache Redis 24 h + self-host OSRM/VROOM. |
| Google 3D Tiles fora do free tier. | Feature ativada só sob demanda + aviso ao usuário. |
| Performance ruim de Three.js em mobile. | Detectar GPU (`WEBGL_debug_renderer_info`), reduzir qualidade automaticamente. |
| APIs "não oficiais" do Waze/Google podem quebrar. | **Não usar**. Ficar em OSM/ORS/OSRM = 100% legal e estável. |
| Direitos do modelo 3D. | Mixamo é licença livre para uso comercial. Documentar origem. |

---

## 15. Referências

- MapLibre GL JS — https://maplibre.org
- OpenRouteService — https://openrouteservice.org
- OSRM — https://project-osrm.org
- VROOM — https://github.com/VROOM-Project/vroom
- Nominatim — https://nominatim.org
- Cesium + Google 3D Tiles — https://cesium.com/platform/cesiumjs/
- Three.js — https://threejs.org
- threebox — https://github.com/jscastro76/threebox
- Mixamo — https://www.mixamo.com
- ffmpeg.wasm — https://ffmpegwasm.netlify.app
- OpenFreeMap tiles — https://openfreemap.org

---

## 16. Convenções para o Agente Desenvolvedor

- **Sempre** consultar este documento antes de introduzir novas dependências.
- **Nunca** commitar chaves de API ou tokens.
- **Sempre** escrever tipos TS estritos (`strict: true`, `noUncheckedIndexedAccess: true`).
- **Sempre** cobrir com teste unitário qualquer função em `lib/geometry`, `lib/optimizer`, `services/route`.
- **Nunca** chamar APIs externas diretamente do frontend — sempre via `apps/api`.
- **Preferir** componentes shadcn/ui sobre bibliotecas customizadas.
- **Commits** no padrão Conventional Commits (`feat:`, `fix:`, `chore:`…).
- **Branches**: `main` (produção), `develop` (integração), `feature/*`, `fix/*`.
- **PRs**: descrição clara, screenshots quando UI, checklist do documento.

---

## 17. Design System (obrigatório)

- A pasta [`design-system/`](./design-system/) é a **fonte de verdade visual** do produto. Antes de criar qualquer tela, componente ou variação de estilo, o agente **deve** consultá-la.
- Arquivos relevantes:
  - `design-system/styles.css` — tokens (cores em `oklch`, radius, gradientes, sombras) e diretivas Tailwind.
  - `design-system/image.png` — mock de referência da tela principal (identidade "Docito").
- Diretrizes obrigatórias:
  1. **Paleta "candy"**: fundo cotton-candy com gradientes radiais suaves (rosa/pêssego), superfícies em creme quase-branco, primária rosa vivo (`--candy-pink`), acento morango (`--candy-berry`).
  2. **Tipografia**:
     - **Fraunces** (serif) para `h1`/`h2`/`h3` e elementos com classe `font-display` — letter-spacing levemente apertado.
     - **Nunito** para o restante (`body`, botões, formulários).
  3. **Radius grande** (`--radius: 1rem`) e sombras rosadas em vez de neutras (`--shadow-candy`, `--shadow-soft`).
  4. **Botão CTA principal**: gradiente `--gradient-candy` + sombra `--shadow-candy` + ícone à esquerda.
  5. **Tom de voz** dos placeholders/labels: acolhedor e temático ("Uma docinho no caminho...", "Ex: Confeitaria Central", "Rua das Balas, 100"). Nunca genérico.
  6. **Logo & branding**: nome "**Docito**Mapas" com "Mapas" em rosa vivo; ícone circular rosa com desenho de doce; tagline "Roteiros com sabor de caramelo".
- Ao adicionar cor/token novo, **primeiro** verificar se algo do design-system já cobre; **só** adicionar novo se realmente inexistente, mantendo o formato `oklch`.
- Modo escuro (`.dark`) segue os tokens definidos em `design-system/styles.css`.
- O `design-system/styles.css` está em sintaxe Tailwind v4; o projeto usa Tailwind v3. É aceitável traduzir os tokens fielmente (mesmos valores `oklch`, mesmas fontes, mesmos radius/sombras) para o `tailwind.config.js` e `apps/web/src/index.css` — mas **não** desviar da paleta.

---

*Fim do documento. Boas construções!*
