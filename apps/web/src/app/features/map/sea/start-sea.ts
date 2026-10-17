// Puts the animated sea on the map, under the toy land, and keeps its colours on the page theme.
import type { FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';
import { SeaClock } from './sea-clock';
import { seaTriangles } from './sea-geometry';
import { LandSampler, SeaGrid, SeaLayer } from './sea-layer';
import { currentSeaTheme, SEA_HEX, seaPalette, SeaTheme, watchSeaTheme } from './sea-palette';

/** A 256² copy of the texture's land channel on the CPU. Smoothing while downsampling means a cell
 *  counts as land only when it is all land, so a bit of coast never reads as land. */
function landSampler(sdf: HTMLImageElement): LandSampler | undefined {
  const n = 256;
  const ctx = Object.assign(document.createElement('canvas'), { width: n, height: n }).getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined; // without it the sea simply always animates
  ctx.drawImage(sdf, 0, 0, n, n);
  const data = ctx.getImageData(0, 0, n, n).data;
  return (u, v) => data[(Math.min(n - 1, Math.floor(v * n)) * n + Math.min(n - 1, Math.floor(u * n))) * 4 + 2] > 250;
}

/** Returns a cleanup that stops the theme watcher (the layer itself goes with the map). */
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
  const layer = new SeaLayer(seaTriangles(mask), sdf, grid, seaPalette(currentSeaTheme()), new SeaClock(reducedMotion), landSampler(sdf));
  map.addLayer(layer, map.getLayer('sea-foam') ? 'sea-foam' : undefined);

  const apply = (t: SeaTheme) => {
    layer.setPalette(seaPalette(t));
    if (map.getLayer('sea-foam')) map.setPaintProperty('sea-foam', 'line-color', SEA_HEX[t].foam);
  };
  apply(currentSeaTheme());
  return watchSeaTheme(apply);
}
