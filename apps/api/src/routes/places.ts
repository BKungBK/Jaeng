import { PLACE_QUERY_MAX, PLACE_QUERY_MIN, type PlacesAnswer } from '@jaeng/shared/places';
import { Elysia } from 'elysia';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';

const LOCAL_MAX = 5;
const TOTAL_MAX = 8;

const sameName = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** The place finder: open to everyone, read only. Our districts first, then OpenStreetMap. */
export function placeRoutes(deps: AppDeps) {
  return new Elysia().get('/places', async ({ query }): Promise<PlacesAnswer> => {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const len = [...q].length;
    if (len < PLACE_QUERY_MIN || len > PLACE_QUERY_MAX) throw new ApiError('invalid_request');
    const lang = query.lang === 'en' ? 'en' : 'th';
    const [local, osm] = await Promise.all([deps.store.searchAreas(q, LOCAL_MAX, lang), deps.places(q, lang)]);
    const seen = new Set(local.map((p) => sameName(p.name)));
    const extra = (osm ?? []).filter((p) => !seen.has(sameName(p.name)));
    return { places: [...local, ...extra].slice(0, TOTAL_MAX), online: osm !== null };
  });
}
