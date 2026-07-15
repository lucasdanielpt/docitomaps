import { describe, expect, it } from 'vitest';
import type { LineStringGeometry } from '@docitomapas/shared';
import { snapToRoute } from './navigation';

const geom: LineStringGeometry = {
  type: 'LineString',
  coordinates: [
    [-46.6333, -23.5505],
    [-46.6343, -23.5515],
    [-46.6353, -23.5525],
  ],
};

describe('snapToRoute', () => {
  it('projeta ponto próximo à polyline', () => {
    const snapped = snapToRoute(-46.634, -23.551, geom);
    expect(snapped).not.toBeNull();
    expect(snapped!.offRouteMeters).toBeLessThan(200);
    expect(snapped!.progress).toBeGreaterThan(0);
    expect(snapped!.progress).toBeLessThan(1);
  });

  it('retorna null para geometria vazia', () => {
    expect(snapToRoute(0, 0, { type: 'LineString', coordinates: [] })).toBeNull();
  });
});
