import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { usePlayerStore, type Speed } from '@/stores/playerStore';

export type VideoResolution = '720p' | '1080p' | '4k';
export type VideoFps = 30 | 60;
export type VideoFormat = 'webm' | 'mp4';

export interface VideoExportOptions {
  resolution: VideoResolution;
  fps: VideoFps;
  format: VideoFormat;
}

export type ExportPhase = 'idle' | 'recording' | 'encoding';

const EXPORT_SPEED: Speed = 16;

function bitrateForResolution(resolution: VideoResolution): number {
  switch (resolution) {
    case '720p':
      return 4_000_000;
    case '1080p':
      return 8_000_000;
    case '4k':
      return 20_000_000;
  }
}

function scaleFilterForResolution(resolution: VideoResolution): string | null {
  switch (resolution) {
    case '720p':
      return 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2';
    case '1080p':
      return 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2';
    case '4k':
      return 'scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2';
  }
}

export function findMapCanvas(): HTMLCanvasElement | null {
  const cesiumCanvas = document.querySelector('.cesium-viewer canvas');
  if (cesiumCanvas instanceof HTMLCanvasElement) return cesiumCanvas;
  const mapCanvas = document.querySelector('canvas.maplibregl-canvas');
  return mapCanvas instanceof HTMLCanvasElement ? mapCanvas : null;
}

function pickRecorderMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return 'video/webm';
}

let ffmpegInstance: FFmpeg | null = null;

async function getFfmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => onLog?.(message));

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

async function transcodeWebmToMp4(
  webm: Blob,
  resolution: VideoResolution,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFfmpeg();
  const inputName = 'input.webm';
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(webm));

  const scale = scaleFilterForResolution(resolution);
  const args = ['-i', inputName];
  if (scale) args.push('-vf', scale);
  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-movflags', '+faststart', outputName);

  ffmpeg.on('progress', ({ progress }) => {
    onProgress(Math.max(0, Math.min(1, progress ?? 0)));
  });

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  return new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' });
}

export function triggerVideoDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface RecordRouteVideoCallbacks {
  onPhase: (phase: ExportPhase) => void;
  onProgress: (progress: number) => void;
}

/**
 * Grava a animação da rota via MediaRecorder no canvas do MapLibre.
 * A animação roda acelerada (16x) enquanto grava; opcionalmente transcodifica para MP4.
 */
export async function recordRouteVideo(
  options: VideoExportOptions,
  callbacks: RecordRouteVideoCallbacks,
  signal?: AbortSignal,
): Promise<Blob> {
  const canvas = findMapCanvas();
  if (!canvas) {
    throw new Error('Canvas do mapa não encontrado. Abra o modo cinema antes de exportar.');
  }

  const store = usePlayerStore.getState();
  const prevSpeed = store.speed;
  const prevPlaying = store.playing;
  const prevProgress = store.progress;

  store.setExporting(true);
  store.setExportPhase('recording');
  store.setExportProgress(0);
  store.pause();
  store.setProgress(0);
  store.setSpeed(EXPORT_SPEED);

  callbacks.onPhase('recording');
  callbacks.onProgress(0);

  const mimeType = pickRecorderMimeType();
  const stream = canvas.captureStream(options.fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrateForResolution(options.resolution),
  });

  const chunks: BlobPart[] = [];

  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      unsub?.();
      stream.getTracks().forEach((t) => t.stop());
      store.setExporting(false);
      store.setExportPhase('idle');
      store.setSpeed(prevSpeed);
      store.setProgress(prevProgress);
      if (prevPlaying) store.play();
      else store.pause();
      fn();
    };

    const fail = (err: unknown) => {
      finish(() => reject(err instanceof Error ? err : new Error(String(err))));
    };

    signal?.addEventListener('abort', () => {
      if (recorder.state !== 'inactive') recorder.stop();
      store.setExporting(false);
      store.setExportPhase('idle');
      fail(new DOMException('Exportação cancelada', 'AbortError'));
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = () => fail(new Error('Falha na gravação do vídeo'));

    recorder.onstop = () => {
      void (async () => {
        try {
          let blob = new Blob(chunks, { type: mimeType });

          if (options.format === 'mp4') {
            store.setExportPhase('encoding');
            callbacks.onPhase('encoding');
            callbacks.onProgress(0.92);
            blob = await transcodeWebmToMp4(blob, options.resolution, (p) => {
              const merged = 0.92 + p * 0.08;
              store.setExportProgress(merged);
              callbacks.onProgress(merged);
            });
          }

          store.setExportProgress(1);
          callbacks.onProgress(1);
          finish(() => resolve(blob));
        } catch (err) {
          fail(err);
        }
      })();
    };

    unsub = usePlayerStore.subscribe((state) => {
      const p = Math.min(0.9, state.progress * 0.9);
      store.setExportProgress(p);
      callbacks.onProgress(p);
      if (state.progress >= 1) {
        store.pause();
        if (recorder.state === 'recording') recorder.stop();
      }
    });

    // Aguarda 2 frames para o mapa estabilizar no progresso 0.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        store.play();
        recorder.start(1000);
      });
    });
  });
}
