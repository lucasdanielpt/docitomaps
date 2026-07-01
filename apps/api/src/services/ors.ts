import type {
  LatLng,
  RouteLeg,
  RouteStep,
  LineStringGeometry,
  TravelMode,
  RoutePreferences,
  GeocodeResult,
} from '@docitomapas/shared';
import { env } from '../config.js';

/**
 * Erro personalizado para respostas do OpenRouteService.
 */
export class OrsError extends Error {
  public readonly status: number;
  public readonly bodyText?: string;
  constructor(message: string, status: number, bodyText?: string) {
    super(message);
    this.name = 'OrsError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

function assertKey(): void {
  if (!env.ORS_API_KEY) {
    throw new OrsError(
      'ORS_API_KEY não configurada no backend (.env). Obtenha uma em https://openrouteservice.org/dev/#/signup',
      503,
    );
  }
}

async function orsFetch(path: string, init: RequestInit): Promise<Response> {
  assertKey();
  const url = `${env.ORS_BASE_URL}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', env.ORS_API_KEY);
  headers.set('Accept', 'application/json, application/geo+json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new OrsError(
      `ORS ${path} respondeu ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      text,
    );
  }
  return res;
}

// ---------------------------------------------------------------------------
// Geocoding — Pelias (usado pelo ORS)
// ---------------------------------------------------------------------------

interface PeliasFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    country_a?: string;
    bbox?: [number, number, number, number];
  };
  bbox?: [number, number, number, number];
}

interface PeliasResponse {
  features: PeliasFeature[];
}

export interface OrsGeocodeOptions {
  query: string;
  limit?: number;
  focus?: LatLng;
  lang?: string;
}

export async function orsGeocode(opts: OrsGeocodeOptions): Promise<GeocodeResult[]> {
  const params = new URLSearchParams();
  params.set('text', opts.query);
  params.set('size', String(opts.limit ?? 5));
  if (opts.focus) {
    params.set('focus.point.lat', String(opts.focus.lat));
    params.set('focus.point.lon', String(opts.focus.lng));
  }
  params.set('lang', opts.lang ?? 'pt');

  const res = await orsFetch(`/geocode/search?${params.toString()}`, { method: 'GET' });
  const data = (await res.json()) as PeliasResponse;

  return data.features.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const bbox = f.bbox ?? f.properties.bbox;
    return {
      label: f.properties.label,
      location: { lat, lng },
      countryCode: f.properties.country_a,
      boundingBox: bbox
        ? { minLng: bbox[0], minLat: bbox[1], maxLng: bbox[2], maxLat: bbox[3] }
        : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

interface OrsDirectionsResponse {
  routes: Array<{
    summary: { distance: number; duration: number };
    segments: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        instruction: string;
        way_points: [number, number];
      }>;
    }>;
    geometry: string; // encoded polyline
    way_points: number[];
  }>;
}

/**
 * Decodifica polyline codificada (formato Google, precision=5).
 * Retorna array de [lng, lat] no formato GeoJSON.
 * Referência: https://github.com/mapbox/polyline (algoritmo padrão).
 */
export function decodePolyline(str: string, precision = 5): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}

function orsOptionsFor(prefs?: RoutePreferences): Record<string, unknown> | undefined {
  const avoid: string[] = [];
  if (prefs?.avoidTolls) avoid.push('tollways');
  if (prefs?.avoidHighways) avoid.push('highways');
  if (prefs?.avoidFerries) avoid.push('ferries');
  if (avoid.length === 0) return undefined;
  return { avoid_features: avoid };
}

export interface OrsDirectionsRequest {
  coordinates: Array<[number, number]>; // [lng, lat]
  mode: TravelMode;
  preferences?: RoutePreferences;
}

export interface OrsDirectionsResult {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  fullGeometry: LineStringGeometry;
  legs: RouteLeg[];
  waypointIndicesInGeometry: number[];
}

export async function orsDirections(req: OrsDirectionsRequest): Promise<OrsDirectionsResult> {
  const body: Record<string, unknown> = {
    coordinates: req.coordinates,
    instructions: true,
    geometry: true,
    preference: 'fastest',
    units: 'm',
    language: 'pt',
  };
  const opts = orsOptionsFor(req.preferences);
  if (opts) body['options'] = opts;

  const res = await orsFetch(`/v2/directions/${req.mode}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as OrsDirectionsResponse;
  const route = data.routes[0];
  if (!route) throw new OrsError('ORS não retornou rota', 502);

  const coords = decodePolyline(route.geometry);
  const fullGeometry: LineStringGeometry = { type: 'LineString', coordinates: coords };
  const wayPointIndices = route.way_points ?? [];

  const legs: RouteLeg[] = route.segments.map((seg, i) => {
    const from = req.coordinates[i];
    const to = req.coordinates[i + 1];
    if (!from || !to) throw new OrsError('índice de coordenada inválido', 500);
    const startIdx = wayPointIndices[i] ?? 0;
    const endIdx = wayPointIndices[i + 1] ?? coords.length - 1;
    const legGeom: LineStringGeometry = {
      type: 'LineString',
      coordinates: coords.slice(startIdx, endIdx + 1),
    };
    const steps: RouteStep[] = seg.steps.map((s) => {
      const wp = s.way_points[0] ?? 0;
      const pt = coords[wp] ?? [0, 0];
      return {
        distanceMeters: s.distance,
        durationSeconds: s.duration,
        instruction: s.instruction,
        location: pt,
      };
    });
    return {
      fromId: `wp-${i}`,
      toId: `wp-${i + 1}`,
      distanceMeters: seg.distance,
      durationSeconds: seg.duration,
      geometry: legGeom,
      instructions: steps,
    };
  });

  return {
    totalDistanceMeters: route.summary.distance,
    totalDurationSeconds: route.summary.duration,
    fullGeometry,
    legs,
    waypointIndicesInGeometry: wayPointIndices,
  };
}

// ---------------------------------------------------------------------------
// Optimization (TSP) — /optimization
// ---------------------------------------------------------------------------

export interface OrsOptimizationJob {
  id: number;
  location: [number, number]; // [lng, lat]
  skills?: number[];
  priority?: number;
}

export interface OrsOptimizationVehicle {
  id: number;
  profile: TravelMode;
  start: [number, number];
  end: [number, number];
}

export interface OrsOptimizationResponse {
  routes: Array<{
    vehicle: number;
    steps: Array<{
      type: 'start' | 'job' | 'end';
      location: [number, number];
      job?: number;
      arrival?: number;
      duration?: number;
    }>;
  }>;
}

export async function orsOptimize(
  vehicle: OrsOptimizationVehicle,
  jobs: OrsOptimizationJob[],
): Promise<OrsOptimizationResponse> {
  const body = { jobs, vehicles: [vehicle] };
  const res = await orsFetch('/optimization', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return (await res.json()) as OrsOptimizationResponse;
}
