import type { FastifyPluginAsync } from 'fastify';
import type { GeocodeResult } from '@docitomapas/shared';
import { GeocodeRequestSchema, type GeocodeResponse } from '@docitomapas/shared';
import { MemoryCache } from '../lib/cache.js';
import { OrsError, orsGeocode } from '../services/ors.js';
import { nominatimSearch } from '../services/nominatim.js';
import { hasOrsKey } from '../config.js';

const cache = new MemoryCache<GeocodeResponse>();

function mergeGeocodeResults(primary: GeocodeResult[], secondary: GeocodeResult[], limit: number) {
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const r of [...primary, ...secondary]) {
    const key = `${r.location.lat.toFixed(5)}:${r.location.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export const geocodeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/geocode', async (request, reply) => {
    const parsed = GeocodeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const key = JSON.stringify(parsed.data);
    const cached = cache.get(key);
    if (cached) return cached;

    const limit = parsed.data.limit ?? 6;

    try {
      let results: GeocodeResult[] = [];
      if (hasOrsKey) {
        try {
          results = await orsGeocode(parsed.data);
        } catch (orsErr) {
          request.log.warn({ err: orsErr }, 'ORS geocode falhou — usando Nominatim');
        }
      }
      const nominatim = await nominatimSearch(parsed.data.query, limit);
      results = mergeGeocodeResults(results, nominatim, limit);

      if (results.length === 0 && !hasOrsKey) {
        return reply.code(503).send({
          error: 'ors_error',
          message: 'ORS_API_KEY não configurada e Nominatim não retornou resultados.',
        });
      }

      const response: GeocodeResponse = { results };
      cache.set(key, response, 60 * 60 * 24); // 24h
      return response;
    } catch (err) {
      if (err instanceof OrsError) {
        return reply.code(err.status).send({ error: 'ors_error', message: err.message });
      }
      request.log.error({ err }, 'geocode failed');
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
};
