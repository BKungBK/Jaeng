import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import { en } from '../i18n/en';
import { isLocale, type Locale, type MessageKey, type MessageParams } from '../i18n/keys';
import { th } from '../i18n/th';
import { formatAgo, formatDate } from '../shared/time';

export const LOCALE_STORAGE_KEY = 'jaeng.locale';

type Tree = { readonly [k: string]: string | Tree };

function flatten(o: Tree, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out.set(prefix + k, v);
    else flatten(v, `${prefix}${k}.`, out);
  }
  return out;
}

const DICTS: Record<Locale, Map<string, string>> = { th: flatten(th), en: flatten(en as Tree) };

/** An error that carries its own wording in both languages (ApiError, PhotoTooLargeError). */
function bilingual(e: unknown): e is { messageTh: string; messageEn: string } {
  if (typeof e !== 'object' || e === null) return false;
  const m = e as { messageTh?: unknown; messageEn?: unknown };
  return typeof m.messageTh === 'string' && typeof m.messageEn === 'string';
}

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * The reader's language (spec 3.12). Thai unless this device chose otherwise, then a signed-in
 * profile's choice. Everything the app words reads `locale`, so a switch repaints in place.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private doc = inject(DOCUMENT);
  private readonly _locale = signal<Locale>('th');
  private readonly _chosen = signal(false);
  private readonly watchers = new Set<(l: Locale) => void>();

  readonly locale = this._locale.asReadonly();
  /** true once the reader (or a signed-in profile) chose; false = the 'th' default */
  readonly chosen = this._chosen.asReadonly();

  constructor() {
    const stored = readStored();
    if (stored) {
      this._locale.set(stored);
      this._chosen.set(true);
    }
    this.applyDocument();
  }

  t(key: MessageKey, params?: MessageParams): string {
    const s = DICTS[this._locale()].get(key) ?? key;
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  }

  setLocale(l: Locale): void {
    this._chosen.set(true);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      // private mode: the choice lasts for this visit only
    }
    this.apply(l);
  }

  adoptProfileLocale(l: Locale): void {
    if (this._chosen() || !isLocale(l)) return;
    this._chosen.set(true);
    this.apply(l);
  }

  errorText(e: unknown): string {
    if (bilingual(e)) return this._locale() === 'en' ? e.messageEn : e.messageTh;
    return this.t('errors.internal');
  }

  levelName(l: DangerLevel): string {
    const info = LEVELS[l];
    return this._locale() === 'en' ? info.nameEn : info.nameTh;
  }

  ago(iso: string, now?: number): string {
    return formatAgo(iso, now, this._locale());
  }

  date(iso: string): string {
    return formatDate(iso, this._locale());
  }

  /** For code outside Angular views (beacons, MapLibre): called on every change; returns a stop. */
  watch(fn: (l: Locale) => void): () => void {
    this.watchers.add(fn);
    return () => this.watchers.delete(fn);
  }

  private apply(l: Locale): void {
    if (l === this._locale()) return;
    this._locale.set(l);
    this.applyDocument();
    for (const fn of [...this.watchers]) fn(l);
  }

  private applyDocument(): void {
    this.doc.documentElement.lang = this._locale();
    this.doc.title = this.t('app.title');
  }
}
