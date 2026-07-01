import { describe, expect, it } from 'vitest';
import { decodePolyline } from './ors.js';

describe('decodePolyline', () => {
  it('decodifica exemplo de referência do Google', () => {
    // Exemplo clássico do encoder do Google: _p~iF~ps|U_ulLnnqC_mqNvxq`@
    const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(coords).toHaveLength(3);
    const [p0, p1, p2] = coords;
    expect(p0?.[1]).toBeCloseTo(38.5, 4);
    expect(p0?.[0]).toBeCloseTo(-120.2, 4);
    expect(p1?.[1]).toBeCloseTo(40.7, 4);
    expect(p1?.[0]).toBeCloseTo(-120.95, 4);
    expect(p2?.[1]).toBeCloseTo(43.252, 3);
    expect(p2?.[0]).toBeCloseTo(-126.453, 3);
  });

  it('retorna [] para string vazia', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});
