// A polite OpenStreetMap Nominatim client (usage policy: one request per second, a real User-Agent,
// cache what you get). One queue for the whole server; null means "unavailable right now".
import type { Place } from '@jaeng/shared/places';

export type Geocoder = (q: string, lang: 'th' | 'en') => Promise<Place[] | null>;

type Opts = {
  baseUrl: string;
  contact: string;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  minGapMs?: number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMax?: number;
  /** requests allowed to wait behind the running one; past it the answer is null at once */
  maxWaiting?: number;
};

const FAIL_TTL_MS = 60_000;

type Row = { display_name?: unknown; lon?: unknown; lat?: unknown; boundingbox?: unknown };

const num = (v: unknown): number => (typeof v === 'string' || typeof v === 'number' ? Number(v) : NaN);

function toPlace(row: Row): Place | null {
  if (typeof row !== 'object' || row === null || typeof row.display_name !== 'string') return null;
  const lng = num(row.lon);
  const lat = num(row.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const [name, ...rest] = row.display_name.split(',').map((s) => s.trim());
  if (!name) return null;
  let bbox: Place['bbox'] = null;
  // Nominatim's order is south, north, west, east
  if (Array.isArray(row.boundingbox) && row.boundingbox.length === 4) {
    const [s, n, w, e] = row.boundingbox.map(num);
    if ([s, n, w, e].every(Number.isFinite)) bbox = [w, s, e, n];
  }
  return { name, detail: rest.length ? rest.join(', ') : null, lng, lat, bbox, source: 'osm' };
}

export function createNominatim(opts: Opts): Geocoder {
  const fetchFn = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const minGap = opts.minGapMs ?? 1100;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const ttl = opts.cacheTtlMs ?? 86_400_000;
  const cacheMax = opts.cacheMax ?? 500;
  const maxWaiting = opts.maxWaiting ?? 20;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const agent = `Jaeng/0.6 (+${opts.contact})`;

  const cache = new Map<string, { at: number; ttl: number; value: Place[] | null }>();
  const inflight = new Map<string, Promise<Place[] | null>>();
  let chain: Promise<unknown> = Promise.resolve();
  let last = -Infinity;
  let queued = 0;

  async function request(q: string, lang: 'th' | 'en'): Promise<Place[] | null> {
    const url = `${base}/search?format=jsonv2&countrycodes=th&limit=5&accept-language=${lang}&q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { headers: { 'User-Agent': agent, Accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      if (!Array.isArray(body)) return null;
      return body.map((r) => toPlace(r as Row)).filter((p): p is Place => p !== null);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function remember(key: string, value: Place[] | null) {
    cache.delete(key);
    cache.set(key, { at: now(), ttl: value === null ? FAIL_TTL_MS : ttl, value });
    while (cache.size > cacheMax) cache.delete(cache.keys().next().value as string);
  }

  return (raw, lang) => {
    const q = raw.trim();
    const key = `${lang}:${q.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.value);
    const pending = inflight.get(key);
    if (pending) return pending;
    if (queued > maxWaiting) return Promise.resolve(null);

    queued++;
    const run = chain.then(async () => {
      const wait = last + minGap - now();
      if (wait > 0) await sleep(wait);
      last = now();
      return request(q, lang);
    });
    chain = run.catch(() => undefined);
    const p = run.then((value) => {
      queued--;
      inflight.delete(key);
      remember(key, value);
      return value;
    });
    inflight.set(key, p);
    return p;
  };
}
