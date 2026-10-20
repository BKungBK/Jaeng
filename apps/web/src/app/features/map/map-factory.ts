import { InjectionToken } from '@angular/core';
import { THAILAND_BBOX } from '@jaeng/shared/report';
import type maplibregl from 'maplibre-gl';

export const POSITRON_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Thailand's extent, used for the opening view. */
export const THAILAND_BOUNDS: [number, number, number, number] = [...THAILAND_BBOX];

/** Where the camera centre may go: Thailand plus sea on every side (plan 2b: only Thailand shows).
 *  A centre clamp, not maxBounds: maxBounds keeps the whole viewport inside, which on a wide
 *  screen forces a zoom too close to see the whole country. The mask hides the rest of the world. */
export const MAP_BOUNDS: [number, number, number, number] = [95.5, 3.5, 107.5, 22.5];

export function clampCenter([lng, lat]: [number, number]): [number, number] {
  const [w, s, e, n] = MAP_BOUNDS;
  return [Math.min(e, Math.max(w, lng)), Math.min(n, Math.max(s, lat))];
}

/** `padding`: room kept around Thailand in the opening view. Left out, the home map's own room for
 *  its floating cards; a small map inside a card (the report flow's pin map) passes a few pixels. */
export type MapOptions = { padding?: number };
export type MapFactory = (container: HTMLElement, options?: MapOptions) => maplibregl.Map | Promise<maplibregl.Map>;

// keep Thailand clear of the brand card and chips (two rows tall on phones) and, on phones, of
// the hint card at the bottom
export const fitPadding = (width: number, padding?: number) =>
  padding !== undefined
    ? padding
    : width < 820
      ? { top: 160, bottom: 116, left: 24, right: 24 }
      : { top: 84, bottom: 24, left: 24, right: 24 };

/** Never zoom out past the whole country: the floor is the zoom that fits Thailand, a little looser. */
export function lockToThailand(map: maplibregl.Map, padding?: number): void {
  const update = () => {
    const camera = map.cameraForBounds(THAILAND_BOUNDS, { padding: fitPadding(map.getContainer().clientWidth, padding) });
    if (camera?.zoom !== undefined) map.setMinZoom(Math.max(0, camera.zoom - 0.3));
  };
  update();
  map.on('resize', update);
  map.on('move', () => {
    const c = map.getCenter();
    // a map too small for its padding reports a NaN centre; setting it would fire `move` again forever
    if (!Number.isFinite(c.lng) || !Number.isFinite(c.lat)) return;
    const [lng, lat] = clampCenter([c.lng, c.lat]);
    if (lng !== c.lng || lat !== c.lat) map.setCenter([lng, lat]);
  });
}

/** Creates the map; a token so tests can swap in a stand-in. MapLibre is imported lazily
 *  because it cannot load without WebGL (jsdom), and it keeps the first bundle small. */
export const MAP_FACTORY = new InjectionToken<MapFactory>('MAP_FACTORY', {
  providedIn: 'root',
  factory: () => async (container, options) => {
    const { default: maplibregl } = await import('maplibre-gl');
    const map = new maplibregl.Map({
      container,
      style: POSITRON_URL,
      bounds: THAILAND_BOUNDS,
      fitBoundsOptions: { padding: fitPadding(container.clientWidth, options?.padding) },
      maxZoom: 18,
      attributionControl: { compact: true, customAttribution: 'OCHA COD-AB · Lucide (ISC)' },
    });
    lockToThailand(map, options?.padding);
    return map;
  },
});
