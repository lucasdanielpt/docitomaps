import { create } from 'zustand';
import type { LatLng } from '@docitomapas/shared';
import type { NavigationInstruction } from '@/lib/navigation';

export interface NavigationState {
  active: boolean;
  /** Posição bruta do GPS. */
  rawPosition: LatLng | null;
  /** Posição encaixada na rota. */
  snappedPosition: LatLng | null;
  progress: number;
  offRouteMeters: number;
  heading: number;
  currentInstruction: NavigationInstruction | null;
  gpsError: string | null;
  watchId: number | null;

  start: () => void;
  stop: () => void;
  setGpsUpdate: (update: {
    raw: LatLng;
    snapped: LatLng;
    progress: number;
    offRouteMeters: number;
    heading: number;
    instruction: NavigationInstruction | null;
  }) => void;
  setGpsError: (msg: string | null) => void;
  setWatchId: (id: number | null) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  active: false,
  rawPosition: null,
  snappedPosition: null,
  progress: 0,
  offRouteMeters: 0,
  heading: 0,
  currentInstruction: null,
  gpsError: null,
  watchId: null,

  start: () =>
    set({
      active: true,
      gpsError: null,
      rawPosition: null,
      snappedPosition: null,
      progress: 0,
      offRouteMeters: 0,
      currentInstruction: null,
    }),

  stop: () => {
    const id = get().watchId;
    if (id !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(id);
    }
    set({
      active: false,
      watchId: null,
      rawPosition: null,
      snappedPosition: null,
      gpsError: null,
      currentInstruction: null,
    });
  },

  setGpsUpdate: (update) =>
    set({
      rawPosition: update.raw,
      snappedPosition: update.snapped,
      progress: update.progress,
      offRouteMeters: update.offRouteMeters,
      heading: update.heading,
      currentInstruction: update.instruction,
      gpsError: null,
    }),

  setGpsError: (msg) => set({ gpsError: msg }),
  setWatchId: (id) => set({ watchId: id }),
}));
