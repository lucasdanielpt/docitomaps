import { create } from 'zustand';

export type CameraMode = 'top-down' | 'isometric' | 'third-person' | 'first-person';

export type ZoomPreset = 'global' | 'country' | 'city' | 'neighborhood' | 'street' | 'photorealistic';

export const SPEED_OPTIONS = [1, 2, 4, 8, 16, 32] as const;
export type Speed = (typeof SPEED_OPTIONS)[number];

/**
 * Mapeamento zoom preset → parâmetros de câmera do MapLibre.
 * Ajustado de acordo com PROJETO.md §7.3.
 */
export const ZOOM_PRESETS: Record<ZoomPreset, { zoom: number; pitch: number; label: string }> = {
  global: { zoom: 2, pitch: 0, label: 'Global' },
  country: { zoom: 5, pitch: 0, label: 'País' },
  city: { zoom: 11, pitch: 30, label: 'Cidade' },
  neighborhood: { zoom: 15, pitch: 45, label: 'Bairro' },
  street: { zoom: 18, pitch: 60, label: 'Rua' },
  photorealistic: { zoom: 20, pitch: 75, label: 'Foto (3D)' },
};

export interface PlayerState {
  cinema: boolean;             // toggle da tela cinematográfica
  playing: boolean;
  progress: number;            // 0..1
  speed: Speed;
  cameraMode: CameraMode;
  zoomPreset: ZoomPreset;

  setCinema: (v: boolean) => void;
  toggleCinema: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setProgress: (p: number) => void;
  setSpeed: (s: Speed) => void;
  setCameraMode: (m: CameraMode) => void;
  setZoomPreset: (z: ZoomPreset) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  cinema: false,
  playing: false,
  progress: 0,
  speed: 4,
  cameraMode: 'third-person',
  zoomPreset: 'street',

  setCinema: (v) => set({ cinema: v, playing: false, progress: 0 }),
  toggleCinema: () =>
    set((s) => ({ cinema: !s.cinema, playing: false, progress: s.cinema ? s.progress : 0 })),

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),

  setProgress: (p) => set({ progress: Math.max(0, Math.min(1, p)) }),
  setSpeed: (s) => set({ speed: s }),
  setCameraMode: (m) => set({ cameraMode: m }),
  setZoomPreset: (z) => set({ zoomPreset: z }),

  reset: () =>
    set({
      cinema: false,
      playing: false,
      progress: 0,
      speed: 4,
      cameraMode: 'third-person',
      zoomPreset: 'street',
    }),
}));
