import type { LineStringGeometry, OptimizedRoute, RouteLeg } from '@docitomapas/shared';
import {
  computeCumulativeDistances,
  haversineMeters,
  initialBearingDeg,
  type CumulativeDistances,
  type InterpolatedPosition,
} from './geometry';

export interface SnappedPosition {
  lng: number;
  lat: number;
  heading: number;
  /** Distância perpendicular à rota em metros. */
  offRouteMeters: number;
  /** Progresso 0..1 ao longo da rota. */
  progress: number;
  segmentIndex: number;
}

/**
 * Projeta um ponto GPS na polyline mais próxima (snap-to-route).
 */
export function snapToRoute(
  lng: number,
  lat: number,
  geom: LineStringGeometry,
  precomputed?: CumulativeDistances,
): SnappedPosition | null {
  const coords = geom.coordinates;
  if (coords.length < 2) return null;

  const { cumulative, totalMeters } = precomputed ?? computeCumulativeDistances(geom);
  let bestDist = Number.POSITIVE_INFINITY;
  let best: SnappedPosition | null = null;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (!a || !b) continue;

    const projected = projectPointOnSegment(lng, lat, a[0], a[1], b[0], b[1]);
    const dist = haversineMeters([lng, lat], [projected.lng, projected.lat]);
    if (dist < bestDist) {
      const startCum = cumulative[i] ?? 0;
      const endCum = cumulative[i + 1] ?? startCum;
      const segLen = endCum - startCum;
      const along = segLen === 0 ? 0 : projected.t * segLen;
      const progress = totalMeters === 0 ? 0 : (startCum + along) / totalMeters;
      bestDist = dist;
      best = {
        lng: projected.lng,
        lat: projected.lat,
        heading: initialBearingDeg(a, b),
        offRouteMeters: dist,
        progress: Math.max(0, Math.min(1, progress)),
        segmentIndex: i,
      };
    }
  }

  return best;
}

function projectPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { lng: number; lat: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { lng: ax + t * dx, lat: ay + t * dy, t };
}

export interface NavigationInstruction {
  legIndex: number;
  stepIndex: number;
  instruction: string;
  distanceMeters: number;
  /** Distância até esta manobra a partir da posição atual. */
  distanceToManeuverMeters: number;
}

/**
 * Retorna a próxima instrução turn-by-turn com base no progresso atual.
 */
export function getNavigationInstruction(
  route: OptimizedRoute,
  progress: number,
  cumulative?: CumulativeDistances,
): NavigationInstruction | null {
  const cum = cumulative ?? computeCumulativeDistances(route.fullGeometry);
  const targetMeters = progress * cum.totalMeters;

  let legStartMeters = 0;
  for (let legIdx = 0; legIdx < route.legs.length; legIdx++) {
    const leg = route.legs[legIdx];
    if (!leg) continue;
    const legGeom = leg.geometry;
    const legCum = computeCumulativeDistances(legGeom);
    const legEnd = legStartMeters + legCum.totalMeters;

    if (targetMeters <= legEnd || legIdx === route.legs.length - 1) {
      const posInLeg = Math.max(0, targetMeters - legStartMeters);
      let stepStart = 0;
      for (let stepIdx = 0; stepIdx < leg.instructions.length; stepIdx++) {
        const step = leg.instructions[stepIdx];
        if (!step) continue;
        const stepEnd = stepStart + step.distanceMeters;
        if (posInLeg <= stepEnd || stepIdx === leg.instructions.length - 1) {
          return {
            legIndex: legIdx,
            stepIndex: stepIdx,
            instruction: step.instruction,
            distanceMeters: step.distanceMeters,
            distanceToManeuverMeters: Math.max(0, stepEnd - posInLeg),
          };
        }
        stepStart = stepEnd;
      }
      if (leg.instructions[0]) {
        const first = leg.instructions[0];
        return {
          legIndex: legIdx,
          stepIndex: 0,
          instruction: first.instruction,
          distanceMeters: first.distanceMeters,
          distanceToManeuverMeters: first.distanceMeters,
        };
      }
      return null;
    }
    legStartMeters = legEnd;
  }
  return null;
}

/** Suaviza heading entre frames (BUG-017). */
export function lerpAngleDeg(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

export function gpsPositionToInterpolated(pos: SnappedPosition): InterpolatedPosition {
  return {
    lng: pos.lng,
    lat: pos.lat,
    heading: pos.heading,
    segmentIndex: pos.segmentIndex,
    segmentT: 0,
  };
}
