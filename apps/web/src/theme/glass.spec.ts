import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const lum = ([r, g, b]: Rgb) => {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** `rgba` laid over an opaque backdrop */
const over = (c: [number, number, number, number], back: Rgb): Rgb => [0, 1, 2].map((i) => c[i] * c[3] + back[i] * (1 - c[3])) as Rgb;

const glass = read('src/theme/glass.scss');
const tokens = read('src/theme/tokens.scss');
const lightGlass = glass.slice(glass.indexOf(':root {'), glass.indexOf('@mixin dark-glass'));
const darkGlass = glass.slice(glass.indexOf('@mixin dark-glass'), glass.indexOf('@media'));
const lightTokens = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('@mixin dark-tokens'));
const darkTokens = tokens.slice(tokens.indexOf('@mixin dark-tokens'), tokens.indexOf('@media'));

const rgba = (block: string, name: string): [number, number, number, number] => {
  const m = block.match(new RegExp(`--${name}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`));
  if (!m) throw new Error(`no --${name} in the block`);
  return [+m[1], +m[2], +m[3], +m[4]];
};
/** a tier's tint: the dark block only restates what differs, so a missing one is the light value */
const tint = (block: string, name: string): [number, number, number, number] => {
  try {
    return rgba(block, name);
  } catch {
    return rgba(lightGlass, name);
  }
};
const colour = (block: string, name: string): Rgb => {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`no --${name} in the block`);
  return hex(m[1]);
};

// the brightest things a panel can sit over: white, the cream land, pale sea and green; in dark the
// brightest of them dimmed by --glass-dim (read from the file below, so changing the dim re-tests it)
const DIM = +darkGlass.match(/--glass-dim:\s*brightness\(([\d.]+)\)/)![1];
const BACKS: Record<'light' | 'dark', [string, Rgb][]> = {
  light: [
    ['white', [255, 255, 255]],
    ['land', hex('#f3ebdd')],
    ['sea', hex('#9fcfdd')],
    ['green', hex('#cfe3c4')],
  ],
  dark: [
    ['dimmed land', hex('#f3ebdd').map((v) => v * DIM) as Rgb],
    ['dimmed pale green', hex('#cfe3c4').map((v) => v * DIM) as Rgb],
    ['night', hex('#0f1f44')],
  ],
};

