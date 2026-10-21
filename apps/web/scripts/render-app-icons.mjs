// Renders the app logo (resources/logo.svg) to every icon the app ships: the PWA icons, the favicon, the
// Android launcher layers and the splash. The logo has no text; a browser is used only to rasterise the SVG,
// through the Playwright in ../../e2e (plain JavaScript) and the Chrome of the machine.
//   node apps/web/scripts/render-app-icons.mjs          (from the repository root, on the Windows side)
// The logo is three groups: #ground (the dawn gradient, square), #disc (the same, round) and #symbol (the
// lines). Each image is some of them put together, the symbol scaled about the middle.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(here('../../../e2e/'));
const { chromium } = require('@playwright/test');

const ICONS = here('../src/assets/icon/');
const RES = here('../resources/');
mkdirSync(RES, { recursive: true });
const svg = readFileSync(RES + 'logo.svg', 'utf8');

// [file, size, groups, symbol scale]
const JOBS = [
  // the icons that may be any shape: the round logo on clear corners
  [ICONS + 'app-192.png', 192, ['disc', 'symbol'], 0.84],
  [ICONS + 'app-512.png', 512, ['disc', 'symbol'], 0.84],
  [ICONS + 'favicon.png', 64, ['disc', 'symbol'], 0.92],
  // the maskable icon: the whole square is ground, the symbol inside the safe zone (the middle 80%)
  [ICONS + 'app-maskable-512.png', 512, ['ground', 'symbol'], 0.7],
  [RES + 'icon-only.png', 1024, ['disc', 'symbol'], 0.84], // the legacy launcher icons are cut from this (round on a round launcher)
  // the adaptive icon shows the middle 61% of its foreground: the symbol is drawn smaller than that
  [RES + 'icon-foreground.png', 1024, ['symbol'], 0.62],
  [RES + 'icon-background.png', 1024, ['ground'], 1],
  // the splash: the gradient fills a big canvas, the symbol sits in the middle of it
  [RES + 'splash.png', 2732, ['ground', 'symbol'], 0.42],
  [RES + 'splash-dark.png', 2732, ['ground', 'symbol'], 0.42],
];

/** The page for one image. `canvas` is the side in design units (1024, or the splash's size). */
function page(canvas, px, groups, k) {
  let doc = svg.replace(/<svg [^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}" width="${px}" height="${px}">`);
  for (const id of ['ground', 'disc', 'symbol']) {
    if (groups.includes(id)) continue;
    doc = doc.replace(new RegExp(`<g id="${id}"[\\s\\S]*?</g>`), '');
  }
  doc = doc.replace('<rect width="1024" height="1024"', `<rect width="${canvas}" height="${canvas}"`);
  const mid = canvas / 2;
  doc = doc.replace(/transform="translate\([^"]*\)"/, `transform="translate(${mid} ${mid}) scale(${k}) translate(-512 -512)"`);
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${doc}`;
}

const browser = await chromium.launch({ channel: 'chrome' });
const tab = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [file, px, groups, k] of JOBS) {
  const canvas = px > 1024 ? px : 1024;
  await tab.setViewportSize({ width: px, height: px });
  await tab.setContent(page(canvas, px, groups, k));
  const png = await tab.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
  writeFileSync(file, png);
  console.log('wrote', file.replace(here('../'), ''));
}
await browser.close();
