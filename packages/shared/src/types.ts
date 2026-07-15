export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface Waypoint {
  id: string;
  label?: string;
  address: string;
  location: LatLng;
  fixedOrder?: boolean;
  stopDurationMin?: number;
}

export type TravelMode =
  | 'driving-car'
  | 'driving-hgv'
  | 'cycling-regular'
  | 'foot-walking'
  | 'foot-hiking';

export interface RoutePreferences {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

export interface Roadtrip {
  id: string;
  name: string;
  origin: Waypoint;
  destination: Waypoint;
  stops: Waypoint[];
  optimizedOrder?: string[];
  mode: TravelMode;
  preferences: RoutePreferences;
  createdAt: string;
  updatedAt: string;
}

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteStep {
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;
  location: [number, number];
}

export interface RouteLeg {
  fromId: string;
  toId: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: LineStringGeometry;
  instructions: RouteStep[];
}

export interface OptimizedRoute {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
  fullGeometry: LineStringGeometry;
}

export interface GeocodeResult {
  label: string;
  location: LatLng;
  boundingBox?: BoundingBox;
  countryCode?: string;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
}

export interface RouteResponse {
  legs: RouteLeg[];
  fullGeometry: LineStringGeometry;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

export interface OptimizeRequestBody {
  origin: Waypoint;
  destination?: Waypoint;
  stops: Waypoint[];
  mode: TravelMode;
  preferences?: RoutePreferences;
}

export interface OptimizeResponse {
  optimizedOrder: string[];
  route: OptimizedRoute;
}
