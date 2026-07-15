import type { GeocodeResult } from '@docitomapas/shared';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'DocitoMapas/1.0 (travel route planner)';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  importance?: number;
  boundingbox?: [string, string, string, string];
}

/**
 * Busca marcos/POIs via Nominatim (OSM).
 * Complementa Pelias para consultas turísticas ("coliseu", "torre eiffel").
 */
export async function nominatimSearch(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: String(limit),
    'accept-language': 'pt',
    addressdetails: '0',
    extratags: '0',
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as NominatimResult[];
  return data.map((item) => {
    const bbox = item.boundingbox;
    return {
      label: item.display_name,
      location: { lat: Number(item.lat), lng: Number(item.lon) },
      boundingBox: bbox
        ? {
            minLat: Number(bbox[0]),
            maxLat: Number(bbox[1]),
            minLng: Number(bbox[2]),
            maxLng: Number(bbox[3]),
          }
        : undefined,
    };
  });
}
