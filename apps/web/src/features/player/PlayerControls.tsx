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
import {
  SPEED_OPTIONS,
  ZOOM_PRESETS,
  usePlayerStore,
  type CameraMode,
  type Speed,
  type ZoomPreset,
} from '@/stores/playerStore';
import { progressToSeconds } from '@/lib/geometry';
import { formatDurationSeconds } from '@/lib/utils';

const CAMERA_MODES: Array<{ value: CameraMode; label: string }> = [
  { value: 'top-down', label: 'Topo' },
  { value: 'isometric', label: 'Isométrica' },
  { value: 'third-person', label: '3ª pessoa' },
  { value: 'first-person', label: '1ª pessoa' },
];

export function PlayerControls() {
  const route = useRouteStore((s) => s.route);
  const {
    playing,
    progress,
    speed,
    zoomPreset,
    cameraMode,
    togglePlay,
    setProgress,
    setSpeed,
    setZoomPreset,
    setCameraMode,
    pause,
  } = usePlayerStore();

  if (!route) return null;

  const total = route.totalDurationSeconds;
  const currentSec = progressToSeconds(progress, total);
  const atEnd = progress >= 1;

  return (
    <div
      className="pointer-events-auto flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/90 p-4 shadow-candy backdrop-blur md:flex-row md:items-center"
      role="group"
      aria-label="Controles de reprodução"
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
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
          onClick={() => {
            if (atEnd) setProgress(0);
            togglePlay();
          }}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
          className="h-11 w-11"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
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
          <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v) as Speed)}>
            <SelectTrigger className="h-9 w-[84px] rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEED_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <Select value={zoomPreset} onValueChange={(v) => setZoomPreset(v as ZoomPreset)}>
            <SelectTrigger className="h-9 w-[120px] rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ZOOM_PRESETS) as ZoomPreset[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {ZOOM_PRESETS[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Câm.</span>
          <Select value={cameraMode} onValueChange={(v) => setCameraMode(v as CameraMode)}>
            <SelectTrigger className="h-9 w-[128px] rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMERA_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
