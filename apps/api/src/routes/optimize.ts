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
import {
  haversineMeters,
  heldKarpFixedEndpoints,
  heldKarpOpenStart,
} from '../lib/optimizer.js';

const cache = new MemoryCache<OptimizeResponse>();

function optimizeLocalSegment(
  start: Waypoint,
  end: Waypoint | null,
  stops: Waypoint[],
): string[] {
  if (stops.length === 0) return [];
  const orderedFreeIndices = end
    ? heldKarpFixedEndpoints(
        stops.map((s) => s.location),
        start.location,
        end.location,
        haversineMeters,
      )
    : heldKarpOpenStart(stops.map((s) => s.location), start.location, haversineMeters);
  return orderedFreeIndices.map((idx) => {
    const wp = stops[idx];
    if (!wp) throw new Error('índice de parada inválido');
    return wp.id;
  });
}

async function optimizeOrsSegment(
  start: Waypoint,
  end: Waypoint,
  stops: Waypoint[],
  mode: TravelMode,
): Promise<string[]> {
  if (stops.length === 0) return [];
  const jobs = stops.map((s, i) => ({
    id: i + 1,
    location: [s.location.lng, s.location.lat] as [number, number],
  }));
  const vehicle = {
    id: 1,
    profile: mode,
    start: [start.location.lng, start.location.lat] as [number, number],
    end: [end.location.lng, end.location.lat] as [number, number],
  };
  const result = await orsOptimize(vehicle, jobs);
  const route = result.routes[0];
  if (!route) return stops.map((s) => s.id);
  return route.steps
    .filter((step) => step.type === 'job' && step.job !== undefined)
    .map((step) => {
      const idx = (step.job as number) - 1;
      const wp = stops[idx];
      if (!wp) throw new Error('índice de step inválido');
      return wp.id;
    });
}

/**
 * Otimiza paradas livres entre âncoras fixas (origem → paradas fixas → destino opcional).
 */
async function optimizeWithFixedAnchors(
  origin: Waypoint,
  destination: Waypoint | undefined,
  stops: Waypoint[],
  mode: TravelMode,
): Promise<string[]> {
  if (stops.length === 0) return [];

  const ordered: string[] = [];
  let anchor: Waypoint = origin;
  let freeBatch: Waypoint[] = [];

  const flushBatch = async (endAnchor: Waypoint | null) => {
    if (freeBatch.length === 0) return;
    let batchIds: string[];
    if (hasOrsKey) {
      const orsEnd = endAnchor ?? origin;
      batchIds = await optimizeOrsSegment(anchor, orsEnd, freeBatch, mode);
    } else {
      batchIds = optimizeLocalSegment(anchor, endAnchor, freeBatch);
    }
    ordered.push(...batchIds);
    freeBatch = [];
  };

  for (const stop of stops) {
    if (stop.fixedOrder) {
      await flushBatch(stop);
      ordered.push(stop.id);
      anchor = stop;
    } else {
      freeBatch.push(stop);
    }
  }

  await flushBatch(destination ?? null);
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
      const optimizedOrder = await optimizeWithFixedAnchors(
        origin,
        destination,
        stops,
        mode,
      );

      const orderedStops = optimizedOrder
        .map((id) => stops.find((s) => s.id === id))
        .filter((s): s is Waypoint => Boolean(s));

      const coords: Array<[number, number]> = [
        [origin.location.lng, origin.location.lat],
        ...orderedStops.map((s) => [s.location.lng, s.location.lat] as [number, number]),
      ];
      if (destination) {
        coords.push([destination.location.lng, destination.location.lat]);
      }

      const dir = await orsDirections({ coordinates: coords, mode, preferences });

      const ids = [origin.id, ...orderedStops.map((s) => s.id)];
      if (destination) ids.push(destination.id);
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
