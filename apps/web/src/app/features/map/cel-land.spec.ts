import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { baseTint, neighbours, paintProvinces, provinceRegion, provinceTones, REGION_TONES } from './cel-land';

const provinces = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/assets/geo/provinces.json'), 'utf8'),
) as FeatureCollection;

describe('provinceRegion', () => {
  it.each([
    ['TH10', 'central'],
    ['TH21', 'central'],
    ['TH30', 'isan'],
    ['TH49', 'isan'],
    ['TH50', 'north'],
    ['TH58', 'north'],
    ['TH83', 'south'],
    ['TH96', 'south'],
  ])('%s is %s', (pcode, region) => {
    expect(provinceRegion(pcode)).toBe(region);
  });
});

describe('provinceTones', () => {
  const tones = provinceTones(provinces);
  const pairs = neighbours(provinces);

  it('gives every province one of three tones, the same every time', () => {
    expect(tones.size).toBe(77);
    expect([...tones.values()].every((t) => t === 0 || t === 1 || t === 2)).toBe(true);
    expect(provinceTones(provinces)).toEqual(tones);
  });

  it('finds the borders between provinces', () => {
    expect(pairs.length).toBeGreaterThan(150);
    expect(pairs).toContainEqual(['TH10', 'TH12']); // Bangkok and Nonthaburi
  });

  it('colours neighbours differently almost everywhere', () => {
    const differ = pairs.filter(([a, b]) => tones.get(a) !== tones.get(b)).length;
    expect(differ / pairs.length).toBeGreaterThanOrEqual(0.9);
  });
});

describe('paintProvinces', () => {
  it('adds a flat fill and a lighter hover colour from the region tones', () => {
    const painted = paintProvinces(provinces);
    const bkk = painted.features.find((f) => f.properties!['pcode'] === 'TH10')!;
    const tone = provinceTones(provinces).get('TH10')!;
    expect(bkk.properties!['fill']).toBe(REGION_TONES.central[tone]);
    expect(bkk.properties!['hover']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(bkk.properties!['hover']).not.toBe(bkk.properties!['fill']);
  });
});

describe('baseTint', () => {
  it('paints the street map water in the sea shallows and roads with an ink casing', () => {
    const tint = baseTint('light', '#3FD6C8');
    expect(tint).toContainEqual(['water', 'fill-color', '#3FD6C8']);
    expect(tint.find(([id, prop]) => id === 'highway_major_casing' && prop === 'line-color')![2]).toBe('#2B2A33');
    expect(tint.find(([id]) => id === 'background')![2]).not.toBe(baseTint('dark', '#1F8A8C').find(([id]) => id === 'background')![2]);
  });
});
