import { describe, expect, test } from 'bun:test';
import type { Place } from '@jaeng/shared/places';
import { createApp, type AppDeps } from '../src/app';
import { areaToPlace } from '../src/places/areas';
import type { Geocoder } from '../src/places/nominatim';
import type { Store } from '../src/store';

const local = (name: string, detail: string | null = null): Place => ({
  name,
  detail,
  lng: 98.98,
  lat: 18.79,
  bbox: [98.9, 18.7, 99.1, 18.9],
  source: 'local',
});
const osm = (name: string): Place => ({ ...local(name, 'ไทย'), bbox: null, source: 'osm' });

function setup(over: { local?: Place[]; osm?: Place[] | null; hang?: boolean } = {}) {
  const calls = { store: [] as [string, number, string][], geo: [] as [string, string][] };
  const store = {
    searchAreas: async (q: string, limit: number, lang: 'th' | 'en') => {
      calls.store.push([q, limit, lang]);
      return over.local ?? [local('เชียงใหม่')];
    },
  } as unknown as Store;
  const places: Geocoder = async (q, lang) => {
    calls.geo.push([q, lang]);
    if (over.hang) return new Promise<never>(() => {});
    return over.osm === undefined ? [osm('ประตูท่าแพ')] : over.osm;
  };
  const deps = {
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => {
      throw new Error('no token needed');
    },
    quickLogin: { users: () => [], signIn: async () => ({}) },
    store,
    broadcast: async () => {},
    photos: {},
    rateLimits: { reports: 5, comments: 12, photos: 40, fixClaims: 10, flags: 20 },
    places,
    placesDeadlineMs: 50,
  } as unknown as AppDeps;
  return { app: createApp(deps), calls };
}

const get = (app: ReturnType<typeof createApp>, qs: string) => app.handle(new Request(`http://localhost/places${qs}`));

describe('areaToPlace', () => {
  const row = {
    level: 2, name_th: 'เมืองเชียงใหม่', name_en: 'Mueang Chiang Mai', province_th: 'เชียงใหม่', province_en: 'Chiang Mai',
    lng: 98.98, lat: 18.79, min_lng: 98.9, min_lat: 18.7, max_lng: 99.1, max_lat: 18.9,
  };

  test('names a district with its province in the asked language', () => {
    expect(areaToPlace(row, 'th')).toEqual({
      name: 'เมืองเชียงใหม่', detail: 'เชียงใหม่', lng: 98.98, lat: 18.79, bbox: [98.9, 18.7, 99.1, 18.9], source: 'local',
    });
    expect(areaToPlace(row, 'en')).toMatchObject({ name: 'Mueang Chiang Mai', detail: 'Chiang Mai' });
  });

  test('a province has no detail', () => {
    expect(areaToPlace({ ...row, level: 1, name_th: 'เชียงใหม่', name_en: 'Chiang Mai' }, 'en').detail).toBeNull();
  });
});

describe('GET /places', () => {
  test.each([
    ['missing', ''],
    ['one letter', '?q=a'],
    ['spaces around one letter', '?q=%20a%20'],
    ['81 letters', `?q=${'ก'.repeat(81)}`],
  ])('%s -> 400 invalid_request', async (_n, qs) => {
    const { app, calls } = setup();
    const res = await get(app, qs);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
    expect(calls.geo).toEqual([]);
  });

  test('80 letters are fine', async () => {
    const { app } = setup();
    expect((await get(app, `?q=${encodeURIComponent('ก'.repeat(80))}`)).status).toBe(200);
  });

  test('typing asks only our own districts, never OpenStreetMap (OSM policy: no auto-complete)', async () => {
    const { app, calls } = setup();
    const body = await (await get(app, '?q=เชียง')).json();
    expect(body).toEqual({ places: [local('เชียงใหม่')], online: true });
    expect(calls.geo).toEqual([]);
  });

  test('more=1: local places first, then OSM, without a token', async () => {
    const { app, calls } = setup();
    const res = await get(app, `?q=${encodeURIComponent(' เชียงใหม่ ')}&more=1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.online).toBe(true);
    expect(body.places.map((p: Place) => [p.name, p.source])).toEqual([
      ['เชียงใหม่', 'local'],
      ['ประตูท่าแพ', 'osm'],
    ]);
    expect(calls.store).toEqual([['เชียงใหม่', 5, 'th']]);
    expect(calls.geo).toEqual([['เชียงใหม่', 'th']]);
  });

  test('an OSM result named like a local one is dropped', async () => {
    const { app } = setup({ local: [local('Chiang Mai')], osm: [osm('chiang  mai'), osm('Tha Phae')] });
    const body = await (await get(app, '?q=chiang&lang=en&more=1')).json();
    expect(body.places.map((p: Place) => p.name)).toEqual(['Chiang Mai', 'Tha Phae']);
  });

  test('at most 8 places', async () => {
    const many = Array.from({ length: 6 }, (_, i) => `l${i}`);
    const { app } = setup({ local: many.map((n) => local(n)), osm: many.map((n) => osm(`o${n}`)) });
    expect((await (await get(app, '?q=ll&more=1')).json()).places).toHaveLength(8);
  });

  test('OSM down -> online false, local results still come', async () => {
    const { app } = setup({ osm: null });
    const body = await (await get(app, '?q=เชียง&more=1')).json();
    expect(body).toEqual({ places: [local('เชียงใหม่')], online: false });
  });

  test('OSM slower than the deadline -> online false with local results, not a long wait', async () => {
    const { app } = setup({ hang: true });
    const t0 = Date.now();
    const body = await (await get(app, '?q=เชียง&more=1')).json();
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(body).toEqual({ places: [local('เชียงใหม่')], online: false });
  });

  test('lang=en reaches the store and OSM; anything else is Thai', async () => {
    const a = setup();
    await get(a.app, '?q=chiang&lang=en&more=1');
    expect(a.calls.store[0][2]).toBe('en');
    expect(a.calls.geo[0][1]).toBe('en');
    const b = setup();
    await get(b.app, '?q=chiang&lang=fr');
    expect(b.calls.store[0][2]).toBe('th');
  });
});
