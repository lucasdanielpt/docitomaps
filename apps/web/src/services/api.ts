import type {
  GeocodeResponse,
  OptimizeRequest,
  OptimizeResponse,
  RouteResponse,
  TravelMode,
  RoutePreferences,
  LatLng,
} from '@docitomapas/shared';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string; error?: string };
      message = data.message ?? data.error ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function geocode(query: string, focus?: LatLng): Promise<GeocodeResponse> {
  return postJson<GeocodeResponse>('/api/geocode', { query, limit: 6, focus });
}

export function fetchRoute(
  waypoints: LatLng[],
  mode: TravelMode,
  preferences?: RoutePreferences,
): Promise<RouteResponse> {
  return postJson<RouteResponse>('/api/route', { waypoints, mode, preferences });
}

export function optimizeRoute(req: OptimizeRequest): Promise<OptimizeResponse> {
  return postJson<OptimizeResponse>('/api/optimize', req);
}

export async function fetchHealth(): Promise<{ ok: boolean; orsKeyConfigured: boolean }> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`health-${res.status}`);
  }
  return (await res.json()) as { ok: boolean; orsKeyConfigured: boolean };
}
