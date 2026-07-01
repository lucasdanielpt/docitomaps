import { describe, expect, it } from 'vitest';
import { haversineMeters, heldKarpFixedEndpoints } from './optimizer.js';

describe('haversineMeters', () => {
  it('retorna 0 para pontos iguais', () => {
    const p = { lat: -23.55, lng: -46.63 };
    expect(haversineMeters(p, p)).toBeCloseTo(0, 5);
  });

  it('distância São Paulo → Rio de Janeiro (~360km)', () => {
    const sp = { lat: -23.5505, lng: -46.6333 };
    const rj = { lat: -22.9068, lng: -43.1729 };
    const d = haversineMeters(sp, rj);
    expect(d).toBeGreaterThan(355_000);
    expect(d).toBeLessThan(370_000);
  });
});

describe('heldKarpFixedEndpoints', () => {
  it('retorna [] quando não há paradas', () => {
    const o = { lat: 0, lng: 0 };
    const d = { lat: 1, lng: 1 };
    expect(heldKarpFixedEndpoints([], o, d)).toEqual([]);
  });

  it('retorna [0] quando há uma única parada', () => {
    const o = { lat: 0, lng: 0 };
    const d = { lat: 10, lng: 10 };
    const stops = [{ lat: 5, lng: 5 }];
    expect(heldKarpFixedEndpoints(stops, o, d)).toEqual([0]);
  });

  it('reordena paradas para minimizar custo (linha reta)', () => {
    const o = { lat: 0, lng: 0 };
    const d = { lat: 0, lng: 10 };
    // Paradas fora de ordem sobre o eixo lng
    const stops = [
      { lat: 0, lng: 7 }, // 0
      { lat: 0, lng: 3 }, // 1
      { lat: 0, lng: 5 }, // 2
    ];
    const order = heldKarpFixedEndpoints(stops, o, d);
    expect(order).toEqual([1, 2, 0]);
  });

  it('encontra ordem ótima para paradas em quadrado', () => {
    const o = { lat: 0, lng: 0 };
    const d = { lat: 0, lng: 0 };
    const stops = [
      { lat: 0, lng: 1 }, // 0 (leste)
      { lat: 1, lng: 1 }, // 1 (nordeste)
      { lat: 1, lng: 0 }, // 2 (norte)
    ];
    const order = heldKarpFixedEndpoints(stops, o, d);
    // Uma das duas ordens ótimas (0->1->2 ou 2->1->0)
    expect([JSON.stringify([0, 1, 2]), JSON.stringify([2, 1, 0])]).toContain(
      JSON.stringify(order),
    );
  });
});
