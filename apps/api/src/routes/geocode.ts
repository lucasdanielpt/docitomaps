import type { FastifyPluginAsync } from 'fastify';
import { GeocodeRequestSchema, type GeocodeResponse } from '@docitomapas/shared';
import { MemoryCache } from '../lib/cache.js';
import { OrsError, orsGeocode } from '../services/ors.js';

const cache = new MemoryCache<GeocodeResponse>();

export const geocodeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/geocode', async (request, reply) => {
    const parsed = GeocodeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const key = JSON.stringify(parsed.data);
    const cached = cache.get(key);
    if (cached) return cached;

    try {
      const results = await orsGeocode(parsed.data);
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
