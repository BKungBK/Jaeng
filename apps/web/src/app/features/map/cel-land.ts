// Cel land (DESIGN.md "Cel map"): one flat colour per region (owner, 2026-10-17), faint ink lines
// between provinces, and a street map repainted in the same flat palette.
import type { FeatureCollection } from 'geojson';
import type { SeaTheme } from './sea/sea-palette';

/** The six geographic regions (National Research Council, 1977). */
export type Region = 'north' | 'isan' | 'central' | 'east' | 'west' | 'south';

/** One flat warm pastel per region, fixed in both themes. All sit lighter and greyer than the four
 *  level colours, so a beacon always stands out from the land under it. */
export const REGION_COLOURS: Record<Region, string> = {
  north: '#B7D7A0',
  isan: '#F5C7A1',
  central: '#F3E3B2',
  east: '#EFBCC6',
  west: '#CEC1E6',
  south: '#E9B9A2',
};

/** The map's outline colour: a warm cocoa, softer on pastels than the UI's slate ink. */
export const INK = '#6B5242';

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
      ? { ground: '#F4ECDC', park: '#D6E8BC', wood: '#C6DEAA', home: '#F3E6D4', building: '#FFF9F0', edge: INK, casing: INK, road: '#FFFFFF', minor: '#FFFFFF' }
      : { ground: '#33302B', park: '#3D4A34', wood: '#384530', home: '#3A3530', building: '#4A4340', edge: '#1A1612', casing: '#1A1612', road: '#D8CFC2', minor: '#968C80' };
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
