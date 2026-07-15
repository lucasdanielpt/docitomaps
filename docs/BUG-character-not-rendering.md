# BUG: Boneco 3D não renderiza no mapa (modo cinema)

> **Documento para agente desenvolvedor** · DocitoMapas · 2026-07-01  
> **Prioridade:** Must (RF-09) · **Status:** Aberto  
> **Referência de produto:** [`PROJETO.md`](../PROJETO.md) §7 (Motor de Animação 3D), RF-09

---

## 1. Resumo executivo

O personagem 3D que deveria percorrer a rota no **modo cinema** não aparece para o usuário. A implementação do `CharacterLayer` (Three.js + MapLibre custom layer) e do fallback procedural estão corretas em isolamento; o bug está na **orquestração React** em `MapView.tsx`: uma **race condition** entre o carregamento assíncrono do mapa e o `useEffect` que monta a camada do personagem.

**Causa raiz mais provável:** `isLoadedRef` é uma ref (não state). O efeito que adiciona `CharacterLayer` exige `isLoadedRef.current === true`, mas quando o mapa termina de carregar nenhum re-render React ocorre — o efeito **nunca reexecuta** e a camada **nunca é adicionada**.

**Agravante:** ao entrar no modo cinema, `PlannerPage` **desmonta** o `MapView` do planejador e **monta uma instância nova**, reiniciando o ciclo de load do zero.

---

## 2. Comportamento esperado vs. observado

| Aspecto | Esperado | Observado |
|---------|----------|-----------|
| Onde aparece | Modo cinema, após rota calculada | Nada visível (3D nem marcador 2D) |
| Fallback procedural | Boneco “candy” (~1,7 m) com animação walk | Não renderiza |
| Marcador 2D rosa | Safety net sempre visível na posição do boneco | Não aparece |
| Console | Log `[DocitoMapas][character] 1º render` após play/seek | Log ausente |
| Badge UI | “Modo doce” ou “Mixamo” no canto superior direito | Badge pode aparecer, mas sem personagem |

---

## 3. Pré-requisitos para o boneco aparecer (gates intencionais)

O personagem **não** deve aparecer no mapa do planejador. Só no modo cinema:

1. `route !== null` — rota calculada com sucesso
2. `cinema === true` — usuário clicou **“Assistir viagem em 3D”**
3. `CharacterLayer` adicionada via `map.addLayer(layer)`
4. RAF loop chamando `characterLayerRef.current.update(lng, lat, heading, speed)`
5. `CharacterLayer.render()` com `hasPosition === true`

Arquivo: `apps/web/src/features/map/MapView.tsx` (efeito linhas ~277–329).

---

## 4. Arquitetura da renderização do personagem

```
PlannerPage (cinema=true)
  └── MapView (instância NOVA — mapa recriado do zero)
        ├── useEffect setup mapa → map.on('load'|'style.load') → isLoadedRef=true
        ├── useEffect character (deps: [cinema, route]) → add CharacterLayer + marcador 2D
        ├── useEffect RAF (deps: cinema, route, playing, speed, …)
        │     └── interpolatePosition() → update() + setModelVisible() + marcador HTML
        └── CharacterLayer (CustomLayerInterface MapLibre + Three.js)
              ├── buildProceduralCharacter() — fallback imediato em onAdd
              └── tryLoadFirstAvailable(['/models/character.glb', …]) — opcional
```

### Arquivos relevantes

| Caminho | Papel |
|---------|-------|
| `apps/web/src/features/map/MapView.tsx` | Mapa, gates cinema, RAF, lifecycle da camada |
| `apps/web/src/features/character/CharacterLayer.ts` | Custom layer Three.js, procedural + GLB |
| `apps/web/src/pages/PlannerPage.tsx` | Alterna planner ↔ cinema; **remonta MapView** |
| `apps/web/src/stores/playerStore.ts` | `cinema`, `playing`, `progress`, `cameraMode`, `zoomPreset` |
| `apps/web/src/lib/geometry.ts` | `interpolatePosition()` ao longo da polyline |
| `apps/web/public/models/README.md` | Instruções para `character.glb` (Mixamo) |

