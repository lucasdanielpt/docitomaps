import { Cartographic, type Scene } from 'cesium';

const heightCache = new Map<string, number>();

function cacheKey(lng: number, lat: number): string {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

/** Amostra elevação do terreno/tiles 3D com cache por coordenada arredondada. */
export async function sampleGroundHeight(
  scene: Scene,
  lng: number,
  lat: number,
): Promise<number> {
  const key = cacheKey(lng, lat);
  const cached = heightCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const carto = Cartographic.fromDegrees(lng, lat);
    const updated = await scene.sampleHeightMostDetailed([carto]);
    const h = updated[0]?.height ?? 0;
    heightCache.set(key, h);
    return h;
  } catch {
    return 0;
  }
}

export function getCachedGroundHeight(lng: number, lat: number): number | undefined {
  return heightCache.get(cacheKey(lng, lat));
}

export function primeGroundHeightCache(lng: number, lat: number, height: number): void {
  heightCache.set(cacheKey(lng, lat), height);
}
