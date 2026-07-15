import { z } from 'zod';

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const TravelModeSchema = z.enum([
  'driving-car',
  'driving-hgv',
  'cycling-regular',
  'foot-walking',
  'foot-hiking',
]);

export const RoutePreferencesSchema = z
  .object({
    avoidTolls: z.boolean().optional(),
    avoidHighways: z.boolean().optional(),
    avoidFerries: z.boolean().optional(),
  })
  .partial();

export const WaypointSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  address: z.string().min(1),
  location: LatLngSchema,
  fixedOrder: z.boolean().optional(),
  stopDurationMin: z.number().min(0).optional(),
});

export const GeocodeRequestSchema = z.object({
  query: z.string().min(2, 'query deve ter ao menos 2 caracteres'),
  limit: z.number().int().min(1).max(20).optional(),
  focus: LatLngSchema.optional(),
});

export const RouteRequestSchema = z.object({
  waypoints: z.array(LatLngSchema).min(2, 'ao menos 2 waypoints (origem + destino)'),
  mode: TravelModeSchema,
  preferences: RoutePreferencesSchema.optional(),
});

export const OptimizeRequestSchema = z.object({
  origin: WaypointSchema,
  destination: WaypointSchema.optional(),
  stops: z.array(WaypointSchema).max(25, 'máximo 25 paradas na v1'),
  mode: TravelModeSchema,
  preferences: RoutePreferencesSchema.optional(),
});

export type GeocodeRequest = z.infer<typeof GeocodeRequestSchema>;
export type RouteRequest = z.infer<typeof RouteRequestSchema>;
export type OptimizeRequest = z.infer<typeof OptimizeRequestSchema>;