**Backend (`apps/api`):** não participa da renderização; só fornece `fullGeometry`.

**Assets:** não existe `.glb` no repositório (apenas `public/models/README.md`). O fallback procedural deveria funcionar sem GLB.

---

## 5. Causa raiz — race condition `isLoadedRef`

### 5.1 Código problemático

**Ref setada no load, sem re-render:**

```ts
// MapView.tsx ~159-163
const onStyleReady = () => {
  isLoadedRef.current = true;  // ← ref: React NÃO re-renderiza
  ensureRouteLayers(map);
  map.resize();
};
map.on('load', onStyleReady);
map.on('style.load', onStyleReady);
```

**Efeito do personagem exige ref true, mas deps não incluem load:**

```ts
// MapView.tsx ~277-279
useEffect(() => {
  const map = mapRef.current;
  if (!map || !isLoadedRef.current || !route) return;  // ← sai se mapa ainda carregando
  if (cinema) {
    // map.addLayer(new CharacterLayer(...))
  }
}, [cinema, route]);  // ← isLoadedRef NÃO está nas deps
```

**Mesmo padrão no efeito da rota:**

```ts
// MapView.tsx ~193-195
useEffect(() => {
  const map = mapRef.current;
  if (!map || !isLoadedRef.current) return;  // ← mesma race
  // src.setData(route.fullGeometry)
}, [route, cinema]);
```

**RAF roda sem camada montada:**

```ts
// MapView.tsx ~347-356 — NÃO checa isLoadedRef
useEffect(() => {
  if (!cinema || !route) return;
  // requestAnimationFrame → characterLayerRef.current?.update(...)  // ref null
}, [cinema, route, playing, speed, zoomPreset, cameraMode, ...]);
```

### 5.2 Sequência do bug

```
1. Usuário clica "Assistir viagem em 3D"
2. PlannerPage desmonta MapView do planner, monta MapView cinema (nova instância)
3. useEffect setup cria maplibregl.Map → isLoadedRef = false
4. useEffect character roda: cinema=true, route=ok, isLoadedRef=false → RETURN (camada não criada)
5. useEffect route roda: isLoadedRef=false → RETURN (polyline pode também falhar)
6. Map dispara 'load' / 'style.load' → isLoadedRef = true (sem re-render)
7. Nenhum efeito reexecuta → CharacterLayer nunca adicionada
8. RAF inicia mas characterLayerRef.current === null → update() é no-op
9. Marcador 2D também não criado (mesmo efeito bloqueado)
10. Console: [DocitoMapas][character] 1º render NUNCA aparece
```

### 5.3 Remontagem do MapView no cinema

```tsx
// PlannerPage.tsx ~25-30 e ~105-106
if (cinema) {
  return ( ... <MapView /> ... );  // instância A
}
return ( ... <MapView /> ... );    // instância B (diferente)
```

Cada toggle cinema ↔ planner destrói e recria o mapa, maximizando a janela da race condition.

---

## 6. Causas secundárias (menor probabilidade ou sintomas diferentes)

### 6.1 Modo câmera 1ª pessoa esconde o modelo 3D

```ts
// MapView.tsx ~412-416
case 'first-person':
  modelVisible = false;  // setModelVisible(false) no CharacterLayer
```

**Sintoma:** sem mesh 3D, mas **marcador 2D rosa deveria** aparecer.  
**Default:** `cameraMode: 'third-person'` em `playerStore.ts`.

### 6.2 Zoom preset muito distante

| Preset | Zoom | Efeito |
|--------|------|--------|
| global | 2 | Personagem sub-pixel |
| country | 5 | Quase invisível |
| street (default) | 18 | Adequado |

### 6.3 `map.setStyle()` remove custom layers sem recriar

```ts
// MapView.tsx ~135-141, ~165-174
map.setStyle(OSM_RASTER_STYLE);  // fallback por erro de tiles
// onStyleReady → ensureRouteLayers() — NÃO restaura CharacterLayer
```

