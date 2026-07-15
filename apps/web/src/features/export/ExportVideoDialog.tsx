import { useRef, useState } from 'react';
import { Download, Film, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  recordRouteVideo,
  triggerVideoDownload,
  type ExportPhase,
  type VideoExportOptions,
  type VideoFormat,
  type VideoFps,
  type VideoResolution,
} from '@/lib/exportVideo';
import { usePlayerStore } from '@/stores/playerStore';

const RESOLUTIONS: Array<{ value: VideoResolution; label: string }> = [
  { value: '720p', label: '720p HD' },
  { value: '1080p', label: '1080p Full HD' },
  { value: '4k', label: '4K Ultra HD' },
];

const FPS_OPTIONS: Array<{ value: VideoFps; label: string }> = [
  { value: 30, label: '30 fps' },
  { value: 60, label: '60 fps' },
];

const FORMATS: Array<{ value: VideoFormat; label: string; hint?: string }> = [
  { value: 'webm', label: 'WebM', hint: 'rápido, compatível com Chrome/Firefox' },
  { value: 'mp4', label: 'MP4', hint: 'transcodifica no navegador (~30s extra)' },
];

function phaseLabel(phase: ExportPhase): string {
  if (phase === 'recording') return 'Gravando animação…';
  if (phase === 'encoding') return 'Convertendo para MP4…';
  return '';
}

export function ExportVideoDialog() {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<VideoResolution>('1080p');
  const [fps, setFps] = useState<VideoFps>(30);
  const [format, setFormat] = useState<VideoFormat>('webm');
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isExporting = usePlayerStore((s) => s.isExporting);

  const busy = isExporting || phase !== 'idle';

  const handleExport = async () => {
    setError(null);
    setProgress(0);
    abortRef.current = new AbortController();

    const options: VideoExportOptions = { resolution, fps, format };

    try {
      const blob = await recordRouteVideo(
        options,
        {
          onPhase: setPhase,
          onProgress: setProgress,
        },
        abortRef.current.signal,
      );

      const ext = format === 'mp4' ? 'mp4' : 'webm';
      triggerVideoDownload(blob, `docitomapas-viagem.${ext}`);
      setOpen(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Exportação cancelada.');
      } else {
        setError(err instanceof Error ? err.message : 'Falha ao exportar vídeo.');
      }
    } finally {
      setPhase('idle');
      setProgress(0);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="candy" size="sm" className="gap-2 shadow-candy">
          <Film className="h-4 w-4" /> Exportar vídeo
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="export-video-desc">
        <DialogHeader>
          <DialogTitle>Exportar viagem em vídeo</DialogTitle>
          <DialogDescription id="export-video-desc">
            Gravamos a animação acelerada (16×) do percurso. Mantenha o modo cinema aberto e
            evite trocar de aba durante a gravação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="export-resolution">Resolução alvo</Label>
            <Select
              value={resolution}
              onValueChange={(v) => setResolution(v as VideoResolution)}
              disabled={busy}
            >
              <SelectTrigger id="export-resolution" className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="export-fps">FPS</Label>
              <Select
                value={String(fps)}
                onValueChange={(v) => setFps(Number(v) as VideoFps)}
                disabled={busy}
              >
                <SelectTrigger id="export-fps" className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FPS_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={String(f.value)}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="export-format">Formato</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as VideoFormat)}
                disabled={busy}
              >
                <SelectTrigger id="export-format" className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {format === 'mp4' && (
            <p className="text-xs text-muted-foreground">
              MP4 usa ffmpeg.wasm no navegador — a primeira exportação pode demorar um pouco mais
              enquanto o encoder carrega.
            </p>
          )}

          {busy && (
            <div className="space-y-2 rounded-2xl border border-border/50 bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {phaseLabel(phase)}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-candy transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {Math.round(progress * 100)}%
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {busy ? (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
                <Button type="button" variant="candy" onClick={() => void handleExport()} className="gap-2">
                  <Download className="h-4 w-4" /> Baixar vídeo
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
