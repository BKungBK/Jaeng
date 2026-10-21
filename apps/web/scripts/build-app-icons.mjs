// Draws the app icons (PWA manifest, home screen, later the Android launcher) with no image download:
// a cream ground, a soft yellow light beam rising from the pin, and a white disc ringed in Trust Blue
// at its top. Everything sits inside the central 80% so the maskable icon survives any mask.
// Run in the web container: docker compose exec -T web node scripts/build-app-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const OUT = fileURLToPath(new URL('../src/assets/icon/', import.meta.url));
const SS = 4; // supersampling per axis

const CREAM = [0xfb, 0xf7, 0xf2];
const BEAM = [0xf6, 0xd9, 0x83];
const WHITE = [0xff, 0xff, 0xff];
const BLUE = [0x3f, 0x6f, 0xa8];

/** The colour at a point of the 512-unit design; `k` shrinks the drawing toward the centre. */
function shade(x, y, k) {
  // design units, scaled around the centre
  const u = 256 + (x - 256) / k;
  const v = 256 + (y - 256) / k;
  const disc = { x: 256, y: 186, r: 74, ring: 13 };
  const d = Math.hypot(u - disc.x, v - disc.y);
  if (d <= disc.r - disc.ring) return WHITE;
  if (d <= disc.r) return BLUE;
  // the beam: a cone from the pin (256, 418) widening up to the disc, strongest at the bottom
  const top = disc.y;
  const foot = 418;
  if (v >= top && v <= foot) {
    const t = (foot - v) / (foot - top); // 0 at the pin, 1 at the disc
    const half = 10 + 62 * t;
    if (Math.abs(u - 256) <= half) return mix(BEAM, CREAM, 0.95 - 0.55 * t);
  }
  // the pin's foot: a small blue ellipse on the ground
  if (((u - 256) / 34) ** 2 + ((v - 424) / 9) ** 2 <= 1) return BLUE;
  return CREAM;
}

function mix(a, b, p) {
  return a.map((c, i) => c * p + b[i] * (1 - p));
}

/** The drawing at `size` px. `frac` is how much of the side the 512-unit design takes (the rest is ground);
 *  `ss` the supersampling per axis. */
function draw(size, k, { frac = 1, ss = SS } = {}) {
  const png = new PNG({ width: size, height: size });
  const unit = 512 / (size * frac);
  const origin = 256 - (size / 2) * unit; // design units at pixel 0
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade(origin + (px + (sx + 0.5) / ss) * unit, origin + (py + (sy + 0.5) / ss) * unit, k);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      const i = (size * py + px) * 4;
      png.data[i] = Math.round(acc[0] / ss / ss);
      png.data[i + 1] = Math.round(acc[1] / ss / ss);
      png.data[i + 2] = Math.round(acc[2] / ss / ss);
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

/** A flat colour, for the adaptive icon's background layer. */
function flat(size, [r, g, b]) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < size * size * 4; i += 4) png.data.set([r, g, b, 255], i);
  return PNG.sync.write(png);
}

for (const [name, size, k] of [
  ['app-192.png', 192, 1],
  ['app-512.png', 512, 1],
  ['app-maskable-512.png', 512, 0.86],
]) {
  writeFileSync(OUT + name, draw(size, k));
  console.log('wrote', name);
}

// The Android launcher and splash (plan 7) are generated from these by @capacitor/assets (build-apk.sh).
// The adaptive icon shows only the middle 61% of its foreground (66 of 108 dp), so the foreground is
// drawn small on the same cream as its background layer; the splash is the icon at 30% on cream.
const RES = fileURLToPath(new URL('../resources/', import.meta.url));
mkdirSync(RES, { recursive: true });
for (const [name, data] of [
  ['icon-only.png', draw(1024, 1)],
  ['icon-foreground.png', draw(1024, 0.6)],
  ['icon-background.png', flat(1024, CREAM)],
  ['splash.png', draw(2732, 1, { frac: 0.3, ss: 2 })],
]) {
  writeFileSync(RES + name, data);
  console.log('wrote resources/' + name);
}
