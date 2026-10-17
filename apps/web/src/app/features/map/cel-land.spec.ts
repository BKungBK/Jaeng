import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { baseTint, INK, paintProvinces, provinceRegion, REGION_COLOURS } from './cel-land';

const provinces = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/assets/geo/provinces.json'), 'utf8'),
) as FeatureCollection;

describe('provinceRegion', () => {
  it.each([
    ['TH10', 'central'],
    ['TH65', 'central'],
    ['TH20', 'east'],
    ['TH27', 'east'],
    ['TH63', 'west'],
    ['TH71', 'west'],
    ['TH77', 'west'],
    ['TH30', 'isan'],
    ['TH49', 'isan'],
    ['TH50', 'north'],
    ['TH58', 'north'],
    ['TH83', 'south'],
    ['TH96', 'south'],
  ])('%s is %s', (pcode, region) => {
    expect(provinceRegion(pcode)).toBe(region);
  });

  it('splits the 77 provinces into the six regions', () => {
    const count: Record<string, number> = {};
    for (const f of provinces.features) {
      const r = provinceRegion(String(f.properties!['pcode']));
      count[r] = (count[r] ?? 0) + 1;
    }
    expect(count).toEqual({ north: 9, isan: 20, central: 22, east: 7, west: 5, south: 14 });
  });

  it('gives every region its own colour', () => {
    expect(new Set(Object.values(REGION_COLOURS)).size).toBe(6);
  });
});

describe('paintProvinces', () => {
  it('fills each province in its region colour, lighter on hover', () => {
    const painted = paintProvinces(provinces);
    const bkk = painted.features.find((f) => f.properties!['pcode'] === 'TH10')!;
    expect(bkk.properties!['fill']).toBe(REGION_COLOURS.central);
    expect(bkk.properties!['hover']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(bkk.properties!['hover']).not.toBe(bkk.properties!['fill']);
  });
});

describe('baseTint', () => {
  it('paints the street map water in the sea shallows and roads with an ink casing', () => {
    const tint = baseTint('light', '#3FD6C8');
    expect(tint).toContainEqual(['water', 'fill-color', '#3FD6C8']);
    expect(tint.find(([id, prop]) => id === 'highway_major_casing' && prop === 'line-color')![2]).toBe(INK);
    expect(tint.find(([id]) => id === 'background')![2]).not.toBe(baseTint('dark', '#1F8A8C').find(([id]) => id === 'background')![2]);
  });
});
