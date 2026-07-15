import { create } from 'zustand';
import type { LatLng } from '@docitomapas/shared';

export type MapBaseStyle = 'styled' | 'hybrid';

export interface MapState {
  /** Centro atual do mapa — usado para viés de busca de endereços. */
  center: LatLng | null;
  mapBaseStyle: MapBaseStyle;
  setCenter: (c: LatLng | null) => void;
  setMapBaseStyle: (s: MapBaseStyle) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: null,
  mapBaseStyle: 'hybrid',
  setCenter: (c) => set({ center: c }),
  setMapBaseStyle: (s) => set({ mapBaseStyle: s }),
}));
