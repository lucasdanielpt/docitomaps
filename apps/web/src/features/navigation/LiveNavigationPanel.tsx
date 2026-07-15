import { Navigation, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouteStore } from '@/stores/routeStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { formatDistanceMeters } from '@/lib/utils';

export function LiveNavigationPanel() {
  const route = useRouteStore((s) => s.route);
  const active = useNavigationStore((s) => s.active);
  const instruction = useNavigationStore((s) => s.currentInstruction);
  const offRouteMeters = useNavigationStore((s) => s.offRouteMeters);
  const gpsError = useNavigationStore((s) => s.gpsError);
  const start = useNavigationStore((s) => s.start);
  const stop = useNavigationStore((s) => s.stop);

  if (!route) return null;

  if (!active) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={start}
        className="gap-2 rounded-full"
        title="Acompanhar sua posição em tempo real na rota"
      >
        <Navigation className="h-4 w-4" /> Navegação ao vivo
      </Button>
    );
  }

  return (
    <div className="pointer-events-auto flex max-w-md flex-col gap-2 rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-candy backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold text-foreground">Navegação ao vivo</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={stop}
          className="h-8 w-8"
          aria-label="Parar navegação"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {instruction ? (
        <p className="text-sm leading-snug text-foreground">{instruction.instruction}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Aguardando GPS…</p>
      )}

      {instruction && (
        <p className="text-xs text-muted-foreground">
          Próxima manobra em{' '}
          <strong>{formatDistanceMeters(instruction.distanceToManeuverMeters)}</strong>
        </p>
      )}

      {offRouteMeters > 50 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Fora da rota — {Math.round(offRouteMeters)} m
        </div>
      )}

      {gpsError && offRouteMeters <= 50 && (
        <p className="text-xs text-destructive">{gpsError}</p>
      )}
    </div>
  );
}
