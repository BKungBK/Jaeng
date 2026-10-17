// The sea's triangles: the mask polygon (world minus Thailand) cut with earcut, in Web Mercator.
import earcut from 'earcut';
import type { FeatureCollection, Polygon, Position } from 'geojson';

export const mercX = (lng: number) => (lng + 180) / 360;
export const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

/** Vertices are stored relative to this point (near Bangkok), so float32 keeps street-level
 *  precision; the layer adds it back in float64 when it builds the matrix. */
export const SEA_ANCHOR: [number, number] = [mercX(100.5), mercY(13.5)];

export type SeaMesh = { positions: Float32Array; indices: Uint32Array };

export function seaTriangles(mask: FeatureCollection): SeaMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const polygons: Position[][][] = mask.features.flatMap((f) =>
    f.geometry.type === 'Polygon'
      ? [(f.geometry as Polygon).coordinates]
      : f.geometry.type === 'MultiPolygon'
        ? f.geometry.coordinates
        : [],
  );
  for (const rings of polygons) {
    const flat: number[] = [];
    const holes: number[] = [];
    for (const [i, ring] of rings.entries()) {
      if (i > 0) holes.push(flat.length / 2);
      for (const [lng, lat] of ring) flat.push(mercX(lng) - SEA_ANCHOR[0], mercY(lat) - SEA_ANCHOR[1]);
    }
    const base = positions.length / 2;
    for (const i of earcut(flat, holes, 2)) indices.push(base + i);
    positions.push(...flat);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
