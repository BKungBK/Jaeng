import type { th } from './th';

export type Locale = 'th' | 'en';
export const LOCALES: readonly Locale[] = ['th', 'en'];

/** Each language named in itself, the same in both dictionaries ("ไทย" stays Thai on an English page). */
export const LOCALE_NAMES: Record<Locale, string> = { th: '\u0E44\u0E17\u0E22', en: 'English' };

export function isLocale(v: unknown): v is Locale {
  return v === 'th' || v === 'en';
}

/** 'a.b.c' for every string leaf of T. */
export type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** The Thai tree with every leaf widened to string: the shape every dictionary must have. */
export type Messages = Widen<typeof th>;

export type MessageKey = Leaves<typeof th>;

export type MessageParams = Record<string, string | number>;
