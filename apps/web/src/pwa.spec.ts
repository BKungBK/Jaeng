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
  const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 8);

  it('is cream at the corner, white inside the disc, and keeps the disc inside the safe zone', () => {
    expect(near(px(0, 0), [0xfb, 0xf7, 0xf2])).toBe(true);
    const disc = [256, 180] as const;
    expect(near(px(disc[0], disc[1]), [0xff, 0xff, 0xff])).toBe(true);
    // outside the central 80% (the maskable safe zone) there is no Trust Blue
    const blue = [0x3f, 0x6f, 0xa8];
    for (let x = 0; x < 512; x += 8) {
      for (const y of [0, 20, 40, 491, 511]) expect(near(px(x, y), blue)).toBe(false);
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

  it('draws the splash as the icon on cream: cream at the corner, the white disc in the middle', () => {
    const png = PNG.sync.read(read('resources/splash.png'));
    const px = (x: number, y: number) => [...png.data.subarray((png.width * y + x) * 4, (png.width * y + x) * 4 + 3)];
    expect(px(0, 0)).toEqual([0xfb, 0xf7, 0xf2]);
    // the disc centre is at design (256, 186): 30% of the side, 256 units = the middle
    const scale = (2732 * 0.3) / 512;
    expect(px(1366, Math.round(1366 + (186 - 256) * scale))).toEqual([0xff, 0xff, 0xff]);
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
