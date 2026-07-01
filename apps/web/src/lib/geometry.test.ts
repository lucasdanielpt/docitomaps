import { describe, expect, it } from 'vitest';
import type { LineStringGeometry } from '@docitomapas/shared';
import {
  computeCumulativeDistances,
  haversineMeters,
  initialBearingDeg,
  interpolatePosition,
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
