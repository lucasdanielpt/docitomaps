import { useState } from 'react';
import { Flag, MapPin, Loader2, Wand2, RotateCcw } from 'lucide-react';
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

const TRAVEL_MODES: Array<{ value: TravelMode; label: string }> = [
  { value: 'driving-car', label: 'Carro' },
  { value: 'driving-hgv', label: 'Caminhão' },
  { value: 'cycling-regular', label: 'Bicicleta' },
  { value: 'foot-walking', label: 'A pé' },
  { value: 'foot-hiking', label: 'Trilha' },
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
      setError(err instanceof Error ? err.message : 'Erro ao calcular rota');
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r bg-background md:w-[400px] lg:w-[440px]">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Planeje sua rota</h2>
        <p className="text-sm text-muted-foreground">
          Defina origem, paradas e destino. O DocitoMapas otimiza a ordem para o menor tempo.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            Partida
          </Label>
          <AddressInput
            value={origin}
            onSelect={(wp) => setOrigin({ ...wp, id: origin?.id ?? uid(), label: 'Partida' })}
            placeholder="De onde você sai?"
            iconColor="text-emerald-600"
          />
        </div>

        <StopsList />

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-rose-600" />
            Destino
          </Label>
          <AddressInput
            value={destination}
            onSelect={(wp) => setDestination({ ...wp, id: destination?.id ?? uid(), label: 'Destino' })}
            placeholder="Para onde você vai?"
            iconColor="text-rose-600"
          />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-2">
            <Label>Modo de transporte</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as TravelMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAVEL_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="optimize">Otimizar ordem das paradas</Label>
              <p className="text-xs text-muted-foreground">
                Encontra a melhor sequência (menor tempo).
              </p>
            </div>
            <Switch id="optimize" checked={optimize} onCheckedChange={setOptimize} />
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground">
              Preferências avançadas
            </summary>
            <div className="mt-2 space-y-2 pl-1">
              <label className="flex items-center justify-between">
                <span>Evitar pedágios</span>
                <Switch
                  checked={Boolean(preferences.avoidTolls)}
                  onCheckedChange={(v) => setPreference('avoidTolls', v)}
                />
              </label>
              <label className="flex items-center justify-between">
                <span>Evitar rodovias</span>
                <Switch
                  checked={Boolean(preferences.avoidHighways)}
                  onCheckedChange={(v) => setPreference('avoidHighways', v)}
                />
              </label>
              <label className="flex items-center justify-between">
                <span>Evitar balsas</span>
                <Switch
                  checked={Boolean(preferences.avoidFerries)}
                  onCheckedChange={(v) => setPreference('avoidFerries', v)}
                />
              </label>
            </div>
          </details>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {route && (
          <div className="rounded-md border bg-primary/5 p-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Resultado</span>
              <span className="text-xs text-muted-foreground">
                {route.legs.length} trechos
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Distância</div>
                <div className="font-semibold">
                  {formatDistanceMeters(route.totalDistanceMeters)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tempo</div>
                <div className="font-semibold">
                  {formatDurationSeconds(route.totalDurationSeconds)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t p-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={reset}
          title="Limpar tudo"
          aria-label="Limpar tudo"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          className="flex-1"
          size="lg"
          onClick={handleCalculate}
          disabled={!canCalculate || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" /> Calcular rota
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
