import type { StyleSpecification } from 'maplibre-gl';

/**
 * Estilo base do MapLibre usando OpenFreeMap (Positron).
 * 100% gratuito, sem chave, com atribuição © OpenStreetMap contributors.
 * https://openfreemap.org
 */
export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * Fallback simples (raster) caso OpenFreeMap fique indisponível.
 * Usa os tiles do OpenStreetMap Standard — respeitando os Tile Usage Policy.
 */
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
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};
