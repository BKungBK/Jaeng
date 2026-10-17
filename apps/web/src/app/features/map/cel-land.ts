// Cel land (DESIGN.md "Cel map"): one flat colour per region (owner, 2026-10-17), faint ink lines
// between provinces, and a street map repainted in the same flat palette.
import type { FeatureCollection } from 'geojson';
import type { SeaTheme } from './sea/sea-palette';

/** The six geographic regions (National Research Council, 1977). */
export type Region = 'north' | 'isan' | 'central' | 'east' | 'west' | 'south';

/** One flat colour per region, fixed in both themes. South is warm so the coast never melts into the sea. */
export const REGION_COLOURS: Record<Region, string> = {
  north: '#5DAA55',
  isan: '#F39C3C',
  central: '#F3CF55',
  east: '#E57A8C',
  west: '#9E86D6',
  south: '#D7684F',
};

export const INK = '#2B2A33';

const EAST = new Set([20, 21, 22, 23, 24, 25, 27]); // Chon Buri … Sa Kaeo
const WEST = new Set([63, 70, 71, 76, 77]); // Tak, Ratchaburi, Kanchanaburi, Phetchaburi, Prachuap

export function provinceRegion(pcode: string): Region {
  const n = Number(pcode.slice(2));
  if (n >= 30 && n <= 49) return 'isan';
  if (n >= 50 && n <= 58) return 'north';
  if (n >= 80) return 'south';
  if (EAST.has(n)) return 'east';
  if (WEST.has(n)) return 'west';
  return 'central';
}

const pcodeOf = (f: FeatureCollection['features'][number]) => String(f.properties?.['pcode']);

function lighten(hex: string, by: number): string {
  return (
    '#' +
    [1, 3, 5]
      .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * by))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** The provinces with `fill` (region colour) and `hover` (one step lighter) colours for MapLibre. */
export function paintProvinces(provinces: FeatureCollection): FeatureCollection {
  return {
    ...provinces,
    features: provinces.features.map((f) => {
      const fill = REGION_COLOURS[provinceRegion(pcodeOf(f))];
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
