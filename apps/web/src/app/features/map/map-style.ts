// MapLibre sources and layers for the toy map and reports (spec 4.4, DESIGN.md "Toy map").
import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, Map as MlMap } from 'maplibre-gl';
import { EmojiSlug, emojiUrl } from './emoji';
import { CLUSTER_MAX_ZOOM, TOY_FADE } from './toy';
import { LANDMARKS } from './toy-places';

export const REPORT_SOURCE = 'reports';

/** The slice of maplibregl.Map this module touches, so tests can pass a recorder. */
export type MapLike = Pick<MlMap, 'addSource' | 'addLayer' | 'getStyle' | 'setPaintProperty' | 'loadImage' | 'addImage' | 'hasImage'>;

export type ToyGeometry = { provinces: FeatureCollection; land: FeatureCollection; mask: FeatureCollection };

// Toy colours are fixed in both themes (DESIGN.md "The Toy Stays Toy Rule").
const TOY = {
  land: '#79B83C',
  isan: '#F5A04A',
  rim: '#F3E3B0',
  soil: ['#AB7B42', '#946636', '#7B5430'],
};

const fade = TOY_FADE as unknown as ExpressionSpecification;

/** The reports source the beacons read from. Added first: the data must not depend on decoration. */
export function setupReportLayers(map: MapLike): void {
  map.addSource(REPORT_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterRadius: 60,
    clusterProperties: { maxLevel: ['max', ['get', 'danger_level']] },
  });
  // MapLibre only loads tiles for a source some layer uses; beacons themselves are HTML markers.
  map.addLayer({
    id: 'reports-anchor',
    type: 'circle',
    source: REPORT_SOURCE,
    paint: { 'circle-radius': 1, 'circle-opacity': 0 },
  });
}

/** The toy Thailand, drawn under the reports anchor. Best effort: it is decoration. */
export async function setupToyLayers(map: MapLike, geo: ToyGeometry, sea = '#4FB3EA'): Promise<void> {
  map.addSource('toy-mask', { type: 'geojson', data: geo.mask });
  map.addSource('toy-land', { type: 'geojson', data: geo.land });
  map.addSource('toy-provinces', { type: 'geojson', data: geo.provinces });
  map.addSource('toy-landmarks', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: LANDMARKS.map((l) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: l.lngLat },
        properties: { slug: l.slug, size: l.size },
      })),
    },
  });

  map.addLayer({ id: 'toy-mask', type: 'fill', source: 'toy-mask', paint: { 'fill-color': sea, 'fill-opacity': fade } });
  for (const n of [3, 2, 1]) {
    map.addLayer({
      id: `toy-soil-${n}`,
      type: 'fill',
      source: 'toy-land',
      paint: {
        'fill-color': TOY.soil[n - 1],
        // full depth on the toy, flattening as it fades so the coast does not ghost at zoom 7
        'fill-translate': ['interpolate', ['linear'], ['zoom'], 6, ['literal', [0, n * 8]], 8, ['literal', [0, 0]]],
        'fill-opacity': fade,
      },
    });
  }
  map.addLayer({
    id: 'toy-land',
    type: 'fill',
    source: 'toy-provinces',
    paint: { 'fill-color': ['match', ['get', 'region'], 'isan', TOY.isan, TOY.land], 'fill-opacity': fade },
  });
  map.addLayer({
    id: 'toy-lines',
    type: 'line',
    source: 'toy-provinces',
    paint: { 'line-color': 'rgba(255,255,255,0.35)', 'line-width': 0.6, 'line-opacity': fade },
  });
  map.addLayer({
    id: 'toy-rim',
    type: 'line',
    source: 'toy-land',
    paint: { 'line-color': TOY.rim, 'line-width': 3, 'line-opacity': fade },
  });

  const slugs = [...new Set(LANDMARKS.map((l) => l.slug))];
  await Promise.all(slugs.map((slug) => addEmojiImage(map, slug)));
  map.addLayer({
    id: 'toy-landmarks',
    type: 'symbol',
    source: 'toy-landmarks',
    layout: {
      'icon-image': ['get', 'slug'],
      // 128 px images; size 1 ≈ 32 px at zoom 4, 51 px at zoom 6, 70 px at zoom 8
      'icon-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        ['*', 0.25, ['get', 'size']],
        6,
        ['*', 0.4, ['get', 'size']],
        8,
        ['*', 0.55, ['get', 'size']],
      ],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': fade },
  });
}


async function addEmojiImage(map: MapLike, slug: EmojiSlug) {
  if (map.hasImage(slug)) return;
  const { data } = await map.loadImage(emojiUrl(slug));
  if (!map.hasImage(slug)) map.addImage(slug, data);
}

/** Pull the OpenFreeMap positron base into the แจ้ง palette: sand land, misty water. */
export function tintBaseMap(map: MapLike): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#F3EBDD');
    else if (layer.type === 'fill' && layer.id.includes('water')) map.setPaintProperty(layer.id, 'fill-color', '#CFE3F0');
  }
}
