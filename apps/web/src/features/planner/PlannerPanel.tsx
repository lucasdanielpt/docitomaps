import { useState } from 'react';
import { Flag, Loader2, MapPin, RotateCcw, Sparkles } from 'lucide-react';
import type { TravelMode } from '@docitomapas/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouteStore } from '@/stores/routeStore';
import { AddressInput } from './AddressInput';
import { StopsList } from './StopsList';
import { RouteLegsList } from './RouteLegsList';
import { fetchRoute, optimizeRoute } from '@/services/api';
import { formatDistanceMeters, formatDurationSeconds, uid } from '@/lib/utils';

const TRAVEL_MODES: Array<{ value: TravelMode; label: string; emoji: string }> = [
  { value: 'driving-car', label: 'Carro', emoji: '🚗' },
  { value: 'driving-hgv', label: 'Caminhão', emoji: '🚚' },
  { value: 'cycling-regular', label: 'Bicicleta', emoji: '🚲' },
  { value: 'foot-walking', label: 'A pé', emoji: '🚶' },
  { value: 'foot-hiking', label: 'Trilha', emoji: '🥾' },
];

export function PlannerPanel() {
  const {
    origin,
    destination,
    stops,
    mode,
    route,
    optimize,
    setOrigin,
    setDestination,
    setMode,
    setOptimize,
    setRouteResult,
    reset,
  } = useRouteStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCalculate =
    origin !== null && (destination !== null || stops.length > 0);

  async function handleCalculate() {
    if (!origin) return;
    if (!destination && stops.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      if (stops.length > 0 && optimize) {
        const res = await optimizeRoute({
          origin,
          ...(destination ? { destination } : {}),
          stops,
          mode,
        });
        setRouteResult({ route: res.route, optimizedOrder: res.optimizedOrder });
      } else {
        const orderedStops = stops;
        const waypoints = [
          origin.location,
          ...orderedStops.map((s) => s.location),
          ...(destination ? [destination.location] : []),
        ];
        const r = await fetchRoute(waypoints, mode);
        setRouteResult({
          route: {
            totalDistanceMeters: r.totalDistanceMeters,
            totalDurationSeconds: r.totalDurationSeconds,
            legs: r.legs,
            fullGeometry: r.fullGeometry,
          },
          optimizedOrder: orderedStops.map((s) => s.id),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para calcular agora, tente de novo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-candy"
      aria-labelledby="planner-title"
    >
      <header className="flex items-baseline justify-between border-b border-border/40 px-6 py-5">
        <h2 id="planner-title" className="font-display text-xl font-semibold text-foreground">
          Seu roteiro
        </h2>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Limpar tudo
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div className="space-y-2">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Partida
          </span>
          <AddressInput
            value={origin}
            onSelect={(wp) => setOrigin({ ...wp, id: origin?.id ?? uid(), label: 'Partida' })}
            placeholder="De onde você sai? Ex: Rua das Balas, 100"
            icon={<MapPin className="h-4 w-4 text-emerald-600" aria-hidden />}
          />
        </div>

        <StopsList />

        <div className="space-y-2">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Destino final <span className="font-normal normal-case">(opcional)</span>
          </span>
          <AddressInput
            value={destination}
            onSelect={(wp) =>
              setDestination({ ...wp, id: destination?.id ?? uid(), label: 'Destino' })
            }
            placeholder="Para onde vamos? Ex: Confeitaria Central"
            icon={<Flag className="h-4 w-4 text-primary" aria-hidden />}
          />
        </div>

        <div className="rounded-2xl border border-border bg-muted/50 p-4 shadow-soft">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Modo da viagem
              </Label>
              <Select value={mode} onValueChange={(v) => setMode(v as TravelMode)}>
                <SelectTrigger className="h-11 rounded-full border-border bg-card/80 pl-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAVEL_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="mr-2">{m.emoji}</span>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Ordem automática:</span> informe
              apenas os lugares por onde quer passar — calculamos a sequência que{' '}
              <strong>menor tempo total</strong> de viagem.
            </p>

            <label className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5 text-sm">
              <span>Otimizar ordem das paradas</span>
              <Switch checked={optimize} onCheckedChange={setOptimize} />
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {route && (
          <div className="rounded-2xl border border-primary/20 bg-gradient-sprinkle/60 p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-base font-semibold">Caminho mais docinho ✨</span>
              <span className="text-xs text-muted-foreground">{route.legs.length} trechos</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Distância
                </div>
                <div className="font-display text-lg font-semibold">
                  {formatDistanceMeters(route.totalDistanceMeters)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Tempo</div>
                <div className="font-display text-lg font-semibold">
                  {formatDurationSeconds(route.totalDurationSeconds)}
                </div>
              </div>
            </div>
          </div>
        )}

        {route && <RouteLegsList route={route} />}
      </div>

      <div className="border-t border-border/40 p-6">
        <Button
          type="button"
          variant="candy"
          size="lg"
          className="w-full"
          onClick={handleCalculate}
          disabled={!canCalculate || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Calculando…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" /> Calcular caminho mais rápido
            </>
          )}
        </Button>
        {!canCalculate && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Preencha a partida e ao menos uma parada ou destino.
          </p>
        )}
      </div>
    </section>
  );
}
