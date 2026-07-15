import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import type { LineStringGeometry, OptimizedRoute, TravelMode, Waypoint } from '@docitomapas/shared';
import { useRouteStore } from '@/stores/routeStore';
import { usePlayerStore, type Speed } from '@/stores/playerStore';
import {
  computeCumulativeDistances,
  interpolatePosition,
  type CumulativeDistances,
} from '@/lib/geometry';
import { CharacterLayer, type CharacterMotion } from '@/features/character/CharacterLayer';
import {
  CesiumPhotorealisticView,
  type CesiumPhotorealisticHandle,
} from '@/features/map/CesiumPhotorealisticView';
import { StreetViewPane } from '@/features/map/StreetViewPane';
import { CesiumErrorBoundary } from '@/features/map/CesiumErrorBoundary';
import { hasGoogleMapsKey } from '@/config/maps';
import { computeCinemaCamera } from '@/lib/cesiumCamera';
import { OSM_RASTER_STYLE, styleForBase } from './mapStyle';
import { useMapStore } from '@/stores/mapStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { useLiveNavigation } from '@/features/navigation/useLiveNavigation';

const ROUTE_SOURCE_ID = 'route-source';
const ROUTE_LAYER_ID = 'route-line';
const ROUTE_CASING_ID = 'route-casing';
const MARKERS_SOURCE_ID = 'markers-source';
const CHARACTER_LAYER_ID = 'docito-character';

interface OrderedWaypoint {
  wp: Waypoint;
  index: number;
  kind: 'origin' | 'stop' | 'destination';
}

function markerColor(kind: OrderedWaypoint['kind']): string {
  if (kind === 'origin') return 'oklch(0.62 0.16 155)';
  if (kind === 'destination') return 'oklch(0.62 0.24 10)';
  return 'oklch(0.78 0.18 355)';
}

function deriveCharacterMotion(
  travelMode: TravelMode,
  speed: Speed,
  playing: boolean,
): CharacterMotion {
  if (!playing) return 'idle';
  const isVehicle = travelMode === 'driving-car' || travelMode === 'driving-hgv';
  if (isVehicle) return speed >= 4 ? 'run' : 'walk';
  if (travelMode === 'cycling-regular') return speed >= 4 ? 'run' : 'walk';
  return speed >= 8 ? 'run' : 'walk';
}

function computeBoundsFromGeom(geom: LineStringGeometry): LngLatBoundsLike | null {
  if (geom.coordinates.length === 0) return null;
  const first = geom.coordinates[0];
  if (!first) return null;
  let minLng = first[0];
  let minLat = first[1];
  let maxLng = first[0];
  let maxLat = first[1];
  for (const [lng, lat] of geom.coordinates) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Garante sources/layers da rota após load ou troca de estilo (fallback). */
function ensureRouteLayers(map: maplibregl.Map): void {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: ROUTE_CASING_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'oklch(0.68 0.22 355)', 'line-width': 5 },
    });
  }
  if (!map.getSource(MARKERS_SOURCE_ID)) {
    map.addSource(MARKERS_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
}

function isCharacterDebugEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === 'character'
  );
}

function createCharacterHtmlMarker(map: maplibregl.Map): maplibregl.Marker {
  const el = document.createElement('div');
  el.className = 'docito-character-marker';
  el.setAttribute('aria-label', 'Boneco');
  el.style.cssText =
    'width:22px;height:22px;border-radius:9999px;' +
    'background:radial-gradient(circle at 30% 30%,#ffd6df,#ff5a8a 60%,#7a3040);' +
    'border:3px solid #fff;box-shadow:0 6px 16px rgba(255,90,138,.45);' +
    'transform:translateY(-4px);pointer-events:none;';
  el.style.display = 'none';
  return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([0, 0]).addTo(map);
}

/** Monta CharacterLayer + marcador 2D. Idempotente (não duplica camada). */
function ensureCharacterLayer(
  map: maplibregl.Map,
  characterLayerRef: MutableRefObject<CharacterLayer | null>,
  characterMarkerRef: MutableRefObject<maplibregl.Marker | null>,
): void {
  if (!map.getLayer(CHARACTER_LAYER_ID)) {
    characterLayerRef.current = null;
  }
  if (!characterLayerRef.current) {
    const layer = new CharacterLayer({ debug: isCharacterDebugEnabled() });
    characterLayerRef.current = layer;
    map.addLayer(layer);
  }
  if (!characterMarkerRef.current) {
    characterMarkerRef.current = createCharacterHtmlMarker(map);
  }
  characterMarkerRef.current.getElement().style.display = 'block';
}

