import { PLACE_QUERY_MAX, PLACE_QUERY_MIN, type Place, type PlacesAnswer } from '@jaeng/shared/places';
import { Elysia } from 'elysia';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';

const LOCAL_MAX = 5;
const TOTAL_MAX = 8;
const DEADLINE_MS = 3500;

const sameName = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** The geocoder's answer, or null once the deadline passes (the queued call still finishes and fills the cache). */
function withDeadline(p: Promise<Place[] | null>, ms: number): Promise<Place[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((r) => (timer = setTimeout(() => r(null), ms)));
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/**
 * The place finder: open to everyone, read only. Our districts always; OpenStreetMap only with
 * `more=1`, which the web sends on an explicit "search more places" (the OSM policy forbids
 * auto-complete on the public Nominatim).
 */
export function placeRoutes(deps: AppDeps) {
  return new Elysia().get('/places', async ({ query }): Promise<PlacesAnswer> => {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const len = [...q].length;
    if (len < PLACE_QUERY_MIN || len > PLACE_QUERY_MAX) throw new ApiError('invalid_request');
    const lang = query.lang === 'en' ? 'en' : 'th';
    const more = query.more === '1';
    const [local, osm] = await Promise.all([
      deps.store.searchAreas(q, LOCAL_MAX, lang),
      more ? withDeadline(deps.places(q, lang), deps.placesDeadlineMs ?? DEADLINE_MS) : Promise.resolve([]),
    ]);
    const seen = new Set(local.map((p) => sameName(p.name)));
    const extra = (osm ?? []).filter((p) => !seen.has(sameName(p.name)));
    return { places: [...local, ...extra].slice(0, TOTAL_MAX), online: osm !== null };
  });
}
