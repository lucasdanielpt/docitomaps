import { describe, expect, it } from 'vitest';
import type { LineStringGeometry } from '@docitomapas/shared';
import {
  computeCumulativeDistances,
  haversineMeters,
  initialBearingDeg,
  interpolatePosition,
  metersPerPixel,
  offsetByBearing,
  progressToSeconds,
  secondsToProgress,
} from './geometry';

const SP: [number, number] = [-46.6333, -23.5505];
const RJ: [number, number] = [-43.1729, -22.9068];

describe('haversineMeters', () => {
  it('retorna 0 para pontos iguais', () => {
    expect(haversineMeters(SP, SP)).toBeCloseTo(0, 5);
  });
  it('São Paulo → Rio ~ 358km', () => {
    const d = haversineMeters(SP, RJ);
    expect(d).toBeGreaterThan(355_000);
    expect(d).toBeLessThan(370_000);
  });
});

describe('initialBearingDeg', () => {
  it('leste (crescente em lng, mesma lat) ~ 90°', () => {
    expect(initialBearingDeg([0, 0], [1, 0])).toBeCloseTo(90, 0);
  });
  it('norte (crescente em lat, mesma lng) ~ 0°', () => {
    expect(initialBearingDeg([0, 0], [0, 1])).toBeCloseTo(0, 0);
  });
  it('oeste ~ 270°', () => {
    expect(initialBearingDeg([0, 0], [-1, 0])).toBeCloseTo(270, 0);
  });
});

describe('interpolatePosition', () => {
  const geom: LineStringGeometry = {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  };

  it('progress = 0 retorna primeiro ponto', () => {
    const p = interpolatePosition(geom, 0);
    expect(p?.lng).toBeCloseTo(0, 5);
    expect(p?.lat).toBeCloseTo(0, 5);
  });

  it('progress = 1 retorna último ponto', () => {
    const p = interpolatePosition(geom, 1);
    expect(p?.lng).toBeCloseTo(2, 5);
    expect(p?.lat).toBeCloseTo(1, 5);
  });

  it('progress fora de faixa é clampado', () => {
    expect(interpolatePosition(geom, -1)?.lng).toBeCloseTo(0, 5);
    expect(interpolatePosition(geom, 2)?.lng).toBeCloseTo(2, 5);
  });

  it('retorna heading coerente ao segmento (indo pra leste)', () => {
    // No primeiro segmento (0,0) → (1,0), heading ~ 90° (leste)
    const p = interpolatePosition(geom, 0.05);
    expect(p?.heading).toBeGreaterThan(85);
    expect(p?.heading).toBeLessThan(95);
  });

  it('usa cumulative pré-calculado se fornecido', () => {
    const pre = computeCumulativeDistances(geom);
    const a = interpolatePosition(geom, 0.5);
    const b = interpolatePosition(geom, 0.5, pre);
    expect(a?.lng).toBeCloseTo(b?.lng ?? 0, 8);
    expect(a?.lat).toBeCloseTo(b?.lat ?? 0, 8);
  });

  it('lida com geometria degenerada (1 ponto)', () => {
    const p = interpolatePosition({ type: 'LineString', coordinates: [[5, 5]] }, 0.5);
    expect(p?.lng).toBe(5);
    expect(p?.lat).toBe(5);
    expect(p?.heading).toBe(0);
  });

  it('retorna null para geometria vazia', () => {
    expect(interpolatePosition({ type: 'LineString', coordinates: [] }, 0.5)).toBeNull();
  });
});

describe('offsetByBearing', () => {
  it('1000m ao norte aumenta latitude ~0.009°', () => {
    const p = offsetByBearing(0, 0, 0, 1000);
    expect(p.lat).toBeCloseTo(0.00898, 4);
    expect(p.lng).toBeCloseTo(0, 4);
  });
  it('1000m ao leste aumenta longitude ~0.009° na equador', () => {
    const p = offsetByBearing(0, 0, 90, 1000);
    expect(p.lng).toBeCloseTo(0.00898, 4);
    expect(p.lat).toBeCloseTo(0, 4);
  });
  it('offset é reversível (bearing + 180)', () => {
    const a = offsetByBearing(-46.63, -23.55, 45, 500);
    const back = offsetByBearing(a.lng, a.lat, 225, 500);
    expect(back.lng).toBeCloseTo(-46.63, 3);
    expect(back.lat).toBeCloseTo(-23.55, 3);
  });
});

describe('metersPerPixel', () => {
  it('cai pela metade ao aumentar zoom em 1', () => {
    const z10 = metersPerPixel(10, 0);
    const z11 = metersPerPixel(11, 0);
    expect(z11 / z10).toBeCloseTo(0.5, 3);
  });
  it('é menor em latitudes altas (compress by cos)', () => {
    const eq = metersPerPixel(12, 0);
    const nordic = metersPerPixel(12, 60);
    expect(nordic).toBeCloseTo(eq * 0.5, 1);
  });
});

describe('progress <-> seconds', () => {
  it('progressToSeconds', () => {
    expect(progressToSeconds(0.5, 100)).toBe(50);
    expect(progressToSeconds(-1, 100)).toBe(0);
    expect(progressToSeconds(2, 100)).toBe(100);
  });
  it('secondsToProgress', () => {
    expect(secondsToProgress(50, 100)).toBe(0.5);
    expect(secondsToProgress(-1, 100)).toBe(0);
    expect(secondsToProgress(200, 100)).toBe(1);
    expect(secondsToProgress(50, 0)).toBe(0);
  });
});
