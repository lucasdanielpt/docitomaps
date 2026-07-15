import type { CameraMode, ZoomPreset } from '@/stores/playerStore';
import { ZOOM_PRESETS } from '@/stores/playerStore';
import { offsetByBearing, type InterpolatedPosition } from '@/lib/geometry';

export interface CinemaCameraState {
  centerLng: number;
  centerLat: number;
  bearing: number;
  pitch: number;
  zoom: number;
  modelVisible: boolean;
  /** Distância Cesium (m) para lookAt — usado no modo fotorrealista. */
  cesiumRangeMeters: number;
}

/** Distância padrão da câmera ao seguir o personagem no Cesium (m). */
export const CESIUM_THIRD_PERSON_DISTANCE_M = 5;
/** Altura dos olhos em 3ª pessoa (m). */
export const CESIUM_EYE_HEIGHT_M = 1.65;

const FOLLOW_PITCH = 45;

/**
 * Parâmetros de câmera no modo cinema.
 * `follow` — vista isométrica atrás do personagem; `free` — usuário controla o mapa.
 */
export function computeCinemaCamera(
  pos: InterpolatedPosition,
  cameraMode: CameraMode,
  currentMapZoom: number,
  realistic3D: boolean,
  zoomPreset: ZoomPreset = 'street',
): CinemaCameraState {
  const modelVisible = true;

  if (cameraMode === 'free') {
    return {
      centerLng: pos.lng,
      centerLat: pos.lat,
      bearing: pos.heading,
      pitch: currentMapZoom > 0 ? 0 : 0,
      zoom: currentMapZoom,
      modelVisible,
      cesiumRangeMeters: 80,
    };
  }

  // follow — vista isométrica atrás do boneco
  const behindDistance = realistic3D ? CESIUM_THIRD_PERSON_DISTANCE_M + 20 : 35;
  const behind = offsetByBearing(pos.lng, pos.lat, pos.heading + 180, behindDistance);
  const preset = ZOOM_PRESETS[zoomPreset] ?? ZOOM_PRESETS.street;

  return {
    centerLng: behind.lng,
    centerLat: behind.lat,
    bearing: pos.heading,
    pitch: realistic3D ? 60 : FOLLOW_PITCH,
    zoom: preset.zoom,
    modelVisible,
    cesiumRangeMeters: realistic3D ? 30 : behindDistance,
  };
}

/** MapLibre pitch (0=plano, 85=quase horizontal) → Cesium pitch em radianos. */
export function mapPitchToCesiumRadians(mapPitchDeg: number): number {
  const cesiumPitchDeg = mapPitchDeg - 90;
  return (cesiumPitchDeg * Math.PI) / 180;
}

/** Altitude aproximada da câmera a partir do zoom MapLibre (fallback top-down). */
export function zoomToCameraHeightMeters(zoom: number, latDeg: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / 2 ** zoom;
  return metersPerPixel * 512;
}
