# DocitoMapas

> Guia 3D de Roteiros de Viagem — planeje sua viagem com paradas otimizadas e visualize um vídeo cinematográfico com um boneco 3D percorrendo o caminho.

Este é um monorepo pnpm com:

- `apps/web` — Frontend React + Vite + TypeScript + Tailwind + shadcn/ui
- `apps/api` — Backend Fastify + TypeScript
- `packages/shared` — Types e schemas Zod compartilhados

Para a especificação completa do produto, consulte [PROJETO.md](./PROJETO.md).

## Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 10
- Chave gratuita do [OpenRouteService](https://openrouteservice.org/dev/#/signup) (para o backend)

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente do backend
cp apps/api/.env.example apps/api/.env
# Edite apps/api/.env e adicione sua ORS_API_KEY

# 3. Rodar tudo em paralelo (web + api)
pnpm dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:8787

## Scripts principais

| Script | Descrição |
|--------|-----------|
| `pnpm dev` | Sobe frontend e backend simultaneamente |
| `pnpm dev:web` | Só o frontend |
| `pnpm dev:api` | Só o backend |
| `pnpm build` | Build de produção de todos os pacotes |
| `pnpm test` | Roda todos os testes unitários |
| `pnpm lint` | Lint em todos os pacotes |
| `pnpm typecheck` | Type-check em todos os pacotes |
| `pnpm format` | Formata todos os arquivos com Prettier |

## Estrutura

```
docitomapas/
├── apps/
│   ├── web/           # React SPA (Vite)
│   └── api/           # Backend Fastify
├── packages/
│   └── shared/        # Types + schemas Zod
├── infra/
│   └── docker/        # Dockerfiles (OSRM/Nominatim self-host — v2)
└── PROJETO.md         # Especificação mestre
```

## Créditos e atribuição

- Mapas base: **© OpenStreetMap contributors** — https://www.openstreetmap.org/copyright
- Roteamento/otimização: **OpenRouteService** — https://openrouteservice.org
- Modelo 3D do personagem: **Mixamo** (Adobe) — https://www.mixamo.com