function removeCharacterLayer(
  map: maplibregl.Map,
  characterLayerRef: MutableRefObject<CharacterLayer | null>,
  characterMarkerRef: MutableRefObject<maplibregl.Marker | null>,
): void {
  if (characterLayerRef.current && map.getLayer(CHARACTER_LAYER_ID)) {
    map.removeLayer(CHARACTER_LAYER_ID);
  }
  characterLayerRef.current = null;
  characterMarkerRef.current?.remove();
  characterMarkerRef.current = null;
}

/** Posiciona boneco/marcador no progresso atual (útil logo após montar a camada). */
function seedCharacterPosition(
  route: OptimizedRoute,
  characterLayerRef: MutableRefObject<CharacterLayer | null>,
  characterMarkerRef: MutableRefObject<maplibregl.Marker | null>,
  cumulativeRef: MutableRefObject<CumulativeDistances | null>,
): void {
  const cumulative = cumulativeRef.current ?? computeCumulativeDistances(route.fullGeometry);
  cumulativeRef.current = cumulative;
  const progress = usePlayerStore.getState().progress;
  const speed = usePlayerStore.getState().speed;
  const playing = usePlayerStore.getState().playing;
  const mode = useRouteStore.getState().mode;
  const pos = interpolatePosition(route.fullGeometry, progress, cumulative);
  if (!pos) return;
  const motion = deriveCharacterMotion(mode, speed, playing);
  characterLayerRef.current?.update(
    pos.lng,
    pos.lat,
    pos.heading,
    Math.min(1, speed / 16),
    motion,
  );
  const marker = characterMarkerRef.current;
  if (marker) {
    marker.setLngLat([pos.lng, pos.lat]);
  }
}

