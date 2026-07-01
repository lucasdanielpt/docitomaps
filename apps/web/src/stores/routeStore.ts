import { create } from 'zustand';
import type {
  OptimizedRoute,
  RoutePreferences,
  TravelMode,
  Waypoint,
} from '@docitomapas/shared';
import { uid } from '@/lib/utils';

export interface RouteState {
  origin: Waypoint | null;
  destination: Waypoint | null;
  stops: Waypoint[];
  mode: TravelMode;
  preferences: RoutePreferences;
  optimize: boolean;
  optimizedOrder: string[] | null;
  route: OptimizedRoute | null;

  setOrigin: (wp: Waypoint | null) => void;
  setDestination: (wp: Waypoint | null) => void;
  addStop: (partial?: Partial<Waypoint>) => Waypoint;
  updateStop: (id: string, patch: Partial<Waypoint>) => void;
  removeStop: (id: string) => void;
  reorderStops: (from: number, to: number) => void;
  toggleFixed: (id: string) => void;

  setMode: (mode: TravelMode) => void;
  setPreference: (key: keyof RoutePreferences, value: boolean) => void;
  setOptimize: (v: boolean) => void;

  setRouteResult: (result: { route: OptimizedRoute; optimizedOrder: string[] }) => void;
  clearRouteResult: () => void;

  reset: () => void;
}

function makeStop(partial?: Partial<Waypoint>): Waypoint {
  return {
    id: partial?.id ?? uid(),
    label: partial?.label,
    address: partial?.address ?? '',
    location: partial?.location ?? { lat: 0, lng: 0 },
    fixedOrder: partial?.fixedOrder ?? false,
    stopDurationMin: partial?.stopDurationMin ?? 0,
  };
}

export const useRouteStore = create<RouteState>((set) => ({
  origin: null,
  destination: null,
  stops: [],
  mode: 'driving-car',
  preferences: {},
  optimize: true,
  optimizedOrder: null,
  route: null,

  setOrigin: (wp) => set({ origin: wp, route: null, optimizedOrder: null }),
  setDestination: (wp) => set({ destination: wp, route: null, optimizedOrder: null }),

  addStop: (partial) => {
    const stop = makeStop(partial);
    set((state) => ({
      stops: [...state.stops, stop],
      route: null,
      optimizedOrder: null,
    }));
    return stop;
  },

  updateStop: (id, patch) =>
    set((state) => ({
      stops: state.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      route: null,
      optimizedOrder: null,
    })),

  removeStop: (id) =>
    set((state) => ({
      stops: state.stops.filter((s) => s.id !== id),
      route: null,
      optimizedOrder: null,
    })),

  reorderStops: (from, to) =>
    set((state) => {
      const next = state.stops.slice();
      const item = next[from];
      if (!item) return {};
      next.splice(from, 1);
      next.splice(to, 0, item);
      return { stops: next, route: null, optimizedOrder: null };
    }),

  toggleFixed: (id) =>
    set((state) => ({
      stops: state.stops.map((s) =>
        s.id === id ? { ...s, fixedOrder: !s.fixedOrder } : s,
      ),
      route: null,
      optimizedOrder: null,
    })),

  setMode: (mode) => set({ mode, route: null, optimizedOrder: null }),
  setPreference: (key, value) =>
    set((state) => ({
      preferences: { ...state.preferences, [key]: value },
      route: null,
      optimizedOrder: null,
    })),
  setOptimize: (v) => set({ optimize: v }),

  setRouteResult: ({ route, optimizedOrder }) => set({ route, optimizedOrder }),
  clearRouteResult: () => set({ route: null, optimizedOrder: null }),

  reset: () =>
    set({
      origin: null,
      destination: null,
      stops: [],
      mode: 'driving-car',
      preferences: {},
      optimize: true,
      optimizedOrder: null,
      route: null,
    }),
}));
