import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';

const web = process.cwd();
const read = (p: string) => readFileSync(resolve(web, p));

describe('web app manifest', () => {
  const manifest = JSON.parse(read('src/manifest.webmanifest').toString('utf8'));

  it('names the app, starts at / and stands alone', () => {
    expect(manifest).toMatchObject({
      name: 'แจ้ง',
      short_name: 'แจ้ง',
      lang: 'th',
      start_url: '/',
      display: 'standalone',
      background_color: '#0F1F44',
      theme_color: '#0F1F44',
    });
  });

  it('lists three icons that exist at their stated sizes, one maskable', () => {
    expect(manifest.icons).toHaveLength(3);
    for (const icon of manifest.icons) {
      const file = join('src', icon.src);
      expect(existsSync(resolve(web, file))).toBe(true);
      const png = PNG.sync.read(read(file));
      expect(`${png.width}x${png.height}`).toBe(icon.sizes);
    }
    expect(manifest.icons.filter((i: { purpose?: string }) => i.purpose === 'maskable')).toHaveLength(1);
  });
});

describe('app icon', () => {
  const png = PNG.sync.read(read('src/assets/icon/app-512.png'));
  const px = (x: number, y: number) => {
    const i = (png.width * y + x) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  const alpha = (x: number, y: number) => png.data[(png.width * y + x) * 4 + 3];
  const peach = (c: number[]) => c[0] > c[2] + 20 && c[0] > 170; // the dawn gradient
  const ink = (c: number[]) => c[0] < 90 && c[1] < 80 && c[2] < 80; // --dawn-ink, the lines
  const columnHasInk = (at: (x: number, y: number) => number[], x: number, size: number) => {
    for (let y = 0; y < size; y++) if (ink(at(x, y))) return true;
    return false;
  };

  it('is a round dawn-gradient disc with the signal drawn in ink (logo.svg)', () => {
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) expect(alpha(x, y)).toBe(0);
    expect(alpha(256, 2)).toBe(255); // the disc touches the top of the square
    expect(peach(px(256, 24))).toBe(true);
    expect(columnHasInk(px, 256, 512)).toBe(true);
  });

  it("keeps the signal inside the maskable icon's safe zone (the middle 80%)", () => {
    const mask = PNG.sync.read(read('src/assets/icon/app-maskable-512.png'));
    const at = (x: number, y: number) => [...mask.data.subarray((mask.width * y + x) * 4, (mask.width * y + x) * 4 + 3)];
    expect(columnHasInk(at, 256, 512)).toBe(true);
    // the outer 10% on every side is plain gradient: no line a mask could cut
    for (let t = 0; t < 512; t += 8) {
      for (const edge of [0, 25, 486, 511]) {
        expect(peach(at(t, edge))).toBe(true);
        expect(peach(at(edge, t))).toBe(true);
      }
    }
  });
});

describe('Android launcher resources (plan 7)', () => {
  const size = (file: string) => {
    const png = PNG.sync.read(read(file));
    return `${png.width}x${png.height}`;
  };

  it('has the icon layers and the splash for @capacitor/assets at their sizes', () => {
    expect(size('resources/icon-only.png')).toBe('1024x1024');
    expect(size('resources/icon-foreground.png')).toBe('1024x1024');
    expect(size('resources/icon-background.png')).toBe('1024x1024');
    expect(size('resources/splash.png')).toBe('2732x2732');
  });

  it('draws the splash as the signal on the dawn gradient: peach at the corner, ink lines down the middle', () => {
    const png = PNG.sync.read(read('resources/splash.png'));
    const px = (x: number, y: number) => [...png.data.subarray((png.width * y + x) * 4, (png.width * y + x) * 4 + 3)];
    const [r, , b] = px(0, 0);
    expect(r > b + 10).toBe(true);
    let inked = false;
    for (let y = 800; y < 1900 && !inked; y++) inked = px(1366, y)[0] < 90;
    expect(inked).toBe(true);
  });
});

describe('service worker', () => {
  it('stays off in the APK, where the page is local and the worker would cache a stale bundle', () => {
    const main = readFileSync(resolve(web, 'src/main.ts'), 'utf8');
    expect(main).toMatch(/enabled:[^,}]*platform\.isNative\(\)/);
    const angular = JSON.parse(read('angular.json').toString('utf8'));
    const android = angular.projects.app.architect.build.configurations.android;
    expect(android.serviceWorker).toBe(false);
    expect(android.outputPath.base).toBe('www-android');
  });
});

describe('ngsw-config.json', () => {
  const cfg = JSON.parse(read('ngsw-config.json').toString('utf8'));

  it('never caches API answers or photos, and leaves /api and /sb to the network', () => {
    expect(cfg.dataGroups).toBeUndefined();
    expect(cfg.navigationUrls).toEqual(expect.arrayContaining(['!/api/**', '!/sb/**']));
  });

  it('prefetches the app shell and lazy-loads the assets', () => {
    const app = cfg.assetGroups.find((g: { name: string }) => g.name === 'app');
    expect(app.installMode).toBe('prefetch');
    expect(app.resources.files).toEqual(expect.arrayContaining(['/index.html', '/manifest.webmanifest', '/*.css', '/*.js']));
    const assets = cfg.assetGroups.find((g: { name: string }) => g.name === 'assets');
    expect(assets.installMode).toBe('lazy');
  });
});
