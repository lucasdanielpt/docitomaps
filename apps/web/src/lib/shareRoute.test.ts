import { describe, expect, it } from 'vitest';
import type { Waypoint } from '@docitomapas/shared';
import {
  buildShareUrl,
  parseShareFromLocation,
  sharePayloadToSnapshot,
  type SharePayload,
} from '@/lib/shareRoute';

const origin: Waypoint = {
  id: 'o1',
  label: 'Partida',
  address: 'São Paulo, SP',
  location: { lat: -23.55, lng: -46.63 },
};

const destination: Waypoint = {
  id: 'd1',
  label: 'Destino',
  address: 'Campinas, SP',
  location: { lat: -22.9, lng: -47.06 },
};

const payload: SharePayload = {
  v: 1,
  name: 'Teste',
  origin,
  destination,
  stops: [],
  mode: 'driving-car',
  preferences: { avoidTolls: true },
  optimize: true,
};

describe('shareRoute', () => {
  it('round-trips payload via URL param', () => {
    const url = buildShareUrl(payload, 'http://localhost:5173/');
    const search = new URL(url).search;
    const parsed = parseShareFromLocation(search);
    expect(parsed).toEqual(payload);
  });

  it('converts payload to planner snapshot without route', () => {
    const snapshot = sharePayloadToSnapshot(payload);
    expect(snapshot.origin?.id).toBe('o1');
    expect(snapshot.route).toBeNull();
    expect(snapshot.preferences.avoidTolls).toBe(true);
  });
});
