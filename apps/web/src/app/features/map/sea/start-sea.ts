// Puts the animated sea on the map, under the toy land, and keeps its colours on the page theme.
import type { FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';
import { SeaClock } from './sea-clock';
import { seaTriangles } from './sea-geometry';
import { SeaGrid, SeaLayer } from './sea-layer';
import { currentSeaTheme, SEA_HEX, seaPalette } from './sea-palette';

/** Returns a cleanup that stops the theme watchers (the layer itself goes with the map). */
export async function startSea(map: maplibregl.Map, mask: FeatureCollection, reducedMotion: boolean): Promise<() => void> {
  const [grid, sdf] = await Promise.all([
    fetch('assets/geo/coast-sdf.json').then((r) => {
      if (!r.ok) throw new Error(`coast-sdf.json ${r.status}`);
      return r.json() as Promise<SeaGrid>;
    }),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('coast-sdf.png'));
      img.src = 'assets/geo/coast-sdf.png';
    }),
  ]);
  const theme = currentSeaTheme();
  const layer = new SeaLayer(seaTriangles(mask), sdf, grid, seaPalette(theme), new SeaClock(reducedMotion));
  map.addLayer(layer, map.getLayer('sea-foam') ? 'sea-foam' : undefined);

  const apply = () => {
    const t = currentSeaTheme();
    layer.setPalette(seaPalette(t));
    if (map.getLayer('sea-foam')) map.setPaintProperty('sea-foam', 'line-color', SEA_HEX[t].foam);
  };
  apply();
  const media = matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', apply);
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media.removeEventListener('change', apply);
    observer.disconnect();
  };
}
