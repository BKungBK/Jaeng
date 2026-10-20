import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { currentSeaTheme } from '../features/map/sea/sea-palette';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

type Listener = (e: { matches: boolean }) => void;

function fakeMedia(dark: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => mql as unknown as MediaQueryList);
  return {
    flip(to: boolean) {
      mql.matches = to;
      for (const fn of listeners) fn({ matches: to });
    },
  };
}

const root = () => document.documentElement;
const meta = () => document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;

function make() {
  TestBed.resetTestingModule();
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    root().removeAttribute('data-theme');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    root().removeAttribute('data-theme');
  });

  it('follows the system by default and sets no data-theme', () => {
    fakeMedia(false);
    const s = make();
    expect(s.choice()).toBe('system');
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(s.effective()).toBe('light');
  });

  it('forces dark, stores it and paints the browser bar', () => {
    fakeMedia(false);
    const s = make();
    s.set('dark');
    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(s.effective()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(meta()).toBe('#23212B');
  });

  it('removes the attribute again for system', () => {
    fakeMedia(false);
    const s = make();
    s.set('light');
    s.set('system');
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(meta()).toBe('#FBF7F2');
  });

  it('follows a live system switch while on system', () => {
    const media = fakeMedia(false);
    const s = make();
    media.flip(true);
    expect(s.effective()).toBe('dark');
    expect(meta()).toBe('#23212B');
  });

  it('starts from the stored choice', () => {
    fakeMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(make().choice()).toBe('dark');
  });

  it('survives a storage that throws', () => {
    fakeMedia(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const s = make();
    expect(() => s.set('dark')).not.toThrow();
    expect(s.effective()).toBe('dark');
  });

  it('drives the sea theme for all three choices', () => {
    fakeMedia(true);
    const s = make();
    s.set('light');
    expect(currentSeaTheme()).toBe('light');
    s.set('dark');
    expect(currentSeaTheme()).toBe('dark');
    s.set('system');
    expect(currentSeaTheme()).toBe('dark');
  });
});

describe('pre-boot script in index.html', () => {
  const html = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8');
  const code = /<script data-boot>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

  function boot(stored: Record<string, string>) {
    const doc = document.implementation.createHTMLDocument('x');
    doc.head.innerHTML = '<meta name="theme-color" content="#FBF7F2">';
    const storage = { getItem: (k: string) => stored[k] ?? null };
    new Function('localStorage', 'document', code)(storage, doc);
    return doc.documentElement;
  }

  it('sits in <head> before any stylesheet', () => {
    expect(code).not.toBe('');
    expect(html.indexOf('<script data-boot>')).toBeLessThan(html.indexOf('</head>'));
    expect(html).toMatch(/<meta name="theme-color" content="#FBF7F2"/);
  });

  it('applies a stored dark theme and English', () => {
    const el = boot({ 'jaeng.theme': 'dark', 'jaeng.locale': 'en' });
    expect(el.getAttribute('data-theme')).toBe('dark');
    expect(el.lang).toBe('en');
    expect(el.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#23212B');
  });

  it('ignores junk values', () => {
    const el = boot({ 'jaeng.theme': 'purple', 'jaeng.locale': 'fr' });
    expect(el.hasAttribute('data-theme')).toBe(false);
    expect(el.lang).toBe('');
  });

  it('survives a storage that throws', () => {
    const doc = document.implementation.createHTMLDocument('x');
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => new Function('localStorage', 'document', code)(storage, doc)).not.toThrow();
  });
});
