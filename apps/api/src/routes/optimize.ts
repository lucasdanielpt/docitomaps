import type { FastifyPluginAsync } from 'fastify';
import {
  OptimizeRequestSchema,
  type OptimizeResponse,
  type OptimizedRoute,
  type TravelMode,
  type Waypoint,
} from '@docitomapas/shared';
import { MemoryCache } from '../lib/cache.js';
import { OrsError, orsDirections, orsOptimize } from '../services/ors.js';
import { hasOrsKey } from '../config.js';
import { haversineMeters, heldKarpFixedEndpoints } from '../lib/optimizer.js';

const cache = new MemoryCache<OptimizeResponse>();

/**
 * Otimizador local (offline) usando Held-Karp com haversine.
 * Não considera trânsito real, mas resolve o caso trivial e o modo demo.
 */
function optimizeLocal(
  origin: Waypoint,
  destination: Waypoint,
  stops: Waypoint[],
): string[] {
  const fixed = stops
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.fixedOrder === true);
  const free = stops
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.fixedOrder !== true);

  const freeCoords = free.map((f) => f.s.location);
  const orderedFreeIndices =
    freeCoords.length === 0
      ? []
      : heldKarpFixedEndpoints(
          freeCoords,
          origin.location,
          destination.location,
          haversineMeters,
        );
  const orderedFreeIds = orderedFreeIndices.map((idx) => {
    const entry = free[idx];
    if (!entry) throw new Error('índice de parada livre inválido');
    return entry.s.id;
  });

  const fixedIds = fixed.map((f) => f.s.id);
  return [...fixedIds, ...orderedFreeIds];
}

async function optimizeViaOrs(
  origin: Waypoint,
  destination: Waypoint,
  stops: Waypoint[],
  mode: TravelMode,
): Promise<string[]> {
  const jobs = stops.map((s, i) => ({
    id: i + 1,
    location: [s.location.lng, s.location.lat] as [number, number],
  }));
  const vehicle = {
    id: 1,
    profile: mode,
    start: [origin.location.lng, origin.location.lat] as [number, number],
    end: [destination.location.lng, destination.location.lat] as [number, number],
  };
  const result = await orsOptimize(vehicle, jobs);
  const route = result.routes[0];
  if (!route) return stops.map((s) => s.id);
  const ordered = route.steps
    .filter((step) => step.type === 'job' && step.job !== undefined)
    .map((step) => {
      const idx = (step.job as number) - 1;
      const wp = stops[idx];
      if (!wp) throw new Error('índice de step inválido');
      return wp.id;
    });
  return ordered;
}

export const optimizeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/optimize', async (request, reply) => {
    const parsed = OptimizeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const key = JSON.stringify(parsed.data);
    const cached = cache.get(key);
    if (cached) return cached;

    const { origin, destination, stops, mode, preferences } = parsed.data;

    try {
      let optimizedOrder: string[];
      if (stops.length === 0) {
        optimizedOrder = [];
      } else if (hasOrsKey && stops.length >= 4) {
        optimizedOrder = await optimizeViaOrs(origin, destination, stops, mode);
      } else {
        optimizedOrder = optimizeLocal(origin, destination, stops);
      }

      const orderedStops = optimizedOrder
        .map((id) => stops.find((s) => s.id === id))
        .filter((s): s is Waypoint => Boolean(s));

      const coords: Array<[number, number]> = [
        [origin.location.lng, origin.location.lat],
        ...orderedStops.map((s) => [s.location.lng, s.location.lat] as [number, number]),
        [destination.location.lng, destination.location.lat],
      ];

      const dir = await orsDirections({ coordinates: coords, mode, preferences });

      const ids = [origin.id, ...orderedStops.map((s) => s.id), destination.id];
      const legs = dir.legs.map((leg, i) => ({
        ...leg,
        fromId: ids[i] ?? leg.fromId,
        toId: ids[i + 1] ?? leg.toId,
      }));

      const route: OptimizedRoute = {
        totalDistanceMeters: dir.totalDistanceMeters,
        totalDurationSeconds: dir.totalDurationSeconds,
        legs,
        fullGeometry: dir.fullGeometry,
      };
      const response: OptimizeResponse = { optimizedOrder, route };
      cache.set(key, response, 60 * 60);
      return response;
    } catch (err) {
      if (err instanceof OrsError) {
        return reply.code(err.status).send({ error: 'ors_error', message: err.message });
      }
      request.log.error({ err }, 'optimize failed');
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
};
