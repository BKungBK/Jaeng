// Relative and absolute dates in the reader's language (spec 3.12). Thai unless asked otherwise.
import { en } from '../i18n/en';
import type { Locale } from '../i18n/keys';
import { th } from '../i18n/th';

const relative: Record<Locale, Intl.RelativeTimeFormat> = {
  th: new Intl.RelativeTimeFormat('th', { numeric: 'auto' }),
  en: new Intl.RelativeTimeFormat('en', { numeric: 'auto' }),
};
const absolute: Record<Locale, Intl.DateTimeFormat> = {
  th: new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' }),
  en: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
};
const JUST_NOW: Record<Locale, string> = { th: th.time.justNow, en: en.time.justNow };
// "ที่ผ่านมา" -> "ที่แล้ว", escaped so the dictionary stays the only Thai in app code
const CLDR_PAST_TH = /\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E32$/;
const CASUAL_PAST_TH = '\u0E17\u0E35\u0E48\u0E41\u0E25\u0E49\u0E27';

const STEPS: [limit: number, size: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [7 * 86400, 86400, 'day'],
  [30 * 86400, 7 * 86400, 'week'],
  [365 * 86400, 30 * 86400, 'month'],
  [Infinity, 365 * 86400, 'year'],
];

/** "เมื่อสักครู่", "5 นาทีที่แล้ว", "เมื่อวาน" / "just now", "5 minutes ago", "yesterday". CLDR's Thai
 *  says "ที่ผ่านมา"; the spec and the app's casual voice say "ที่แล้ว", so the suffix is swapped. */
export function formatAgo(iso: string, now = Date.now(), locale: Locale = 'th'): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (seconds < 60) return JUST_NOW[locale];
  const [, size, unit] = STEPS.find(([limit]) => seconds < limit)!;
  const text = relative[locale].format(-Math.floor(seconds / size), unit);
  return locale === 'th' ? text.replace(CLDR_PAST_TH, CASUAL_PAST_TH) : text;
}

/** "17 ต.ค. 2569" / "17 Oct 2026": the full date behind a relative time (its `title`). */
export function formatDate(iso: string, locale: Locale = 'th'): string {
  return absolute[locale].format(new Date(iso));
}
