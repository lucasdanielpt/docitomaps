import type { LineStringGeometry } from '@docitomapas/shared';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Distância haversine em metros entre dois pontos GeoJSON `[lng, lat]`.
 */
export function haversineMeters(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bearing inicial (heading) em graus (0 = norte, 90 = leste),
 * do ponto `a` para o ponto `b`. Segue fórmula esférica clássica.
 */
export function initialBearingDeg(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const λ1 = toRad(lng1);
  const λ2 = toRad(lng2);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Pré-computa distâncias acumuladas ao longo de uma LineString.
 * Retorna `{ cumulative[i] em metros, totalMeters }`, útil para
 * interpolação O(log n) via binária.
 */
export interface CumulativeDistances {
  cumulative: number[];
  totalMeters: number;
}

export function computeCumulativeDistances(geom: LineStringGeometry): CumulativeDistances {
  const coords = geom.coordinates;
  const cumulative = new Array<number>(coords.length).fill(0);
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    if (!prev || !curr) continue;
    total += haversineMeters(prev, curr);
    cumulative[i] = total;
  }
  return { cumulative, totalMeters: total };
}

export interface InterpolatedPosition {
  lng: number;
  lat: number;
  /** Heading em graus, 0 = norte, 90 = leste. */
  heading: number;
  /** Índice do segmento (i entre coords[i] e coords[i+1]). */
  segmentIndex: number;
  /** Fração dentro do segmento (0..1). */
  segmentT: number;
}

/**
 * Interpola linearmente sobre a polyline em função do progresso 0..1,
 * onde 0 = início e 1 = fim, respeitando o comprimento real de cada
 * segmento (assim o "boneco" anda em velocidade constante no espaço,
 * não em segmentos-por-tempo).
 *
 * Usa busca binária sobre o array cumulative para O(log n).
 */
export function interpolatePosition(
  geom: LineStringGeometry,
  progress: number,
  precomputed?: CumulativeDistances,
): InterpolatedPosition | null {
  const coords = geom.coordinates;
  if (coords.length === 0) return null;
  if (coords.length === 1) {
    const c = coords[0];
    if (!c) return null;
    return { lng: c[0], lat: c[1], heading: 0, segmentIndex: 0, segmentT: 0 };
  }

  const p = Math.min(1, Math.max(0, progress));
  const { cumulative, totalMeters } = precomputed ?? computeCumulativeDistances(geom);
  if (totalMeters === 0) {
    const c = coords[0];
    if (!c) return null;
    return { lng: c[0], lat: c[1], heading: 0, segmentIndex: 0, segmentT: 0 };
  }
  const target = p * totalMeters;

  // Busca binária pelo primeiro i tal que cumulative[i] >= target.
  let lo = 1;
  let hi = coords.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const midCum = cumulative[mid];
    if (midCum === undefined) break;
    if (midCum < target) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const prev = coords[i - 1];
  const curr = coords[i];
  if (!prev || !curr) return null;
  const startCum = cumulative[i - 1] ?? 0;
  const endCum = cumulative[i] ?? startCum;
  const segLen = endCum - startCum;
  const t = segLen === 0 ? 0 : Math.min(1, Math.max(0, (target - startCum) / segLen));
  const lng = prev[0] + (curr[0] - prev[0]) * t;
  const lat = prev[1] + (curr[1] - prev[1]) * t;
  const heading = initialBearingDeg(prev, curr);
  return { lng, lat, heading, segmentIndex: i - 1, segmentT: t };
}

/**
 * Converte um progresso `0..1` em um tempo em segundos, dado o tempo total
 * (útil pra timeline de player). E vice-versa.
 */
export function progressToSeconds(progress: number, totalSeconds: number): number {
  return Math.max(0, Math.min(1, progress)) * totalSeconds;
}

export function secondsToProgress(seconds: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, seconds / totalSeconds));
}

/**
 * Retorna um ponto a `distanceMeters` metros do ponto original, na direção
 * `bearingDeg` (0 = norte, 90 = leste). Fórmula geodésica clássica.
 * Útil para posicionar a câmera atrás/à frente do personagem em modo 3ª pessoa.
 */
export function offsetByBearing(
  lng: number,
  lat: number,
  bearingDeg: number,
  distanceMeters: number,
): { lng: number; lat: number } {
  const R = 6_371_000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const δ = distanceMeters / R;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearing);
  const φ2 = Math.asin(sinφ2);
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * sinφ2,
    );
  return { lng: (λ2 * 180) / Math.PI, lat: (φ2 * 180) / Math.PI };
}

/**
 * Metros por pixel no MapLibre Web Mercator para um dado zoom/latitude.
 * Útil para escalar objetos 3D em "pixels na tela" independente do zoom.
 */
export function metersPerPixel(zoom: number, latDeg: number): number {
  return (156_543.03392 * Math.cos((latDeg * Math.PI) / 180)) / Math.pow(2, zoom);
}
