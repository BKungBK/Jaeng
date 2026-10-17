import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { SEA_FRAME_MS, SeaClock } from './sea-clock';
import { SEA_ANCHOR, seaTriangles } from './sea-geometry';
import { seaPalette } from './sea-palette';
import { seaFoamFade, seaInView } from './sea-layer';

const mask = JSON.parse(readFileSync(resolve(process.cwd(), 'src/assets/geo/mask.json'), 'utf8')) as FeatureCollection;

describe('seaTriangles', () => {
  const mesh = seaTriangles(mask);

  it('cuts the mask into triangles', () => {
    expect(mesh.indices.length).toBeGreaterThan(1000);
    expect(mesh.indices.length % 3).toBe(0);
    expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 2);
  });

  it('keeps every vertex inside the world once the anchor is added back', () => {
    for (let i = 0; i < mesh.positions.length; i += 2) {
      const x = mesh.positions[i] + SEA_ANCHOR[0];
      const y = mesh.positions[i + 1] + SEA_ANCHOR[1];
      expect(x >= -1e-6 && x <= 1 + 1e-6 && y >= -1e-6 && y <= 1 + 1e-6).toBe(true);
    }
  });

  it('covers no more than the world: triangle areas add up to under the whole square', () => {
    let area = 0;
    const p = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = [mesh.indices[i] * 2, mesh.indices[i + 1] * 2, mesh.indices[i + 2] * 2];
      area += Math.abs((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (p[b + 1] - p[a + 1])) / 2;
    }
    expect(area).toBeGreaterThan(0.9);
    expect(area).toBeLessThan(1);
  });
});

describe('seaPalette', () => {
  it('is darker in the dark theme for every colour', () => {
    const [light, dark] = [seaPalette('light'), seaPalette('dark')];
    for (const key of Object.keys(light) as (keyof typeof light)[]) {
      const sum = (c: number[]) => c.reduce((s, x) => s + x, 0);
      expect(sum(dark[key])).toBeLessThan(sum(light[key]));
    }
  });

  it('goes from mint shallows to a periwinkle deep', () => {
    const p = seaPalette('light');
    expect(p.shallow[1]).toBeGreaterThan(p.deep[1]); // greener
    expect(p.deep[2]).toBeGreaterThan(p.deep[0]); // blue
  });
});

describe('seaInView', () => {
  // a 4×4 mask: land (true) on the left half, sea on the right
  const land = (u: number) => u < 0.5;
  const sampler = (u: number, _v: number) => land(u);

  it('is true when any part of the view is sea', () => {
    expect(seaInView(sampler, [0.3, 0.2, 0.6, 0.4])).toBe(true);
  });

  it('is false when the whole view is land', () => {
    expect(seaInView(sampler, [0.1, 0.2, 0.4, 0.4])).toBe(false);
  });

  it('counts anything outside the texture as sea', () => {
    expect(seaInView(sampler, [-0.2, 0.2, 0.1, 0.4])).toBe(true);
  });
});

describe('seaFoamFade', () => {
  it('is full to zoom 8 and gone by zoom 10', () => {
    expect([7, 8, 9, 10, 12].map(seaFoamFade)).toEqual([1, 1, 0.5, 0, 0]);
  });
});

describe('SeaClock', () => {
  it('freezes time and never asks for frames under reduced motion', () => {
    let t = 1000;
    const clock = new SeaClock(true, () => t);
    const first = clock.time();
    t = 9000;
    expect(clock.time()).toBe(first);
    expect(clock.nextFrameIn(false)).toBeNull();
  });

  it('caps the animation at 60 frames a second and stops while hidden', () => {
    let t = 1000;
    const clock = new SeaClock(false, () => t);
    expect(clock.nextFrameIn(false)).toBe(0);
    clock.drew();
    t += 10;
    expect(clock.nextFrameIn(false)).toBeCloseTo(SEA_FRAME_MS - 10);
    t += 100;
    expect(clock.nextFrameIn(false)).toBe(0);
    expect(clock.nextFrameIn(true)).toBeNull();
  });
});
