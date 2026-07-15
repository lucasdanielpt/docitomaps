import type { RoutePreferences, TravelMode, Waypoint } from '@docitomapas/shared';
import type { RoadtripSnapshot } from '@/lib/roadtripStorage';

const SHARE_PARAM = 'r';
const SHARE_VERSION = 1;

/** Payload compacto para URL — waypoints + preferências (sem geometria da rota). */
export interface SharePayload {
  v: typeof SHARE_VERSION;
  name?: string;
  origin: Waypoint;
  destination?: Waypoint;
  stops: Waypoint[];
  mode: TravelMode;
  preferences: RoutePreferences;
  optimize: boolean;
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function snapshotToSharePayload(snapshot: RoadtripSnapshot, name?: string): SharePayload | null {
  if (!snapshot.origin) return null;
  if (!snapshot.destination && snapshot.stops.length === 0) return null;
  return {
    v: SHARE_VERSION,
    name,
    origin: snapshot.origin,
    ...(snapshot.destination ? { destination: snapshot.destination } : {}),
    stops: snapshot.stops,
    mode: snapshot.mode,
    preferences: snapshot.preferences,
    optimize: snapshot.optimize,
  };
}

export function sharePayloadToSnapshot(payload: SharePayload): RoadtripSnapshot {
  return {
    origin: payload.origin,
    destination: payload.destination ?? null,
    stops: payload.stops,
    mode: payload.mode,
    preferences: payload.preferences,
    optimize: payload.optimize,
    route: null,
    optimizedOrder: null,
  };
}

export function encodeSharePayload(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function buildShareUrl(payload: SharePayload, baseUrl = window.location.href): string {
  const encoded = encodeSharePayload(payload);
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(SHARE_PARAM, encoded);
  return url.toString();
}

export function parseShareFromLocation(search: string): SharePayload | null {
  const params = new URLSearchParams(search);
  const raw = params.get(SHARE_PARAM);
  if (!raw) return null;
  try {
    const json = fromBase64Url(raw);
    const parsed = JSON.parse(json) as SharePayload;
    if (parsed.v !== SHARE_VERSION) return null;
    if (!parsed.origin) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearShareParamFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SHARE_PARAM)) return;
  url.searchParams.delete(SHARE_PARAM);
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}
