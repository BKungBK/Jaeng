import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const asset = (path: string) => resolve(process.cwd(), 'src/assets', path);
const json = (path: string) => JSON.parse(readFileSync(asset(path), 'utf8'));

describe('coast distance texture', () => {
  const grid = json('geo/coast-sdf.json');
  const png = PNG.sync.read(readFileSync(asset('geo/coast-sdf.png')));
  const mercX = (lng: number) => (lng + 180) / 360;
  const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
  const at = (lng: number, lat: number) => {
    const col = Math.floor(((mercX(lng) - grid.x0) / grid.size) * grid.px);
    const row = Math.floor(((mercY(lat) - grid.y0) / grid.size) * grid.px);
    const i = (row * png.width + col) * 4;
    return { r: png.data[i], b: png.data[i + 2] };
  };

  it('is a square texture matching its grid file', () => {
    expect([png.width, png.height]).toEqual([grid.px, grid.px]);
    expect(grid.maxKm).toBe(150);
  });

  it('is far from the coast in the middle of the Gulf of Thailand', () => {
    expect(at(101.0, 10.5).r).toBeGreaterThan(100);
  });

  it('is near zero just off the coast at Songkhla, and land is marked in blue', () => {
    expect(at(100.62, 7.25).r).toBeLessThan(20);
    expect(at(100.5, 13.75).b).toBe(255); // Bangkok
    expect(at(101.0, 10.5).b).toBe(0);
  });
});

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

  it('keeps a detailed mask (plan 2b: on at street zoom) under 400 KB', () => {
    expect(statSync(asset('geo/mask.json')).size).toBeLessThan(400 * 1024);
    expect(JSON.stringify(json('geo/mask.json')).match(/\[/g)!.length).toBeGreaterThan(5000);
  });
});
