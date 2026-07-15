import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouteStore } from '@/stores/routeStore';
import { hasGoogleMapsKey } from '@/config/maps';
import { REALISTIC3D_MAX_SPEED } from '@/lib/googleTiles';
import {
  REALISTIC3D_SPEED_OPTIONS,
  SPEED_OPTIONS,
  usePlayerStore,
  type CameraMode,
  type Realistic3DCameraMode,
  type Speed,
} from '@/stores/playerStore';
import { progressToSeconds } from '@/lib/geometry';
import { formatDurationSeconds } from '@/lib/utils';
import { MAP_BASE_STYLE_OPTIONS } from '@/features/map/mapStyle';
import { useMapStore, type MapBaseStyle } from '@/stores/mapStore';

const CAMERA_MODES_2D: Array<{ value: CameraMode; label: string }> = [
  { value: 'follow', label: 'Seguir personagem' },
  { value: 'free', label: 'Câmera livre' },
];

const CAMERA_MODES_3D: Array<{ value: Realistic3DCameraMode; label: string }> = [
  { value: 'isometric', label: 'Isométrica' },
  { value: 'first-person', label: '1ª pessoa' },
];

export function PlayerControls() {
  const route = useRouteStore((s) => s.route);
  const {
    playing,
    progress,
    speed,
    realistic3D,
    realistic3DCamera,
    cameraMode,
    isExporting,
    cesiumTilesReady,
    cesiumRefinementProgress,
    streetViewReady,
    streetViewUnavailable,
    togglePlay,
    setProgress,
    setSpeed,
    setCameraMode,
    setRealistic3DCamera,
    toggleRealistic3D,
    pause,
  } = usePlayerStore();

  const mapBaseStyle = useMapStore((s) => s.mapBaseStyle);
  const setMapBaseStyle = useMapStore((s) => s.setMapBaseStyle);

  if (!route) return null;

  const total = route.totalDurationSeconds;
  const currentSec = progressToSeconds(progress, total);
  const atEnd = progress >= 1;
  const canUseRealistic3D = hasGoogleMapsKey;
  const playBlocked3D =
    realistic3DCamera === 'isometric' ? !cesiumTilesReady : !streetViewReady;
  const playBlocked = realistic3D && playBlocked3D;
  const speedOptions = realistic3D ? REALISTIC3D_SPEED_OPTIONS : SPEED_OPTIONS;

  const playBlockedTitle = realistic3D
    ? realistic3DCamera === 'first-person'
      ? streetViewUnavailable
        ? 'Street View indisponível neste trecho'
        : 'Carregando Street View…'
      : `Carregando ambiente 3D (${Math.round(cesiumRefinementProgress * 100)}%)`
    : 'Reproduzir';

  return (
    <div
      className="pointer-events-auto flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/90 p-4 shadow-candy backdrop-blur md:flex-row md:items-center"
      role="group"
      aria-label="Controles de reprodução"
      aria-busy={isExporting}
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isExporting}
          onClick={() => {
            pause();
            setProgress(0);
          }}
          aria-label="Reiniciar"
          title="Reiniciar"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="candy"
          size="icon"
          disabled={isExporting || playBlocked}
          onClick={() => {
            if (atEnd) setProgress(0);
            togglePlay();
          }}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
          title={playBlocked ? playBlockedTitle : playing ? 'Pausar' : 'Reproduzir'}
          className="h-11 w-11"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isExporting}
          onClick={() => setProgress(1)}
          aria-label="Ir para o final"
          title="Ir para o final"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <span className="w-16 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {formatDurationSeconds(currentSec)}
        </span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          disabled={isExporting}
          onChange={(e) => setProgress(Number(e.target.value) / 1000)}
          aria-label="Progresso da viagem"
          className="dm-range flex-1"
        />
        <span className="w-16 font-mono text-xs tabular-nums text-muted-foreground">
          {formatDurationSeconds(total)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Vel.</span>
          <Select
            value={String(speed)}
            onValueChange={(v) => {
              const next = Number(v) as Speed;
              setSpeed(
                realistic3D && next > REALISTIC3D_MAX_SPEED ? REALISTIC3D_MAX_SPEED : next,
              );
            }}
            disabled={isExporting}
          >
            <SelectTrigger className="h-9 w-[84px] rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {speedOptions.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant={realistic3D ? 'candy' : 'outline'}
          size="sm"
          disabled={isExporting || !canUseRealistic3D}
          onClick={toggleRealistic3D}
          className="rounded-full text-xs"
          title={
            canUseRealistic3D
              ? 'Alternar Foto 3D (Google)'
              : 'Configure VITE_GOOGLE_MAPS_API_KEY'
          }
        >
          {realistic3D ? '🌍 Foto 3D' : 'Foto 3D'}
        </Button>
        {!realistic3D && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Mapa</span>
            <Select
              value={mapBaseStyle}
              onValueChange={(v) => setMapBaseStyle(v as MapBaseStyle)}
              disabled={isExporting}
            >
              <SelectTrigger className="h-9 w-[108px] rounded-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_BASE_STYLE_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Câm.</span>
          {realistic3D ? (
            <Select
              value={realistic3DCamera}
              onValueChange={(v) => setRealistic3DCamera(v as Realistic3DCameraMode)}
              disabled={isExporting}
            >
              <SelectTrigger className="h-9 w-[128px] rounded-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMERA_MODES_3D.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={cameraMode}
              onValueChange={(v) => setCameraMode(v as CameraMode)}
              disabled={isExporting}
            >
              <SelectTrigger className="h-9 w-[148px] rounded-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMERA_MODES_2D.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
