import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import type { LineStringGeometry, Waypoint } from '@docitomapas/shared';
import { useRouteStore } from '@/stores/routeStore';
import { OPENFREEMAP_STYLE_URL, OSM_RASTER_STYLE } from './mapStyle';

const ROUTE_SOURCE_ID = 'route-source';
const ROUTE_LAYER_ID = 'route-line';
const ROUTE_CASING_ID = 'route-casing';
const MARKERS_SOURCE_ID = 'markers-source';

interface OrderedWaypoint {
  wp: Waypoint;
  index: number; // 0 = origem, últimos = destino
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

  const origin = useRouteStore((s) => s.origin);
  const destination = useRouteStore((s) => s.destination);
  const stops = useRouteStore((s) => s.stops);
  const route = useRouteStore((s) => s.route);
  const optimizedOrder = useRouteStore((s) => s.optimizedOrder);

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: [-46.6333, -23.5505], // São Paulo (default)
      zoom: 4,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left',
    );

    // fallback caso OpenFreeMap falhe
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
        paint: {
          'line-color': '#ffffff',
          'line-width': 9,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': 'oklch(0.68 0.22 355)',
          'line-width': 5,
        },
      });
      map.addSource(MARKERS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    };
  }, []);

  // Sincronizar rota como GeoJSON
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
      const bounds = computeBoundsFromGeom(route.fullGeometry);
      if (bounds) {
        map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 14 });
      }
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [route]);

  // Renderizar marcadores
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    orderedWaypoints.forEach((ow) => {
      const el = document.createElement('div');
      el.className = 'dm-marker';
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
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.35)';
      el.style.border = '2px solid white';
      el.textContent =
        ow.kind === 'origin' ? 'A' : ow.kind === 'destination' ? 'B' : String(ow.index);
      el.title = ow.wp.address;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([ow.wp.location.lng, ow.wp.location.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Se não há rota, ainda faz um enquadramento pelos pontos
    if (!route && orderedWaypoints.length > 0) {
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
  }, [orderedWaypoints, route]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Mapa" role="region" />;
}
