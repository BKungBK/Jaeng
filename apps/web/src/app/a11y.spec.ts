import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavController } from '@ionic/angular';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expectAccessiblePage } from './a11y.testing';
import { AuthService } from './core/auth.service';
import { DeviceService } from './core/device.service';
import { RealtimeService } from './core/realtime.service';
import { SupabaseService } from './core/supabase.service';
import { AboutPage } from './features/about/about.page';
import { LoginPage } from './features/auth/login.page';
import { ListPage } from './features/list/list.page';
import { ListService } from './features/list/list.service';
import { MeService } from './features/me/me.service';
import { MapReturnService } from './features/report-new/map-return.service';

const src = resolve(process.cwd(), 'src');

describe('index.html', () => {
  const html = readFileSync(join(src, 'index.html'), 'utf8');

  it('lets pages zoom (WCAG 1.4.4) and declares a language', () => {
    expect(html).not.toMatch(/maximum-scale/);
    expect(html).not.toMatch(/user-scalable\s*=\s*no/);
    expect(html).toMatch(/<html[^>]*\slang="th"/);
  });
});

// ---- contrast of the token pairs, read from tokens.scss as text ----
type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const lum = ([r, g, b]: Rgb) => {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mix = (c: string, w: string, p: number) => {
  const [a, b] = [hex(c), hex(w)];
  return '#' + a.map((v, i) => Math.round(v * p + b[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
};

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

describe('token contrast (WCAG AA)', () => {
  const scss = readFileSync(join(src, 'theme/tokens.scss'), 'utf8');
  const light = tokens(scss.slice(scss.indexOf(':root {'), scss.indexOf('@mixin dark-tokens')));
  const dark = { ...light, ...tokens(scss.slice(scss.indexOf('@mixin dark-tokens'), scss.indexOf('@media'))) };

  for (const [name, t] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`${name}: text pairs reach 4.5:1 and the focus ring 3:1`, () => {
      const pairs: [string, string, number][] = [
        ['ink', 'bg', 4.5],
        ['ink', 'surf', 4.5],
        ['ink2', 'bg', 4.5],
        ['ink2', 'surf', 4.5],
        ['onpri', 'pri', 4.5],
        ['pri', 'surf', 3],
        ['pri', 'bg', 3],
      ];
      const fails = pairs
        .map(([a, b, min]) => [`${a}/${b}`, +ratio(t[a], t[b]).toFixed(2), min] as const)
        .filter(([, r, min]) => r < min);
      expect(fails).toEqual([]);
    });
  }

  it('Slate Ink reads on every level colour mixed 55% into white (chips, pills), in both themes', () => {
    for (const level of ['s0', 's1', 's2', 's3']) {
      expect([level, ratio('#2b2a33', mix(light[level], '#ffffff', 0.55)) >= 4.5]).toEqual([level, true]);
    }
  });
});

// ---- pages: one h1, no unnamed button ----
describe('pages render accessibly', () => {
  const common = [
    provideRouter([]),
    { provide: MapReturnService, useValue: { go: vi.fn() } },
    { provide: AuthService, useValue: { signedIn: signal(false), profile: signal(null), ready: Promise.resolve() } },
    { provide: MeService, useValue: { setLocale: vi.fn() } },
  ];

  it('/about', async () => {
    TestBed.configureTestingModule({ providers: common });
    const f = TestBed.createComponent(AboutPage);
    f.detectChanges();
    await f.whenStable();
    expectAccessiblePage(f.nativeElement);
  });

  it('/list', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...common,
        { provide: ListService, useValue: { page: vi.fn().mockResolvedValue([]) } },
        { provide: DeviceService, useValue: { currentPosition: vi.fn() } },
        { provide: RealtimeService, useValue: { listen: () => () => undefined } },
      ],
    });
    const f = TestBed.createComponent(ListPage);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expectAccessiblePage(f.nativeElement);
  });

  it('/login', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...common,
        { provide: NavController, useValue: { navigateRoot: vi.fn() } },
        { provide: SupabaseService, useValue: { config: async () => ({ supabaseAnonKey: 'k', quickLogin: [] }) } },
      ],
    });
    const f = TestBed.createComponent(LoginPage);
    f.detectChanges();
    await f.whenStable();
    expectAccessiblePage(f.nativeElement);
  });
});

// ---- owner rule: motion never switches off for prefers-reduced-motion ----
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : files(p);
    return /\.(ts|html|scss|css)$/.test(name) ? [p] : [];
  });
}

describe('no prefers-reduced-motion', () => {
  it('appears nowhere in the web app or the shared package', () => {
    const shared = [resolve(process.cwd(), '../packages/shared'), resolve(process.cwd(), '../../packages/shared')].find(existsSync);
    const needle = ['prefers', 'reduced', 'motion'].join('-');
    const hits = [src, ...(shared ? [shared] : [])]
      .flatMap(files)
      .filter((f) => !f.endsWith('a11y.spec.ts'))
      .filter((f) => readFileSync(f, 'utf8').includes(needle));
    expect(hits).toEqual([]);
  }, 30_000);
});
