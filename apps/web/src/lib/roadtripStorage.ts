import type {
  OptimizedRoute,
  RoutePreferences,
  TravelMode,
  Waypoint,
} from '@docitomapas/shared';
import { uid } from '@/lib/utils';

const STORAGE_KEY = 'docitomapas:roadtrips:v1';

export interface RoadtripSnapshot {
  origin: Waypoint | null;
  destination: Waypoint | null;
  stops: Waypoint[];
  mode: TravelMode;
  preferences: RoutePreferences;
  optimize: boolean;
  route: OptimizedRoute | null;
  optimizedOrder: string[] | null;
}

export interface StoredRoadtrip {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: RoadtripSnapshot;
}

function readAll(): StoredRoadtrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRoadtrip[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: StoredRoadtrip[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listSavedRoadtrips(): StoredRoadtrip[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveRoadtrip(name: string, snapshot: RoadtripSnapshot): StoredRoadtrip {
  const trimmed = name.trim() || 'Roteiro sem nome';
  const now = new Date().toISOString();
  const items = readAll();
  const entry: StoredRoadtrip = {
    id: uid(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    snapshot,
  };
  writeAll([entry, ...items]);
  return entry;
}

export function deleteRoadtrip(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function renameRoadtrip(id: string, name: string): StoredRoadtrip | null {
  const items = readAll();
  const idx = items.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const existing = items[idx];
  if (!existing) return null;
  const updated: StoredRoadtrip = {
    ...existing,
    name: name.trim() || existing.name,
    updatedAt: new Date().toISOString(),
  };
  items[idx] = updated;
  writeAll(items);
  return updated;
}
