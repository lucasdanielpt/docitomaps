import { create } from 'zustand';
import { REALISTIC3D_MAX_SPEED } from '@/lib/googleTiles';

export type CameraMode = 'follow' | 'free';

/** Câmera exclusiva do modo Foto 3D (Google). */
export type Realistic3DCameraMode = 'isometric' | 'first-person';

export type ZoomPreset = 'global' | 'country' | 'city' | 'neighborhood' | 'street' | 'photorealistic';

export const SPEED_OPTIONS = [1, 2, 4, 8, 16, 32] as const;
export type Speed = (typeof SPEED_OPTIONS)[number];

export const REALISTIC3D_SPEED_OPTIONS = [1, 2] as const;

/**
 * Mapeamento zoom preset → parâmetros de câmera do MapLibre.
 * Ajustado de acordo com PROJETO.md §7.3.
 */
export const ZOOM_PRESETS: Record<ZoomPreset, { zoom: number; pitch: number; label: string }> = {
  global: { zoom: 2, pitch: 0, label: 'Global' },
  country: { zoom: 5, pitch: 0, label: 'País' },
  city: { zoom: 11, pitch: 30, label: 'Cidade' },
  neighborhood: { zoom: 15, pitch: 45, label: 'Bairro' },
  street: { zoom: 17, pitch: 60, label: 'Rua' },
  photorealistic: { zoom: 20, pitch: 75, label: 'Foto (3D)' },
};

export interface PlayerState {
  cinema: boolean;             // toggle da tela cinematográfica
  playing: boolean;
  progress: number;            // 0..1
  speed: Speed;
  cameraMode: CameraMode;
  /** Modo Google Photorealistic 3D (Cesium). */
  realistic3D: boolean;
  /** Câmera no Foto 3D: isométrica (Cesium 3D) ou 1ª pessoa (Street View). */
  realistic3DCamera: Realistic3DCameraMode;
  /** Preset de zoom no cinema 2D (Global → Rua). */
  zoomPreset: ZoomPreset;

  /** Street View carregado e pronto (modo 1ª pessoa). */
  streetViewReady: boolean;
  streetViewUnavailable: boolean;

  isExporting: boolean;
  exportPhase: 'idle' | 'recording' | 'encoding';
  exportProgress: number;

  /** false enquanto Google 3D Tiles refinam (modo Foto 3D). */
  cesiumTilesReady: boolean;
  /** 0–1 progresso de refinamento dos tiles 3D. */
  cesiumRefinementProgress: number;

  setCinema: (v: boolean) => void;
  toggleCinema: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setProgress: (p: number) => void;
  setSpeed: (s: Speed) => void;
  setCameraMode: (m: CameraMode) => void;
  setRealistic3D: (v: boolean) => void;
  toggleRealistic3D: () => void;
  setRealistic3DCamera: (m: Realistic3DCameraMode) => void;
  setZoomPreset: (z: ZoomPreset) => void;
  setExporting: (v: boolean) => void;
  setExportPhase: (p: 'idle' | 'recording' | 'encoding') => void;
  setExportProgress: (p: number) => void;
  setCesiumTilesReady: (v: boolean) => void;
  setCesiumRefinementProgress: (p: number) => void;
  setStreetViewReady: (v: boolean) => void;
  setStreetViewUnavailable: (v: boolean) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  cinema: false,
  playing: false,
  progress: 0,
  speed: 4,
  cameraMode: 'free',
  realistic3D: false,
  realistic3DCamera: 'isometric',
  zoomPreset: 'street',
  streetViewReady: false,
  streetViewUnavailable: false,

  isExporting: false,
  exportPhase: 'idle',
  exportProgress: 0,
  cesiumTilesReady: true,
  cesiumRefinementProgress: 1,

  setCinema: (v) =>
    set((s) => ({
      cinema: v,
      playing: false,
      progress: v ? s.progress : 0,
      cesiumTilesReady: v ? s.cesiumTilesReady : true,
    })),
  toggleCinema: () =>
    set((s) => ({
      cinema: !s.cinema,
      playing: false,
      progress: s.cinema ? 0 : s.progress,
      cesiumTilesReady: s.cinema ? true : s.cesiumTilesReady,
    })),

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),

  setProgress: (p) => set({ progress: Math.max(0, Math.min(1, p)) }),
  setSpeed: (s) =>
    set((state) => ({
      speed:
        state.realistic3D && s > REALISTIC3D_MAX_SPEED
          ? REALISTIC3D_MAX_SPEED
          : s,
    })),
  setCameraMode: (m) => set({ cameraMode: m }),
  setRealistic3D: (v) =>
    set((s) => ({
      realistic3D: v,
      cesiumTilesReady: v ? false : true,
      cesiumRefinementProgress: v ? 0 : 1,
      streetViewReady: false,
      streetViewUnavailable: false,
      speed: v && s.speed > 2 ? 2 : s.speed,
    })),
  toggleRealistic3D: () =>
    set((s) => {
      const next = !s.realistic3D;
      return {
        realistic3D: next,
        cesiumTilesReady: next ? false : true,
        cesiumRefinementProgress: next ? 0 : 1,
        streetViewReady: false,
        streetViewUnavailable: false,
        speed: next && s.speed > 2 ? 2 : s.speed,
      };
    }),

  setRealistic3DCamera: (m) =>
    set({
      realistic3DCamera: m,
      streetViewReady: false,
      streetViewUnavailable: false,
      cesiumTilesReady: m === 'isometric' ? false : true,
    }),

  setZoomPreset: (z) => set({ zoomPreset: z }),

  setExporting: (v) => set({ isExporting: v }),
  setExportPhase: (p) => set({ exportPhase: p }),
  setExportProgress: (p) => set({ exportProgress: Math.max(0, Math.min(1, p)) }),
  setCesiumTilesReady: (v) => set({ cesiumTilesReady: v }),
  setCesiumRefinementProgress: (p) =>
    set({ cesiumRefinementProgress: Math.max(0, Math.min(1, p)) }),

  setStreetViewReady: (v) => set({ streetViewReady: v }),
  setStreetViewUnavailable: (v) => set({ streetViewUnavailable: v }),

  reset: () =>
    set({
      cinema: false,
      playing: false,
      progress: 0,
      speed: 4,
      cameraMode: 'free',
      realistic3D: false,
      realistic3DCamera: 'isometric',
      zoomPreset: 'street',
      streetViewReady: false,
      streetViewUnavailable: false,
      isExporting: false,
      exportPhase: 'idle',
      exportProgress: 0,
      cesiumTilesReady: true,
      cesiumRefinementProgress: 0,
    }),
}));
