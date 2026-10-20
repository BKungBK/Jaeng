// Draws the app icons (PWA manifest, home screen, later the Android launcher) with no image download:
// a cream ground, a soft yellow light beam rising from the pin, and a white disc ringed in Trust Blue
// at its top. Everything sits inside the central 80% so the maskable icon survives any mask.
// Run in the web container: docker compose exec -T web node scripts/build-app-icons.mjs
import { writeFileSync } from 'node:fs';
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

function draw(size, k) {
  const png = new PNG({ width: size, height: size });
  const unit = 512 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((px + (sx + 0.5) / SS) * unit, (py + (sy + 0.5) / SS) * unit, k);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      const i = (size * py + px) * 4;
      png.data[i] = Math.round(acc[0] / SS / SS);
      png.data[i + 1] = Math.round(acc[1] / SS / SS);
      png.data[i + 2] = Math.round(acc[2] / SS / SS);
      png.data[i + 3] = 255;
    }
  }
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
