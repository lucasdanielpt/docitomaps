import type { FastifyPluginAsync } from 'fastify';
import { RouteRequestSchema, type RouteResponse } from '@docitomapas/shared';
import { MemoryCache } from '../lib/cache.js';
import { OrsError, orsDirections } from '../services/ors.js';

const cache = new MemoryCache<RouteResponse>();

export const routeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/route', async (request, reply) => {
    const parsed = RouteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const key = JSON.stringify(parsed.data);
    const cached = cache.get(key);
    if (cached) return cached;

    try {
      const coords: Array<[number, number]> = parsed.data.waypoints.map((w) => [w.lng, w.lat]);
      const dir = await orsDirections({
        coordinates: coords,
        mode: parsed.data.mode,
        preferences: parsed.data.preferences,
      });
      const response: RouteResponse = {
        legs: dir.legs,
        fullGeometry: dir.fullGeometry,
        totalDistanceMeters: dir.totalDistanceMeters,
        totalDurationSeconds: dir.totalDurationSeconds,
      };
      cache.set(key, response, 60 * 60 * 24);
      return response;
    } catch (err) {
      if (err instanceof OrsError) {
        return reply.code(err.status).send({ error: 'ors_error', message: err.message });
      }
      request.log.error({ err }, 'route failed');
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
};
