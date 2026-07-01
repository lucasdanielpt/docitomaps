import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import type { LineStringGeometry, Waypoint } from '@docitomapas/shared';
import { useRouteStore } from '@/stores/routeStore';
import { usePlayerStore, ZOOM_PRESETS } from '@/stores/playerStore';
import {
  computeCumulativeDistances,
  interpolatePosition,
  type CumulativeDistances,
} from '@/lib/geometry';
import { CharacterLayer } from '@/features/character/CharacterLayer';
import { OPENFREEMAP_STYLE_URL, OSM_RASTER_STYLE } from './mapStyle';

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

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const isLoadedRef = useRef(false);
  const characterLayerRef = useRef<CharacterLayer | null>(null);
  const cumulativeRef = useRef<CumulativeDistances | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const [gltfLoaded, setGltfLoaded] = useState(false);

  const origin = useRouteStore((s) => s.origin);
  const destination = useRouteStore((s) => s.destination);
  const stops = useRouteStore((s) => s.stops);
  const route = useRouteStore((s) => s.route);
  const optimizedOrder = useRouteStore((s) => s.optimizedOrder);

  const cinema = usePlayerStore((s) => s.cinema);
  const playing = usePlayerStore((s) => s.playing);
  const progress = usePlayerStore((s) => s.progress);
  const speed = usePlayerStore((s) => s.speed);
  const zoomPreset = usePlayerStore((s) => s.zoomPreset);
  const cameraMode = usePlayerStore((s) => s.cameraMode);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const pause = usePlayerStore((s) => s.pause);

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
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: [-46.6333, -23.5505],
      zoom: 4,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left',
    );

    map.on('error', (e) => {
      const err = e.error as Error | undefined;
      if (err && /openfreemap|style/i.test(err.message)) {
        try {
          map.setStyle(OSM_RASTER_STYLE);
        } catch {
          /* ignore */
        }
      }
    });

    map.on('load', () => {
      isLoadedRef.current = true;
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
      map.addSource(MARKERS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    });

    mapRef.current = map;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
      characterLayerRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  // Sincronizar rota como GeoJSON + pré-calcular cumulative
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
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
  }, [route, cinema]);

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
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current || !route) return;
    if (cinema) {
      if (!characterLayerRef.current) {
        const layer = new CharacterLayer();
        characterLayerRef.current = layer;
        map.addLayer(layer);
        setGltfLoaded(false);
        // Poll para descobrir quando o .glb entrou (se entrou).
        const poll = setInterval(() => {
          if (characterLayerRef.current?.isUsingGltf) {
            setGltfLoaded(true);
            clearInterval(poll);
          }
        }, 250);
        // Para de poll depois de 6s de qualquer forma
        setTimeout(() => clearInterval(poll), 6000);
      }
    } else {
      if (characterLayerRef.current && map.getLayer(CHARACTER_LAYER_ID)) {
        map.removeLayer(CHARACTER_LAYER_ID);
      }
      characterLayerRef.current = null;
      setGltfLoaded(false);
    }
  }, [cinema, route]);

  // ------------------------------------------------------------------
  // Aplicar zoom preset ao entrar em cinema ou trocar preset
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cinema) return;
    const preset = ZOOM_PRESETS[zoomPreset];
    map.easeTo({ zoom: preset.zoom, pitch: preset.pitch, duration: 600 });
  }, [cinema, zoomPreset]);

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

    const step = (now: number) => {
      const last = lastFrameTimeRef.current || now;
      const dt = (now - last) / 1000;
      lastFrameTimeRef.current = now;

      let currentProgress = usePlayerStore.getState().progress;
      if (usePlayerStore.getState().playing) {
        // 1 unidade de progress = totalDurSec segundos em velocidade 1x
        currentProgress += (dt / totalDurSec) * speed;
        if (currentProgress >= 1) {
          currentProgress = 1;
          pause();
        }
        setProgress(currentProgress);
      }

      const pos = interpolatePosition(route.fullGeometry, currentProgress, cumulative);
      if (pos) {
        const preset = ZOOM_PRESETS[zoomPreset];
        // Câmera segue o personagem
        const bearing =
          cameraMode === 'top-down' ? 0 : cameraMode === 'first-person' ? pos.heading : pos.heading;
        const pitch =
          cameraMode === 'top-down'
            ? 0
            : cameraMode === 'first-person'
              ? Math.min(80, preset.pitch + 10)
              : preset.pitch;
        map.jumpTo({ center: [pos.lng, pos.lat], bearing, pitch });

        // Update personagem
        characterLayerRef.current?.update(
          pos.lng,
          pos.lat,
          pos.heading,
          Math.min(1, speed / 16),
        );
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameTimeRef.current = 0;
    };
  }, [cinema, route, playing, speed, zoomPreset, cameraMode, setProgress, pause]);

  // Enquadrar toda a rota ao sair do modo cinema
  useEffect(() => {
    const map = mapRef.current;
    if (!map || cinema || !route) return;
    map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    const bounds = computeBoundsFromGeom(route.fullGeometry);
    if (bounds) map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 14 });
  }, [cinema, route]);

  // Também dispara um render quando progress é setado externamente (seek)
  useEffect(() => {
    if (!cinema || !route) return;
    const cumulative = cumulativeRef.current;
    if (!cumulative) return;
    const pos = interpolatePosition(route.fullGeometry, progress, cumulative);
    if (pos) {
      characterLayerRef.current?.update(pos.lng, pos.lat, pos.heading, Math.min(1, speed / 16));
    }
  }, [progress, cinema, route, speed]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="Mapa" role="region" />
      {cinema && (
        <div className="pointer-events-none absolute right-4 top-4 z-10">
          <span
            className={
              'inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-xs font-semibold shadow-soft backdrop-blur ' +
              (gltfLoaded ? 'text-primary' : 'text-muted-foreground')
            }
            title={
              gltfLoaded
                ? 'Modelo Mixamo (.glb) carregado'
                : 'Boneco procedural (adicione /models/character.glb)'
            }
          >
            <span aria-hidden>{gltfLoaded ? '✨' : '🍬'}</span>
            {gltfLoaded ? 'Mixamo' : 'Modo doce'}
          </span>
        </div>
      )}
    </div>
  );
}
