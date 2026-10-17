import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const asset = (path: string) => resolve(process.cwd(), 'src/assets', path);
const json = (path: string) => JSON.parse(readFileSync(asset(path), 'utf8'));

describe('toy map geometry', () => {
  it('has 77 provinces with Thai names and 20 in Isan', () => {
    const provinces = json('geo/provinces.json');
    expect(provinces.features).toHaveLength(77);
    expect(provinces.features.every((f: any) => typeof f.properties.name_th === 'string')).toBe(true);
    expect(provinces.features.filter((f: any) => f.properties.region === 'isan')).toHaveLength(20);
  });

  it('keeps the province file small', () => {
    expect(statSync(asset('geo/provinces.json')).size).toBeLessThan(400 * 1024);
  });

  it('has one dissolved land shape', () => {
    expect(json('geo/land.json').features).toHaveLength(1);
  });

  it('has a world mask with Thailand cut out', () => {
    const mask = json('geo/mask.json');
    expect(mask.features).toHaveLength(1);
    const g = mask.features[0].geometry;
    const rings = g.type === 'Polygon' ? g.coordinates.length : g.coordinates.reduce((n: number, p: unknown[]) => n + p.length, 0);
    expect(rings).toBeGreaterThan(1);
  });
});
