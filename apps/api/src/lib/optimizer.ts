import type { LatLng } from '@docitomapas/shared';

/**
 * Distância aproximada em metros entre dois pontos (haversine).
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * TSP com origem e destino fixos usando Held–Karp (DP).
 * Retorna a permutação ótima dos índices das paradas intermediárias.
 *
 * Custo: O(n² · 2ⁿ). Prático até n ≤ 12 paradas.
 *
 * @param stopCoords coordenadas das paradas intermediárias (na ordem original).
 * @param origin coordenada da origem.
 * @param destination coordenada do destino.
 * @param costFn função que retorna custo entre dois pontos (default = haversine).
 * @returns ordem otimizada (array de índices em `stopCoords`).
 */
export function heldKarpFixedEndpoints(
  stopCoords: LatLng[],
  origin: LatLng,
  destination: LatLng,
  costFn: (a: LatLng, b: LatLng) => number = haversineMeters,
): number[] {
  const n = stopCoords.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  if (n > 20) {
    throw new Error(`Held-Karp indicado para n<=12; recebido n=${n}`);
  }

  const cost = (a: LatLng, b: LatLng) => costFn(a, b);
  const distFromOrigin = stopCoords.map((s) => cost(origin, s));
  const distToDest = stopCoords.map((s) => cost(s, destination));
  const distStops: number[][] = stopCoords.map((a, i) =>
    stopCoords.map((b, j) => (i === j ? 0 : cost(a, b))),
  );

  const size = 1 << n;
  // dp[mask][i] = custo mínimo partindo da origem, tendo visitado o subconjunto `mask`,
  // e terminando na parada `i` (que está em mask).
  const dp: number[][] = Array.from({ length: size }, () =>
    new Array<number>(n).fill(Number.POSITIVE_INFINITY),
  );
  const parent: number[][] = Array.from({ length: size }, () => new Array<number>(n).fill(-1));

  for (let i = 0; i < n; i++) {
    const dOrigin = distFromOrigin[i];
    if (dOrigin === undefined) continue;
    const row = dp[1 << i];
    if (!row) continue;
    row[i] = dOrigin;
  }

  for (let mask = 1; mask < size; mask++) {
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const row = dp[mask];
      if (!row) continue;
      const current = row[i];
      if (current === undefined || !Number.isFinite(current)) continue;
      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) continue;
        const distRow = distStops[i];
        if (!distRow) continue;
        const step = distRow[j];
        if (step === undefined) continue;
        const nextMask = mask | (1 << j);
        const nextRow = dp[nextMask];
        if (!nextRow) continue;
        const candidate = current + step;
        const prev = nextRow[j];
        if (prev === undefined || candidate < prev) {
          nextRow[j] = candidate;
          const parentRow = parent[nextMask];
          if (parentRow) parentRow[j] = i;
        }
      }
    }
  }

  const fullMask = size - 1;
  let bestCost = Number.POSITIVE_INFINITY;
  let bestLast = -1;
  const finalRow = dp[fullMask];
  if (!finalRow) return stopCoords.map((_, i) => i);
  for (let i = 0; i < n; i++) {
    const c = finalRow[i];
    const tail = distToDest[i];
    if (c === undefined || tail === undefined) continue;
    const total = c + tail;
    if (total < bestCost) {
      bestCost = total;
      bestLast = i;
    }
  }
  if (bestLast === -1) return stopCoords.map((_, i) => i);

  const order: number[] = [];
  let mask = fullMask;
  let cur = bestLast;
  while (cur !== -1) {
    order.push(cur);
    const parentRow = parent[mask];
    const prev = parentRow?.[cur] ?? -1;
    mask ^= 1 << cur;
    cur = prev;
  }
  return order.reverse();
}