**Sintoma:** boneco aparece brevemente, depois some após erros de tile/estilo.

### 6.4 GLB ausente ou inválido

- URLs tentadas: `/models/character.glb`, `/models/Walking.glb`, `/models/walking.glb`
- HEAD pre-check de Content-Type antes do load
- **Impacto baixo:** procedural é criado em `onAdd` antes do fetch assíncrono
- GLB mal exportado (sem skin, escala errada) pode tornar modelo Mixamo invisível **depois** de substituir o procedural

### 6.5 Render bloqueado até primeira posição

```ts
// CharacterLayer.ts ~153-155
if (!this.hasPosition) return;  // normal — update() seta hasPosition=true
```

Não é bug se a camada existir e o RAF chamar `update()`.

### 6.6 React StrictMode (dev)

`main.tsx` usa `<React.StrictMode>`. Double-mount em dev pode agravar lifecycle, mas não é a causa raiz.

---

## 7. O que NÃO é a causa

- Backend / API de rota
- Z-index do overlay cinema (`pointer-events-none` no overlay)
- Sprites MapLibre (personagem usa custom layer Three.js, não symbol layer)
- Ausência de `character.glb` sozinha (procedural deveria bastar)

---

## 8. Reprodução

1. Subir `apps/api` com `ORS_API_KEY` válida e `apps/web`
2. Preencher partida, ≥1 parada, destino
3. Clicar **Calcular** — rota aparece no mapa do planner
4. Clicar **Assistir viagem em 3D**
5. Clicar **Play** nos controles do player
6. **Resultado bug:** mapa base visível, sem boneco 3D, sem ponto rosa, sem log no console

### Variações úteis

- Abrir DevTools → Console antes do passo 4
- Testar URL com `?debug=character` (octaedro rosa grande no modelo)
- Trocar câmera para 3ª pessoa / zoom Rua
- Verificar Network por `character.glb` (404 esperado hoje)

---

## 9. Checklist de diagnóstico

| # | Verificação | Se falhar → indica |
|---|-------------|-------------------|
| 1 | Entrou no modo cinema com rota calculada? | Gate intencional |
| 2 | Console tem `[DocitoMapas][character] 1º render`? | Camada nunca montada (race) |
| 3 | Ponto rosa 2D visível? | Efeito character não rodou |
| 4 | Polyline visível no cinema? | Mesma race no efeito route |
| 5 | Câmera ≠ 1ª pessoa? | Modelo 3D escondido por design |
| 6 | Zoom = Rua/Bairro? | Personagem microscópico |
| 7 | Boneco sumiu após erro de tile? | setStyle removeu camada |
| 8 | Badge “Modo doce” vs “Mixamo”? | GLB carregou ou não |

---

## 10. Correções recomendadas (por prioridade)

### P0 — Corrigir race condition (obrigatório)

**Opção A (recomendada):** substituir `isLoadedRef` por state React:

```ts
const [mapReady, setMapReady] = useState(false);

const onStyleReady = () => {
  setMapReady(true);
  ensureRouteLayers(map);
  map.resize();
};

// Efeitos character + route:
if (!map || !mapReady || !route) return;
// deps: [cinema, route, mapReady]
```

**Opção B:** invocar setup da camada diretamente em `onStyleReady` quando `cinema && route`:

```ts
const onStyleReady = () => {
  isLoadedRef.current = true;
  ensureRouteLayers(map);
  ensureCharacterLayer(map);  // extrair lógica do useEffect
  syncRouteToMap(map);
  map.resize();
};
```

Cuidado com closures stale — ler `cinema`/`route` via refs ou store (`usePlayerStore.getState()`, `useRouteStore.getState()`).

### P1 — Restaurar camada após `setStyle`

Após `style.load` (incluindo fallback raster), se `cinema && route`:

- Re-adicionar `CharacterLayer` se `!map.getLayer('docito-character')`
- Recriar marcador 2D se necessário
- Re-sincronizar GeoJSON da rota

