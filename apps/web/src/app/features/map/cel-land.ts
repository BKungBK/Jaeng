// Cel land (plan 2b, DESIGN.md "Cel map"): flat province fills in three tones per region, so
// neighbours never share a colour, and a street map repainted in the same flat palette.
import type { FeatureCollection } from 'geojson';
import type { SeaTheme } from './sea/sea-palette';

export type Region = 'north' | 'isan' | 'central' | 'south';

/** Three flat tones per region; Isan stays orange, the rest are greens. Fixed in both themes. */
export const REGION_TONES: Record<Region, readonly [string, string, string]> = {
  north: ['#6FAF3E', '#7DBE4A', '#8CC957'],
  isan: ['#EE9339', '#F5A04A', '#F8B061'],
  central: ['#8CC458', '#9BD067', '#ABDA7B'],
  south: ['#43A86D', '#4FB47A', '#60C089'],
};

export const INK = '#2B2A33';

export function provinceRegion(pcode: string): Region {
  const n = Number(pcode.slice(2));
  if (n >= 30 && n <= 49) return 'isan';
  if (n >= 50 && n <= 58) return 'north';
  if (n >= 80) return 'south';
  return 'central';
}

const pcodeOf = (f: FeatureCollection['features'][number]) => String(f.properties?.['pcode']);

/** Province pairs that share a border (at least two shared vertices), each as [lower, higher]. */
export function neighbours(provinces: FeatureCollection): [string, string][] {
  const byVertex = new Map<string, Set<string>>();
  for (const f of provinces.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const ring of polys.flat())
      for (const [x, y] of ring) {
        const key = `${x.toFixed(3)},${y.toFixed(3)}`;
        let set = byVertex.get(key);
        if (!set) byVertex.set(key, (set = new Set()));
        set.add(pcodeOf(f));
      }
  }
  const shared = new Map<string, number>();
  for (const set of byVertex.values()) {
    const ids = [...set].sort();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const k = `${ids[i]}|${ids[j]}`;
        shared.set(k, (shared.get(k) ?? 0) + 1);
      }
  }
  return [...shared]
    .filter(([, n]) => n >= 2)
    .map(([k]) => k.split('|') as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

/** A tone (0–2) per province: greedy colouring, busiest provinces first, so it never changes. */
export function provinceTones(provinces: FeatureCollection): Map<string, number> {
  const adj = new Map<string, Set<string>>(provinces.features.map((f) => [pcodeOf(f), new Set<string>()]));
  for (const [a, b] of neighbours(provinces)) {
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const order = [...adj.keys()].sort((a, b) => adj.get(b)!.size - adj.get(a)!.size || a.localeCompare(b));
  const tones = new Map<string, number>();
  for (const id of order) {
    const clashes = [0, 0, 0];
    for (const n of adj.get(id)!) {
      const t = tones.get(n);
      if (t !== undefined) clashes[t]++;
    }
    tones.set(id, clashes.indexOf(Math.min(...clashes)));
  }
  return new Map([...tones].sort(([a], [b]) => a.localeCompare(b)));
}

function lighten(hex: string, by: number): string {
  return (
    '#' +
    [1, 3, 5]
      .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * by))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** The provinces with `fill` (flat tone) and `hover` (one step lighter) colours for MapLibre. */
export function paintProvinces(provinces: FeatureCollection): FeatureCollection {
  const tones = provinceTones(provinces);
  return {
    ...provinces,
    features: provinces.features.map((f) => {
      const fill = REGION_TONES[provinceRegion(pcodeOf(f))][tones.get(pcodeOf(f)) ?? 0];
      return { ...f, properties: { ...f.properties, fill, hover: lighten(fill, 0.3) } };
    }),
  };
}

type Tint = [layer: string, property: string, value: string];

/** The street map (OpenFreeMap positron) in the cel palette: flat colours, ink road casings. */
export function baseTint(theme: SeaTheme, shallow: string): Tint[] {
  const c =
    theme === 'light'
      ? { ground: '#E4EDCC', park: '#BFE09A', wood: '#A9D483', home: '#EEEBD6', building: '#FFF8EC', edge: INK, casing: INK, road: '#FFFFFF', minor: '#FFFFFF' }
      : { ground: '#29321F', park: '#33502A', wood: '#2E4826', home: '#2F3328', building: '#3A3846', edge: '#0F0E14', casing: '#0F0E14', road: '#CFCBD6', minor: '#8E8A99' };
  return [
    ['background', 'background-color', c.ground],
    ['park', 'fill-color', c.park],
    ['landcover_wood', 'fill-color', c.wood],
    ['landuse_residential', 'fill-color', c.home],
    ['water', 'fill-color', shallow],
    ['waterway', 'line-color', shallow],
    ['building', 'fill-color', c.building],
    ['building', 'fill-outline-color', c.edge],
    ['highway_major_casing', 'line-color', c.casing],
    ['highway_motorway_casing', 'line-color', c.casing],
    ['highway_motorway_bridge_casing', 'line-color', c.casing],
    ['highway_major_inner', 'line-color', c.road],
    ['highway_motorway_inner', 'line-color', c.road],
    ['highway_motorway_bridge_inner', 'line-color', c.road],
    ['highway_minor', 'line-color', c.minor],
    ['highway_path', 'line-color', c.minor],
  ];
}
