// MapLibre sources and layers for the toy map and reports (spec 4.4, DESIGN.md "Cel map").
import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, Map as MlMap } from 'maplibre-gl';
import { baseTint, INK, paintProvinces } from './cel-land';
import { addStickerImage, ImageLoader } from './icons';
import type { SeaTheme } from './sea/sea-palette';
import { CLUSTER_MAX_ZOOM, LANDMARK_PX, STICKER_PX, TOY_FADE } from './toy';
import { LANDMARKS } from './toy-places';

export const REPORT_SOURCE = 'reports';

/** The slice of maplibregl.Map this module touches, so tests can pass a recorder. */
export type MapLike = Pick<
  MlMap,
  'addSource' | 'addLayer' | 'getStyle' | 'setPaintProperty' | 'setLayerZoomRange' | 'loadImage' | 'addImage' | 'hasImage'
>;

export type ToyGeometry = { provinces: FeatureCollection; land: FeatureCollection; mask: FeatureCollection };

// Toy colours are fixed in both themes (DESIGN.md "The Toy Stays Toy Rule").
const TOY = {
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
export async function setupToyLayers(map: MapLike, geo: ToyGeometry, sea = '#4FB3EA', load?: ImageLoader): Promise<void> {
  map.addSource('toy-mask', { type: 'geojson', data: geo.mask });
  map.addSource('toy-land', { type: 'geojson', data: geo.land });
  map.addSource('toy-provinces', { type: 'geojson', data: paintProvinces(geo.provinces), promoteId: 'pcode' });
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

  // opaque at every zoom: outside Thailand there is only sea (plan 2b). Added after every base
  // layer, so it also covers the street map's names abroad.
  map.addLayer({ id: 'toy-mask', type: 'fill', source: 'toy-mask', paint: { 'fill-color': sea, 'fill-opacity': 1 } });
  // the animated sea (SeaLayer) slots in here, between the flat mask and this foam line
  // street-zoom foam along the mask's exact edge; the shader's own foam is too coarse past zoom 9
  map.addLayer({
    id: 'sea-foam',
    type: 'line',
    source: 'toy-mask',
    minzoom: 8,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#FFFFFF',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 14, 5],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 10, 1],
    },
  });
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
    // flat cel tones per province, one step lighter under the pointer (feature-state 'hover')
    paint: {
      'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], ['get', 'hover'], ['get', 'fill']],
      'fill-opacity': fade,
    },
  });
  map.addLayer({
    id: 'toy-lines',
    type: 'line',
    source: 'toy-provinces',
    // faint ink between provinces: 30% of the toy fade (MapLibre only takes zoom at the top level)
    paint: { 'line-color': INK, 'line-width': 0.6, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.3, 8, 0] },
  });
  // sand beach between the land and the foam, then the ink outline that makes it read as cel
  map.addLayer({
    id: 'toy-rim',
    type: 'line',
    source: 'toy-land',
    paint: { 'line-color': TOY.rim, 'line-width': 6, 'line-opacity': fade },
  });
  map.addLayer({
    id: 'toy-ink',
    type: 'line',
    source: 'toy-land',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': INK,
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 7, 3],
      'line-opacity': fade,
    },
  });

  const slugs = [...new Set(LANDMARKS.map((l) => l.slug))];
  await Promise.all(slugs.map((slug) => addStickerImage(map, slug, STICKER_PX, load)));
  map.addLayer({
    id: 'toy-landmarks',
    type: 'symbol',
    source: 'toy-landmarks',
    layout: {
      'icon-image': ['get', 'slug'],
      // STICKER_PX images scaled to landmarkPx(zoom) × size
      'icon-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        ...LANDMARK_PX.flatMap(([z, px]) => [z, ['*', px / STICKER_PX, ['get', 'size']]]),
      ] as unknown as ExpressionSpecification,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': fade },
  });
}


/** Repaint the OpenFreeMap positron base in the cel palette for the theme; water takes the sea's
 *  shallow colour so the gap between the mask and the real coast reads as shallows. */
export function tintBaseMap(map: MapLike, theme: SeaTheme, shallow: string): void {
  const ids = new Set((map.getStyle().layers ?? []).map((l) => l.id));
  for (const [id, prop, value] of baseTint(theme, shallow)) if (ids.has(id)) map.setPaintProperty(id, prop, value);
}

/** The street map's place names wait until the toy names have gone (zoom 7.5), so the two never double. */
export function holdBaseLabels(map: MapLike): void {
  for (const layer of map.getStyle().layers ?? [])
    if (layer.type === 'symbol' && layer.id.startsWith('label_')) map.setLayerZoomRange(layer.id, 7.5, 24);
}
