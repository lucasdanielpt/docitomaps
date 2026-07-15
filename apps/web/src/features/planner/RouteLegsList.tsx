import type { OptimizedRoute } from '@docitomapas/shared';
import { useRouteStore } from '@/stores/routeStore';
import { formatDistanceMeters, formatDurationSeconds } from '@/lib/utils';

function labelForId(
  id: string,
  origin: ReturnType<typeof useRouteStore.getState>['origin'],
  destination: ReturnType<typeof useRouteStore.getState>['destination'],
  stops: ReturnType<typeof useRouteStore.getState>['stops'],
): string {
  if (origin?.id === id) return 'Partida';
  if (destination?.id === id) return 'Destino';
  const stop = stops.find((s) => s.id === id);
  if (stop?.label) return stop.label;
  if (stop?.address) return stop.address.split(',')[0] ?? 'Parada';
  return 'Parada';
}

interface RouteLegsListProps {
  route: OptimizedRoute;
}

export function RouteLegsList({ route }: RouteLegsListProps) {
  const origin = useRouteStore((s) => s.origin);
  const destination = useRouteStore((s) => s.destination);
  const stops = useRouteStore((s) => s.stops);

  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Trechos da rota
      </span>
      <ol className="space-y-2">
        {route.legs.map((leg, i) => (
          <li
            key={`${leg.fromId}-${leg.toId}-${i}`}
            className="rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
          >
            <div className="font-medium text-foreground">
              {i + 1}. {labelForId(leg.fromId, origin, destination, stops)} →{' '}
              {labelForId(leg.toId, origin, destination, stops)}
            </div>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span>{formatDistanceMeters(leg.distanceMeters)}</span>
              <span>{formatDurationSeconds(leg.durationSeconds)}</span>
            </div>
            {leg.instructions[0] && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {leg.instructions[0].instruction}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