Extrair `ensureCharacterLayer(map)` reutilizável.

### P2 — Evitar remontagem desnecessária do MapView

Manter **uma única instância** do mapa entre planner e cinema:

- Mover `MapView` para nível acima do toggle cinema, ou
- Usar CSS (fullscreen overlay) em vez de desmontar/remontar, ou
- Context/ref compartilhado do mapa

Reduz superfície de bugs de lifecycle.

### P3 — Testes de regressão

- Teste de integração (Vitest + mock MapLibre) ou E2E (Playwright):
  - Simular `cinema=true` após `map` fire `load`
  - Assert: `map.addLayer` chamado com layer id `docito-character`
- Teste unitário opcional para helper `ensureCharacterLayer`

### P4 — Asset GLB (melhoria, não fix do bug)

Seguir `apps/web/public/models/README.md` para adicionar `character.glb` Mixamo.

---

## 11. Critérios de aceitação

Após o fix, um agente/humano deve validar:

- [ ] Calcular rota → entrar cinema → **boneco procedural visível** (zoom Rua, 3ª pessoa)
- [ ] Console exibe `[DocitoMapas][character] 1º render` em ≤2 s após entrar no cinema
- [ ] **Marcador 2D rosa** visível se modelo 3D falhar (simular WebGL off)
- [ ] Play avança personagem ao longo da polyline sem travar câmera
- [ ] Seek no slider reposiciona boneco quando pausado
- [ ] Sair e reentrar no cinema mantém comportamento (sem regressão)
- [ ] Após fallback `setStyle`, personagem **reaparece** (testar forçando erro de tile se possível)
- [ ] Modo 1ª pessoa: sem mesh 3D, com marcador 2D
- [ ] Badge “Modo doce” sem GLB; “Mixamo” com GLB presente

Referência MVP: [`PROJETO.md`](../PROJETO.md) §13 — critério 4: *“Iniciar a animação e ver o boneco 3D percorrer a rota.”*

---

## 12. Referências de código (linhas aproximadas)

| Local | Linhas | Conteúdo |
|-------|--------|----------|
| `MapView.tsx` | 88, 159-163 | `isLoadedRef`, `onStyleReady` |
| `MapView.tsx` | 193-213 | Sync rota (mesma race) |
| `MapView.tsx` | 277-329 | Mount/unmount CharacterLayer |
| `MapView.tsx` | 347-465 | RAF loop |
| `MapView.tsx` | 135-174 | Fallback `setStyle` |
| `CharacterLayer.ts` | 63-119 | `onAdd`, procedural, renderer |
| `CharacterLayer.ts` | 132-209 | `update`, `render` |
| `CharacterLayer.ts` | 367-428 | `buildProceduralCharacter` |
| `PlannerPage.tsx` | 25-49, 105-119 | Duas instâncias MapView |
| `playerStore.ts` | 48-54 | Defaults cinema/câmera/zoom |

---

## 13. Convenções para o agente que implementar

- Consultar [`PROJETO.md`](../PROJETO.md) antes de novas dependências
- Escopo mínimo: corrigir lifecycle, não refatorar CharacterLayer/Three.js sem necessidade
- Não commitar chaves de API
- Commit: `fix(web): mount character layer after map ready in cinema mode`
- PR: screenshot/vídeo do boneco no modo cinema + checklist §11
- Tipos TS estritos; preferir extrair helpers pequenos (`ensureCharacterLayer`) a duplicar lógica

---

## 14. Debug rápido (flags existentes)

| Flag / ação | Efeito |
|-------------|--------|
| `?debug=character` | Octaedro rosa grande no `CharacterLayer` |
| Console `[DocitoMapas][character] 1º render` | Confirma 1º draw WebGL |
| Console `[DocitoMapas] modelo 3D carregado` | GLB substituiu procedural |
| Badge “Modo doce” / “Mixamo” | Estado do asset 3D |

---

*Documento gerado a partir de análise estática do código em 2026-07-01. Atualizar status e seção §11 quando o bug for resolvido.*
