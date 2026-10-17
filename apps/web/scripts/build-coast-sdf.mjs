// Builds the coast distance texture the sea shader reads (plan 2b, Task 6).
//   node scripts/build-coast-sdf.mjs   (in the web container; input scripts/data/land-wide.json)
// Output: src/assets/geo/coast-sdf.png  R = distance from Thailand's coast, 0 at the coast and on
//         land, 255 at MAX_KM or more; G unused (0; the shader makes its own noise); B = 255 on land.
//         src/assets/geo/coast-sdf.json  the grid the shader needs to sample it.
// The grid is square in Web Mercator, so the texture lines up with the map without reprojection.
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const SIZE = 2048;
const BOUNDS = [90, -1, 113, 27]; // west, south, east, north: Thailand plus the seas around it
const MAX_KM = 150;
const EARTH_KM = 40075.016686;

const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
const latOf = (y) => (360 / Math.PI) * Math.atan(Math.exp(Math.PI * (1 - 2 * y))) - 90;

const [x0, x1] = [mercX(BOUNDS[0]), mercX(BOUNDS[2])];
const [y0, y1] = [mercY(BOUNDS[3]), mercY(BOUNDS[1])]; // y grows southwards
const side = Math.max(x1 - x0, y1 - y0);
const grid = { x0, y0, size: side, px: SIZE, maxKm: MAX_KM }; // square cells
const cell = side / SIZE;

// 1. Rasterise land with an even-odd scanline fill in grid pixels.
const land = JSON.parse(readFileSync(new URL('./data/land-wide.json', import.meta.url), 'utf8'));
const rings = land.features.flatMap((f) =>
  (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).flat(),
);
const edges = rings.flatMap((ring) =>
  ring.slice(1).map((b, i) => {
    const a = ring[i];
    return [(mercX(a[0]) - x0) / cell, (mercY(a[1]) - y0) / cell, (mercX(b[0]) - x0) / cell, (mercY(b[1]) - y0) / cell];
  }),
);
const isLand = new Uint8Array(SIZE * SIZE);
for (let row = 0; row < SIZE; row++) {
  const y = row + 0.5;
  const xs = [];
  for (const [ax, ay, bx, by] of edges) {
    if (ay <= y !== by <= y) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const from = Math.max(0, Math.ceil(xs[k] - 0.5));
    const to = Math.min(SIZE - 1, Math.floor(xs[k + 1] - 0.5));
    for (let col = from; col <= to; col++) isLand[row * SIZE + col] = 1;
  }
}

// 2. Exact Euclidean distance transform (Felzenszwalb & Huttenlocher), in pixels.
const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    do {
      const r = v[k];
      s = (f[q] + q * q - (f[r] + r * r)) / (2 * q - 2 * r);
    } while (s <= z[k] && --k >= 0);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    d[q] = (q - r) * (q - r) + f[r];
  }
}
const dist2 = new Float64Array(SIZE * SIZE);
for (let i = 0; i < dist2.length; i++) dist2[i] = isLand[i] ? 0 : INF;
const f = new Float64Array(SIZE);
const d = new Float64Array(SIZE);
const v = new Int32Array(SIZE);
const z = new Float64Array(SIZE + 1);
for (let col = 0; col < SIZE; col++) {
  for (let row = 0; row < SIZE; row++) f[row] = dist2[row * SIZE + col];
  edt1d(f, SIZE, d, v, z);
  for (let row = 0; row < SIZE; row++) dist2[row * SIZE + col] = d[row];
}
for (let row = 0; row < SIZE; row++) {
  for (let col = 0; col < SIZE; col++) f[col] = dist2[row * SIZE + col];
  edt1d(f, SIZE, d, v, z);
  for (let col = 0; col < SIZE; col++) dist2[row * SIZE + col] = d[col];
}

// 3. Encode.
const png = new PNG({ width: SIZE, height: SIZE, colorType: 2 });
for (let row = 0; row < SIZE; row++) {
  const kmPerPx = cell * EARTH_KM * Math.cos((latOf(y0 + (row + 0.5) * cell) * Math.PI) / 180);
  for (let col = 0; col < SIZE; col++) {
    const i = row * SIZE + col;
    const km = Math.sqrt(dist2[i]) * kmPerPx;
    const p = i * 4;
    png.data[p] = Math.round(Math.min(1, km / MAX_KM) * 255);
    png.data[p + 1] = 0;
    png.data[p + 2] = isLand[i] ? 255 : 0;
    png.data[p + 3] = 255;
  }
}
const out = new URL('../src/assets/geo/', import.meta.url);
writeFileSync(new URL('coast-sdf.png', out), PNG.sync.write(png, { colorType: 2 }));
writeFileSync(new URL('coast-sdf.json', out), JSON.stringify(grid) + '\n');
console.log(`coast-sdf.png ${SIZE}² written; land pixels ${isLand.reduce((s, x) => s + x, 0)}`);
