import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';

export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_STORAGE_KEY = 'jaeng.theme';

/** The browser bar colour per theme: Cream Ground and the dark ground (tokens.scss --bg). */
export const THEME_COLOR = { light: '#FBF7F2', dark: '#23212B' } as const;

const isChoice = (v: unknown): v is ThemeChoice => v === 'system' || v === 'light' || v === 'dark';

/**
 * Light, dark or the system setting, kept on this device only (plan 6 decision 3). It sets
 * `data-theme` on <html>, which tokens.scss, the sea and the street map already follow; the
 * pre-boot script in index.html applies the stored choice before the first paint.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private media = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private readonly systemDark = signal(this.media?.matches ?? false);
  private readonly _choice = signal<ThemeChoice>('system');

  readonly choice = this._choice.asReadonly();
  /** follows the system setting live while the choice is 'system' */
  readonly effective = computed<'light' | 'dark'>(() => {
    const c = this._choice();
    return c === 'system' ? (this.systemDark() ? 'dark' : 'light') : c;
  });

  constructor() {
    this.media?.addEventListener?.('change', (e) => {
      this.systemDark.set(e.matches);
      this.paintMeta();
    });
    let stored: unknown = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // private mode: follow the system
    }
    this.apply(isChoice(stored) ? stored : 'system');
  }

  set(c: ThemeChoice): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, c);
    } catch {
      // the choice lasts for this visit only
    }
    this.apply(c);
  }

  private apply(c: ThemeChoice): void {
    this._choice.set(c);
    const root = this.doc.documentElement;
    if (c === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', c);
    this.paintMeta();
  }

  private paintMeta(): void {
    let meta = this.doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = this.doc.createElement('meta');
      meta.name = 'theme-color';
      this.doc.head.appendChild(meta);
    }
    meta.content = THEME_COLOR[this.effective()];
  }
}
