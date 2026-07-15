import type { StyleSpecification } from 'maplibre-gl';
import type { MapBaseStyle } from '@/stores/mapStore';

/**
 * Estilo vetorial OpenFreeMap (Positron). Bonito, mas alguns tiles disparam
 * erros de propriedade nula no MapLibre — usamos como tentativa inicial.
 */
export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const ESRI_ATTRIBUTION =
  '© Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, Aerogrid, IGN, IGP';

/**
 * Carto Voyager @2x — raster de alta qualidade, sem chave.
 * Mantém legibilidade até zoom ~20 (overzoom no layer).
 */
export const CARTO_VOYAGER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
      tileSize: 512,
      attribution: '© OpenStreetMap © CARTO',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'carto-voyager',
      type: 'raster',
      source: 'carto',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

/** Satélite Esri World Imagery — sem chave de API. */
export const ESRI_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'esri-satellite',
      type: 'raster',
      source: 'esri',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

/**
 * Híbrido: imagem de satélite + rótulos/ruas (Esri Reference).
 * Visual próximo ao Google Maps híbrido.
 */
export const HYBRID_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
      maxzoom: 19,
    },
    labels: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'esri-satellite',
      type: 'raster',
      source: 'esri',
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: 'esri-labels',
      type: 'raster',
      source: 'labels',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

/** Fallback mínimo (OSM padrão) se Carto/OpenFreeMap falharem. */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

export const MAP_BASE_STYLE_OPTIONS: Array<{ value: MapBaseStyle; label: string }> = [
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'styled', label: 'Estilizado' },
];

export function styleForBase(base: MapBaseStyle): StyleSpecification {
  if (base === 'hybrid') return HYBRID_STYLE;
  return CARTO_VOYAGER_STYLE;
}

/** Zoom máximo da câmera no cinema — evita upscaling extremo de tiles raster. */
export const CINEMA_MAX_ZOOM = 19;
