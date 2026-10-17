import { InjectionToken } from '@angular/core';
import type maplibregl from 'maplibre-gl';

export const POSITRON_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Thailand's extent, used for the opening view. */
export const THAILAND_BOUNDS: [number, number, number, number] = [97.3, 5.6, 105.7, 20.5];

export type MapFactory = (container: HTMLElement) => maplibregl.Map | Promise<maplibregl.Map>;

/** Creates the map; a token so tests can swap in a stand-in. MapLibre is imported lazily
 *  because it cannot load without WebGL (jsdom), and it keeps the first bundle small. */
export const MAP_FACTORY = new InjectionToken<MapFactory>('MAP_FACTORY', {
  providedIn: 'root',
  factory: () => async (container) => {
    const { default: maplibregl } = await import('maplibre-gl');
    const map = new maplibregl.Map({
      container,
      style: POSITRON_URL,
      bounds: THAILAND_BOUNDS,
      // keep Thailand clear of the brand card and chips (two rows tall on phones) and, on
      // phones, of the hint card at the bottom
      fitBoundsOptions: {
        padding: container.clientWidth < 820 ? { top: 160, bottom: 116, left: 24, right: 24 } : { top: 84, bottom: 24, left: 24, right: 24 },
      },
      minZoom: 2,
      maxZoom: 18,
      attributionControl: { compact: true, customAttribution: 'OCHA COD-AB · Lucide (ISC)' },
    });
    map.on('style.load', () => map.setProjection({ type: 'globe' }));
    return map;
  },
});
