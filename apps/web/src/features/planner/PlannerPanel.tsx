import { useState } from 'react';
import { Flag, Loader2, MapPin, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
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
    preferences,
    optimize,
    route,
    setOrigin,
    setDestination,
    setMode,
    setPreference,
    setOptimize,
    setRouteResult,
    reset,
  } = useRouteStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCalculate = origin !== null && destination !== null;

  async function handleCalculate() {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      if (optimize && stops.length > 0) {
        const res = await optimizeRoute({ origin, destination, stops, mode, preferences });
        setRouteResult({ route: res.route, optimizedOrder: res.optimizedOrder });
      } else {
        const waypoints = [origin.location, ...stops.map((s) => s.location), destination.location];
        const r = await fetchRoute(waypoints, mode, preferences);
        setRouteResult({
          route: {
            totalDistanceMeters: r.totalDistanceMeters,
            totalDurationSeconds: r.totalDurationSeconds,
            legs: r.legs,
            fullGeometry: r.fullGeometry,
          },
          optimizedOrder: stops.map((s) => s.id),
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
      className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-candy backdrop-blur"
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

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
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
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Destino final
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

        <div className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-soft">
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

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="optimize" className="cursor-pointer text-sm font-semibold">
                  Organizar as paradas para mim
                </Label>
                <p className="text-xs text-muted-foreground">
                  A gente escolhe a ordem que economiza mais tempo.
                </p>
              </div>
              <Switch id="optimize" checked={optimize} onCheckedChange={setOptimize} />
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
                Preferências avançadas
              </summary>
              <div className="mt-3 space-y-2 rounded-xl bg-secondary/40 p-3">
                <label className="flex items-center justify-between text-sm">
                  <span>Evitar pedágios</span>
                  <Switch
                    checked={Boolean(preferences.avoidTolls)}
                    onCheckedChange={(v) => setPreference('avoidTolls', v)}
                  />
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span>Evitar rodovias</span>
                  <Switch
                    checked={Boolean(preferences.avoidHighways)}
                    onCheckedChange={(v) => setPreference('avoidHighways', v)}
                  />
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span>Evitar balsas</span>
                  <Switch
                    checked={Boolean(preferences.avoidFerries)}
                    onCheckedChange={(v) => setPreference('avoidFerries', v)}
                  />
                </label>
              </div>
            </details>
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
            Preencha partida e destino para começar.
          </p>
        )}
        {/* Referência ao ícone antigo mantida para não quebrar tree-shaking */}
        <span className="hidden">
          <Wand2 />
        </span>
      </div>
    </section>
  );
}