describe('glass (plan 8: warm frosted glass, grain only inside it)', () => {
  for (const theme of ['light', 'dark'] as const) {
    const g = theme === 'light' ? lightGlass : darkGlass;
    const t = theme === 'light' ? lightTokens : darkTokens;
    const ink = colour(t, 'ink');
    const ink2 = colour(t, 'ink2');

    it(`${theme}: ink and secondary ink reach 4.5:1 on every tier over the brightest backdrops`, () => {
      const fails: string[] = [];
      for (const tier of ['glass-bg', 'glass-bg-card', 'glass-bg-dense']) {
        for (const [name, back] of BACKS[theme]) {
          const panel = over(tint(g, tier), back);
          for (const [label, text] of [
            ['ink', ink],
            ['ink2', ink2],
          ] as const) {
            const r = ratio(text, panel);
            if (r < 4.5) fails.push(`${tier} over ${name}: ${label} ${r.toFixed(2)}`);
          }
        }
      }
      expect(fails).toEqual([]);
    });

    it(`${theme}: the warm inset and raised tones read: ink 4.5:1, secondary ink 4.5:1, the accent 3:1`, () => {
      const pri = colour(t, 'pri');
      const fails: string[] = [];
      for (const tone of ['warm-bg', 'warm-surf']) {
        const c = colour(g, tone);
        if (ratio(ink, c) < 4.5) fails.push(`${tone}: ink ${ratio(ink, c).toFixed(2)}`);
        if (ratio(ink2, c) < 4.5) fails.push(`${tone}: ink2 ${ratio(ink2, c).toFixed(2)}`);
        if (ratio(pri, c) < 3) fails.push(`${tone}: pri ${ratio(pri, c).toFixed(2)}`);
      }
      expect(fails).toEqual([]);
    });

    it(`${theme}: the cards inside glass (inset, raised) keep ink and the accent readable on every tier`, () => {
      const pri = colour(t, 'pri');
      const fails: string[] = [];
      for (const tier of ['glass-bg', 'glass-bg-card', 'glass-bg-dense']) {
        for (const [name, back] of BACKS[theme]) {
          const panel = over(tint(g, tier), back);
          for (const card of ['glass-inset', 'glass-raised']) {
            const c = over(rgba(g, card), panel);
            if (ratio(ink, c) < 4.5) fails.push(`${card} on ${tier} over ${name}: ink ${ratio(ink, c).toFixed(2)}`);
            if (ratio(ink2, c) < 4.5) fails.push(`${card} on ${tier} over ${name}: ink2 ${ratio(ink2, c).toFixed(2)}`);
            if (ratio(pri, c) < 3 && tier !== 'glass-bg') fails.push(`${card} on ${tier} over ${name}: pri ${ratio(pri, c).toFixed(2)}`);
          }
        }
      }
      expect(fails).toEqual([]);
    });

    it(`${theme}: nearly clear (the blur does the work): float 6–10%, card up to 12%, dense up to 20%, never thinner than the last; hover a little denser, not another colour`, () => {
      const [a, b, c] = ['glass-bg', 'glass-bg-card', 'glass-bg-dense'].map((n) => tint(g, n)[3]);
      expect(a).toBeGreaterThanOrEqual(0.06);
      expect(a).toBeLessThanOrEqual(0.1);
      expect(b).toBeGreaterThanOrEqual(a);
      expect(b).toBeLessThanOrEqual(0.12);
      expect(c).toBeGreaterThanOrEqual(b);
      expect(c).toBeLessThanOrEqual(0.2);
      const [ha, hb] = ['glass-bg-hover', 'glass-bg-card-hover'].map((n) => tint(g, n));
      expect(ha[3]).toBeGreaterThan(a);
      expect(ha[3]).toBeLessThanOrEqual(0.15);
      expect(hb[3]).toBeGreaterThan(b);
      expect(hb[3]).toBeLessThanOrEqual(0.15);
      expect(ha.slice(0, 3)).toEqual(tint(g, 'glass-bg').slice(0, 3));
    });
  }

  it('is warm white, not blue: red over blue in the tint of every tier, a blur of 16–20 px, the rim a thin light line', () => {
    for (const g of [lightGlass, darkGlass]) {
      for (const tier of ['glass-bg', 'glass-bg-card', 'glass-bg-dense']) {
        const [r, , b] = tint(g, tier);
        expect(r).toBeGreaterThan(b);
      }
    }
    const blur = +lightGlass.match(/--glass-blur:\s*(\d+)px/)![1];
    expect(blur).toBeGreaterThanOrEqual(16);
    expect(blur).toBeLessThanOrEqual(20);
    const rim = rgba(lightGlass, 'glass-rim');
    expect(rim[3]).toBeGreaterThanOrEqual(0.12);
    expect(rim[3]).toBeLessThanOrEqual(0.16);
    expect(glass).toMatch(/\.glass\s*\{[^}]*border:\s*1px solid var\(--glass-rim\)/s);
    expect(glass).toMatch(/--glass-shadow:\s*0 8px 32px rgba\(0, 0, 0, 0\.18\)/);
  });

  it('keeps the grain inside the glass: the .glass layer has it, the page and the map do not', () => {
    expect(glass).toMatch(/\.glass::after\s*\{[^}]*var\(--glass-grain\)/s);
    expect(read('src/app/shared/backdrop.component.ts')).not.toMatch(/var\(--noise/);
    expect(read('src/app/features/map/map.page.scss')).not.toMatch(/var\(--noise/);
  });

  it('gives glass and the overlays that open over it the warm tones instead of the page tokens', () => {
    // inside glass: lighter translucent cards
    const inside = glass.match(/\.glass,\s*ion-modal\.detail-sheet\s*\{([^}]*)\}/s);
    expect(inside).not.toBeNull();
    expect(inside![1]).toMatch(/--bg:\s*var\(--glass-inset\)/);
    expect(inside![1]).toMatch(/--surf:\s*var\(--glass-raised\)/);
    expect(inside![1]).toMatch(/--line:\s*var\(--warm-line\)/);
    // the overlays that open over it: solid warm tones
    const overlays = glass.match(/app-filters-panel,[^{]*\{([^}]*)\}/s);
    expect(overlays).not.toBeNull();
    for (const sel of ['ion-popover.account-menu', 'ion-popover.report-menu', 'ion-modal.login-sheet']) {
      expect(overlays![0], sel).toContain(sel);
    }
    expect(overlays![1]).toMatch(/--bg:\s*var\(--warm-bg\)/);
    expect(overlays![1]).toMatch(/--surf:\s*var\(--warm-surf\)/);
    expect(overlays![1]).toMatch(/--line:\s*var\(--warm-line\)/);
  });

  it('has a light-theme grain that is dark and a dark-theme grain that is light', () => {
    expect(lightGlass).toMatch(/--glass-grain:\s*var\(--noise-warm\)/);
    expect(darkGlass).toMatch(/--glass-grain:\s*var\(--noise\)/);
  });

  it('has no neon: the accent gradient stays muted (no channel at full strength) and the sheen is faint', () => {
    const dawn = lightGlass.match(/--dawn:\s*linear-gradient\(([^;]+)\);/)![1];
    for (const h of dawn.match(/#[0-9a-fA-F]{6}/g)!) {
      const [r, g, b] = hex(h);
      expect(Math.max(r, g, b) - Math.min(r, g, b), h).toBeLessThan(80); // low saturation: sand, clay, mauve-taupe
    }
    for (const g of [lightGlass, darkGlass]) {
      const sheen = g.match(/--glass-sheen:[^;]*rgba\([^)]*,\s*([\d.]+)\)/)!;
      expect(+sheen[1]).toBeLessThanOrEqual(0.2);
    }
  });

  it('keeps the edge a thin, low-opacity line', () => {
    for (const g of [lightGlass, darkGlass]) {
      expect(rgba(g, 'glass-edge')[3]).toBeLessThanOrEqual(0.6);
    }
  });
});