export function MapView() {
  useLiveNavigation();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const characterMarkerRef = useRef<maplibregl.Marker | null>(null);
  const navMarkerRef = useRef<maplibregl.Marker | null>(null);
  const characterLayerRef = useRef<CharacterLayer | null>(null);
  const cumulativeRef = useRef<CumulativeDistances | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const lastAppliedRef = useRef<{
    lng: number;
    lat: number;
    bearing: number;
    pitch: number;
    zoom: number;
    progress?: number;
  } | null>(null);
  const gltfPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cesiumRef = useRef<CesiumPhotorealisticHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  /** Incrementado a cada style.load — setStyle remove custom layers (P1 do guia). */
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [gltfLoaded, setGltfLoaded] = useState(false);
  const [cesiumCharacterVisual, setCesiumCharacterVisual] = useState<'procedural' | 'gltf'>(
    'procedural',
  );

  const origin = useRouteStore((s) => s.origin);
  const destination = useRouteStore((s) => s.destination);
  const stops = useRouteStore((s) => s.stops);
  const route = useRouteStore((s) => s.route);
  const optimizedOrder = useRouteStore((s) => s.optimizedOrder);

  const cinema = usePlayerStore((s) => s.cinema);
  // playing/speed/cameraMode/zoomPreset: lidos via getState() no RAF (sem re-render).
  const realistic3D = usePlayerStore((s) => s.realistic3D);
  const realistic3DCamera = usePlayerStore((s) => s.realistic3DCamera);
  const cameraMode = usePlayerStore((s) => s.cameraMode);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const pause = usePlayerStore((s) => s.pause);
  const setCesiumTilesReady = usePlayerStore((s) => s.setCesiumTilesReady);
  const setCesiumRefinementProgress = usePlayerStore((s) => s.setCesiumRefinementProgress);

  const mapBaseStyle = useMapStore((s) => s.mapBaseStyle);
  const setMapCenter = useMapStore((s) => s.setCenter);
  const navActive = useNavigationStore((s) => s.active);
  const snappedPosition = useNavigationStore((s) => s.snappedPosition);
  const navHeading = useNavigationStore((s) => s.heading);

  const usePhotorealistic =
    cinema && realistic3D && hasGoogleMapsKey && Boolean(route);

  const useCesium3D =
    usePhotorealistic && realistic3DCamera === 'isometric';

  const useStreetView =
    usePhotorealistic && realistic3DCamera === 'first-person';

  useEffect(() => {
    if (!useCesium3D) {
      setCesiumTilesReady(true);
    }
  }, [useCesium3D, setCesiumTilesReady]);

  const orderedWaypoints = useMemo<OrderedWaypoint[]>(() => {
    const out: OrderedWaypoint[] = [];
    if (origin) out.push({ wp: origin, index: 0, kind: 'origin' });
    const list = optimizedOrder
      ? optimizedOrder.map((id) => stops.find((s) => s.id === id)).filter((s): s is Waypoint => !!s)
      : stops;
    list.forEach((s, i) => out.push({ wp: s, index: i + 1, kind: 'stop' }));
    if (destination) out.push({ wp: destination, index: out.length, kind: 'destination' });
    return out;
  }, [origin, destination, stops, optimizedOrder]);

  // ------------------------------------------------------------------
  // Setup do mapa (uma vez)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let styleFallbackApplied = false;
    let tileErrorCount = 0;

    const applyRasterFallback = (map: maplibregl.Map) => {
      if (styleFallbackApplied) return;
      styleFallbackApplied = true;
      // eslint-disable-next-line no-console
      console.warn('[DocitoMapas] estilo do mapa falhou — fallback OSM raster');
      map.setStyle(OSM_RASTER_STYLE);
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleForBase(useMapStore.getState().mapBaseStyle),
      center: [-46.6333, -23.5505],
      zoom: 4,
      attributionControl: { compact: true },
      // Necessário para MediaRecorder capturar o canvas WebGL na exportação.
      preserveDrawingBuffer: true,
    } as maplibregl.MapOptions);

    map.on('moveend', () => {
      const c = map.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left',
    );

    const onStyleReady = () => {
      ensureRouteLayers(map);
      map.resize();
      characterLayerRef.current = null;
      characterMarkerRef.current?.remove();
      characterMarkerRef.current = null;
      setMapReady(true);
      setStyleEpoch((e) => e + 1);

      const { cinema: inCinema, realistic3D: in3d } = usePlayerStore.getState();
      const currentRoute = useRouteStore.getState().route;
      const photorealistic =
        inCinema && in3d && hasGoogleMapsKey && Boolean(currentRoute);
      if (inCinema && currentRoute && !photorealistic) {
        ensureCharacterLayer(map, characterLayerRef, characterMarkerRef);
        seedCharacterPosition(
          currentRoute,
          characterLayerRef,
          characterMarkerRef,
          cumulativeRef,
        );
      }
    };

    map.on('error', (e) => {
      const err = e.error as Error | undefined;
      const msg = err?.message ?? String(e);
      tileErrorCount++;
      if (
        /null instead|openfreemap|style|glyph|sprite|tile/i.test(msg) ||
        tileErrorCount >= 4
      ) {
        applyRasterFallback(map);
      }
    });

    map.on('load', onStyleReady);
    map.on('style.load', onStyleReady);

    mapRef.current = map;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (gltfPollRef.current) clearInterval(gltfPollRef.current);
      map.remove();
      mapRef.current = null;
      characterLayerRef.current = null;
      characterMarkerRef.current = null;
      navMarkerRef.current?.remove();
      navMarkerRef.current = null;
      setMapReady(false);
      setStyleEpoch(0);
    };
  }, [setMapCenter]);

  // Troca estilo do mapa (estilizado / satélite / híbrido)
  const prevMapStyleRef = useRef(mapBaseStyle);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (prevMapStyleRef.current === mapBaseStyle) return;
    prevMapStyleRef.current = mapBaseStyle;
    map.setStyle(styleForBase(mapBaseStyle));
  }, [mapBaseStyle, mapReady]);

  // Marcador e câmera GPS (navegação ao vivo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (navActive && snappedPosition) {
      if (!navMarkerRef.current) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:18px;height:18px;border-radius:9999px;background:#3b82f6;' +
          'border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,.35);';
        navMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([snappedPosition.lng, snappedPosition.lat])
          .addTo(map);
      } else {
        navMarkerRef.current.setLngLat([snappedPosition.lng, snappedPosition.lat]);
      }
      if (!cinema) {
        map.easeTo({
          center: [snappedPosition.lng, snappedPosition.lat],
          bearing: navHeading,
          zoom: Math.max(map.getZoom(), 16),
          duration: 500,
        });
      }
    } else {
      navMarkerRef.current?.remove();
      navMarkerRef.current = null;
    }
  }, [navActive, snappedPosition, navHeading, mapReady, cinema]);

  // ------------------------------------------------------------------
  // Sincronizar rota como GeoJSON + pré-calcular cumulative
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (route) {
      src.setData({
        type: 'Feature',
        properties: {},
        geometry: route.fullGeometry,
      } as GeoJSON.Feature);
      cumulativeRef.current = computeCumulativeDistances(route.fullGeometry);
      if (!cinema) {
        const bounds = computeBoundsFromGeom(route.fullGeometry);
        if (bounds) map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 14 });
      }
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
      cumulativeRef.current = null;
    }
  }, [route, cinema, mapReady, styleEpoch]);

  // ------------------------------------------------------------------
  // Marcadores
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    orderedWaypoints.forEach((ow) => {
      const el = document.createElement('div');
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '50%';
      el.style.background = markerColor(ow.kind);
      el.style.color = 'white';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontWeight = '700';
      el.style.fontSize = '12px';
      el.style.boxShadow = '0 4px 10px rgba(191, 88, 132, 0.35)';
      el.style.border = '2px solid white';
      el.textContent =
        ow.kind === 'origin' ? 'A' : ow.kind === 'destination' ? 'B' : String(ow.index);
      el.title = ow.wp.address;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([ow.wp.location.lng, ow.wp.location.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (!route && orderedWaypoints.length > 0 && !cinema) {
      const first = orderedWaypoints[0];
      if (!first) return;
      let minLng = first.wp.location.lng;
      let minLat = first.wp.location.lat;
      let maxLng = first.wp.location.lng;
      let maxLat = first.wp.location.lat;
      for (const { wp } of orderedWaypoints) {
        minLng = Math.min(minLng, wp.location.lng);
        maxLng = Math.max(maxLng, wp.location.lng);
        minLat = Math.min(minLat, wp.location.lat);
        maxLat = Math.max(maxLat, wp.location.lat);
      }
      if (minLng === maxLng && minLat === maxLat) {
        map.easeTo({ center: [minLng, minLat], zoom: 12, duration: 600 });
      } else {
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 80, duration: 600, maxZoom: 12 },
        );
      }
    }
  }, [orderedWaypoints, route, cinema]);

  // ------------------------------------------------------------------
  // Adicionar/remover camada do personagem conforme cinema
  // (P0 docs: deps incluem mapReady — ref alone não dispara re-render)
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !route) return;

    if (cinema) {
      if (usePhotorealistic) {
        removeCharacterLayer(map, characterLayerRef, characterMarkerRef);
        return;
      }

      ensureCharacterLayer(map, characterLayerRef, characterMarkerRef);
      seedCharacterPosition(route, characterLayerRef, characterMarkerRef, cumulativeRef);
      setGltfLoaded(false);

      if (gltfPollRef.current) clearInterval(gltfPollRef.current);
      gltfPollRef.current = setInterval(() => {
        if (characterLayerRef.current?.isUsingGltf) {
          setGltfLoaded(true);
          if (gltfPollRef.current) clearInterval(gltfPollRef.current);
          gltfPollRef.current = null;
        }
      }, 250);
      const pollTimeout = setTimeout(() => {
        if (gltfPollRef.current) clearInterval(gltfPollRef.current);
        gltfPollRef.current = null;
      }, 6000);

      return () => {
        clearTimeout(pollTimeout);
        if (gltfPollRef.current) clearInterval(gltfPollRef.current);
        gltfPollRef.current = null;
      };
    }

    removeCharacterLayer(map, characterLayerRef, characterMarkerRef);
    setGltfLoaded(false);
  }, [cinema, route, mapReady, styleEpoch, usePhotorealistic]);

  // ------------------------------------------------------------------
  // Ao entrar no cinema: enquadrar rota uma vez (zoom livre depois)
  // ------------------------------------------------------------------
  const cinemaFramedRef = useRef(false);
  useEffect(() => {
    if (!cinema) {
      cinemaFramedRef.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map || !mapReady || !route || cinemaFramedRef.current || usePhotorealistic) return;
    cinemaFramedRef.current = true;
    const bounds = computeBoundsFromGeom(route.fullGeometry);
    if (bounds) {
      map.fitBounds(bounds, { padding: 80, duration: 600, maxZoom: 17 });
    }
  }, [cinema, route, mapReady, usePhotorealistic]);

  // Esconde MapLibre/Three.js enquanto Cesium está ativo (evita conflito WebGL).
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !cinema) return;

    if (usePhotorealistic) {
      removeCharacterLayer(map, characterLayerRef, characterMarkerRef);
      if (container) container.style.visibility = 'hidden';
    } else {
      if (container) container.style.visibility = 'visible';
      if (route && mapReady) {
        ensureCharacterLayer(map, characterLayerRef, characterMarkerRef);
        seedCharacterPosition(route, characterLayerRef, characterMarkerRef, cumulativeRef);
      }
    }
  }, [usePhotorealistic, cinema, route, mapReady]);

  // Redimensiona mapa ao alternar planner ↔ cinema (instância única).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(id);
  }, [cinema]);

  // Força reaplicar câmera ao trocar modo ou engine (MapLibre ↔ Cesium).
  useEffect(() => {
    if (!cinema) return;
    if (usePhotorealistic) {
      characterLayerRef.current?.setModelVisible(false);
    }
    lastAppliedRef.current = null;
  }, [cinema, cameraMode, realistic3D, usePhotorealistic]);

  // ------------------------------------------------------------------
  // RAF loop: avança progresso conforme playing + speed e reposiciona
  // câmera + personagem
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!cinema || !route) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const totalDurSec = route.totalDurationSeconds;
    const cumulative = cumulativeRef.current ?? computeCumulativeDistances(route.fullGeometry);
    cumulativeRef.current = cumulative;
    // Sempre que o RAF reinicia (mudou cameraMode/zoomPreset/etc), forçamos
    // reaplicar a câmera pelo menos 1x com o novo modo.
    lastAppliedRef.current = null;

    const step = (now: number) => {
      const last = lastFrameTimeRef.current || now;
      const dt = (now - last) / 1000;
      lastFrameTimeRef.current = now;

      const player = usePlayerStore.getState();
      const isPlaying = player.playing;
      const currentSpeed = player.speed;
      const currentCameraMode = player.cameraMode;
      const currentZoomPreset = player.zoomPreset;

      let currentProgress = player.progress;
      if (isPlaying) {
        // 1 unidade de progress = totalDurSec segundos em velocidade 1x
        currentProgress += (dt / totalDurSec) * currentSpeed;
        if (currentProgress >= 1) {
          currentProgress = 1;
          pause();
        }
        setProgress(currentProgress);
      }

      const pos = interpolatePosition(route.fullGeometry, currentProgress, cumulative);
      if (pos) {
        const cam = computeCinemaCamera(
          pos,
          currentCameraMode,
          map.getZoom(),
          realistic3D,
          currentZoomPreset,
        );

        if (!usePhotorealistic && currentCameraMode === 'follow') {
          const lastCam = lastAppliedRef.current;
          const changed =
            !lastCam ||
            Math.abs(lastCam.lng - cam.centerLng) > 1e-9 ||
            Math.abs(lastCam.lat - cam.centerLat) > 1e-9 ||
            Math.abs(lastCam.bearing - cam.bearing) > 0.01 ||
            Math.abs(lastCam.pitch - cam.pitch) > 0.01 ||
            Math.abs(lastCam.zoom - cam.zoom) > 0.01;
          if (changed) {
            lastAppliedRef.current = {
              lng: cam.centerLng,
              lat: cam.centerLat,
              bearing: cam.bearing,
              pitch: cam.pitch,
              zoom: cam.zoom,
            };
            map.jumpTo({
              center: [cam.centerLng, cam.centerLat],
              bearing: cam.bearing,
              pitch: cam.pitch,
              zoom: cam.zoom,
            });
          }
        } else if (useCesium3D) {
          const lastCam = lastAppliedRef.current;
          const seeked =
            !lastCam ||
            Math.abs((lastCam.progress ?? -1) - currentProgress) > 1e-9;
          if (isPlaying || seeked) {
            lastAppliedRef.current = {
              lng: cam.centerLng,
              lat: cam.centerLat,
              bearing: cam.bearing,
              pitch: cam.pitch,
              zoom: cam.zoom,
              progress: currentProgress,
            };
            const travelMode = useRouteStore.getState().mode;
            cesiumRef.current?.syncFrame({
              pos,
              cameraMode: 'free',
              realistic3D: true,
              currentMapZoom: map.getZoom(),
              motion: deriveCharacterMotion(travelMode, currentSpeed, isPlaying),
              playing: isPlaying,
            });
          }
        }

        if (!usePhotorealistic) {
          characterLayerRef.current?.update(
            pos.lng,
            pos.lat,
            pos.heading,
            Math.min(1, currentSpeed / 16),
            deriveCharacterMotion(useRouteStore.getState().mode, currentSpeed, isPlaying),
          );
          characterLayerRef.current?.setModelVisible(cam.modelVisible);
        }

        const marker = characterMarkerRef.current;
        if (marker && !usePhotorealistic) {
          marker.setLngLat([pos.lng, pos.lat]);
          const el = marker.getElement() as HTMLElement;
          el.style.display = 'block';
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameTimeRef.current = 0;
    };
  }, [cinema, route, realistic3D, setProgress, pause, usePhotorealistic, useCesium3D]);

  // Enquadrar toda a rota ao sair do modo cinema
  useEffect(() => {
    const map = mapRef.current;
    if (!map || cinema || !route) return;
    map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    const bounds = computeBoundsFromGeom(route.fullGeometry);
    if (bounds) map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 14 });
  }, [cinema, route]);

  // Seek externo (usuário arrasta slider enquanto parado): usa `store.subscribe`
  // em vez de subscription React, para NÃO re-renderizar o MapView.
  useEffect(() => {
    if (!cinema || !route) return;
    const unsub = usePlayerStore.subscribe((state, prev) => {
      if (state.playing) return; // durante play, o RAF cuida
      if (state.progress === prev.progress) return;
      const cumulative = cumulativeRef.current;
      if (!cumulative) return;
      const pos = interpolatePosition(route.fullGeometry, state.progress, cumulative);
      if (pos) {
        if (useCesium3D) {
          const travelMode = useRouteStore.getState().mode;
          cesiumRef.current?.syncFrame({
            pos,
            cameraMode: 'free',
            realistic3D: true,
            currentMapZoom: mapRef.current?.getZoom() ?? 17,
            motion: deriveCharacterMotion(travelMode, state.speed, false),
            playing: false,
          });
        } else if (!usePhotorealistic) {
          characterLayerRef.current?.update(
            pos.lng,
            pos.lat,
            pos.heading,
            Math.min(1, state.speed / 16),
            deriveCharacterMotion(useRouteStore.getState().mode, state.speed, false),
          );
        }
        characterMarkerRef.current?.setLngLat([pos.lng, pos.lat]);
      }
    });
    return unsub;
  }, [cinema, route, useCesium3D, usePhotorealistic]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className={
          usePhotorealistic
            ? 'pointer-events-none absolute inset-0 h-full w-full opacity-0'
            : 'h-full w-full'
        }
        aria-label="Mapa"
        role="region"
      />
      {cinema && hasGoogleMapsKey && route && (
        <CesiumErrorBoundary>
          <CesiumPhotorealisticView
            ref={cesiumRef}
            route={route}
            active={useCesium3D}
            onCharacterVisualChange={setCesiumCharacterVisual}
            onTilesReadyChange={setCesiumTilesReady}
            onRefinementProgressChange={setCesiumRefinementProgress}
          />
        </CesiumErrorBoundary>
      )}
      {cinema && route && useStreetView && (
        <StreetViewPane route={route} active={useStreetView} />
      )}
      {cinema && (
        <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          {usePhotorealistic && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/60 bg-sky-50/90 px-3 py-1 text-xs font-semibold text-sky-900 shadow-soft backdrop-blur">
              <span aria-hidden>{useStreetView ? '📷' : '🌍'}</span>
              {useStreetView ? 'Street View' : 'Google 3D'}
            </span>
          )}
          {useCesium3D && (
            <span
              className={
                'inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-xs font-semibold shadow-soft backdrop-blur ' +
                (cesiumCharacterVisual === 'gltf' ? 'text-primary' : 'text-muted-foreground')
              }
              title={
                cesiumCharacterVisual === 'gltf'
                  ? 'Modelo Mixamo (.glb) carregado'
                  : 'Boneco procedural candy'
              }
            >
              <span aria-hidden>{cesiumCharacterVisual === 'gltf' ? '✨' : '🍬'}</span>
              {cesiumCharacterVisual === 'gltf' ? 'Mixamo' : 'Modo doce'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
