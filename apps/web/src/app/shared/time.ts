// Thai relative and absolute dates (spec 3.12). Plan 6 passes the locale in; Thai is fixed for now.

const relative = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' });

const STEPS: [limit: number, size: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [7 * 86400, 86400, 'day'],
  [30 * 86400, 7 * 86400, 'week'],
  [365 * 86400, 30 * 86400, 'month'],
  [Infinity, 365 * 86400, 'year'],
];

/** "เมื่อสักครู่", "5 นาทีที่แล้ว", "เมื่อวาน", "3 วันที่แล้ว". CLDR's Thai says "ที่ผ่านมา"; the spec
 *  and the app's casual voice say "ที่แล้ว", so the suffix is swapped. */
export function formatAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'เมื่อสักครู่';
  const [, size, unit] = STEPS.find(([limit]) => seconds < limit)!;
  return relative.format(-Math.floor(seconds / size), unit).replace(/ที่ผ่านมา$/, 'ที่แล้ว');
}

/** "17 ต.ค. 2569": the full date behind a relative time (its `title`). */
export function formatDate(iso: string): string {
  return absolute.format(new Date(iso));
}
