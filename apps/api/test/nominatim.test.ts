import { describe, expect, test } from 'bun:test';
import { createNominatim } from '../src/places/nominatim';

const row = (name: string, extra: Record<string, unknown> = {}) => ({
  display_name: `${name}, อำเภอเมืองเชียงใหม่, เชียงใหม่, ประเทศไทย`,
  lon: '98.98',
  lat: '18.79',
  boundingbox: ['18.7', '18.9', '98.9', '99.1'],
  ...extra,
});

function setup(answer: (url: string, init: RequestInit) => Promise<Response> | Response = () => Response.json([row('ประตูท่าแพ')]),
               opts: { cacheMax?: number; timeoutMs?: number; maxWaiting?: number } = {}) {
  let clock = 1_000_000;
  const calls: { url: string; init: RequestInit; at: number }[] = [];
  const geocode = createNominatim({
    baseUrl: 'https://nominatim.example',
    contact: 'https://github.com/x/y',
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init, at: clock });
      return answer(url, init);
    }) as unknown as typeof fetch,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    ...opts,
  });
  return { geocode, calls, advance: (ms: number) => (clock += ms) };
}

describe('createNominatim', () => {
  test('asks politely: user agent and query', async () => {
    const { geocode, calls } = setup();
    await geocode('ท่าแพ', 'en');
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe('https://nominatim.example/search');
    expect(u.searchParams.get('format')).toBe('jsonv2');
    expect(u.searchParams.get('countrycodes')).toBe('th');
    expect(u.searchParams.get('limit')).toBe('5');
    expect(u.searchParams.get('accept-language')).toBe('en');
    expect(u.searchParams.get('q')).toBe('ท่าแพ');
    expect((calls[0].init.headers as Record<string, string>)['User-Agent']).toBe('Jaeng/0.6 (+https://github.com/x/y)');
  });

  test('turns rows into places with [w, s, e, n] boxes', async () => {
    const { geocode } = setup();
    expect(await geocode('ท่าแพ', 'th')).toEqual([
      {
        name: 'ประตูท่าแพ',
        detail: 'อำเภอเมืองเชียงใหม่, เชียงใหม่, ประเทศไทย',
        lng: 98.98,
        lat: 18.79,
        bbox: [98.9, 18.7, 99.1, 18.9],
        source: 'osm',
      },
    ]);
  });

  test('drops rows with bad numbers and keeps a row with a bad box without one', async () => {
    const { geocode } = setup(() =>
      Response.json([row('a', { lon: 'x' }), row('b', { boundingbox: ['x'] }), { display_name: 5 }]),
    );
    const out = await geocode('ab', 'th');
    expect(out?.map((p) => [p.name, p.bbox])).toEqual([['b', null]]);
  });

  test('five queries at once reach the server at least 1.1 s apart', async () => {
    const { geocode, calls } = setup();
    await Promise.all(['aa', 'bb', 'cc', 'dd', 'ee'].map((q) => geocode(q, 'th')));
    expect(calls).toHaveLength(5);
    for (let i = 1; i < calls.length; i++) expect(calls[i].at - calls[i - 1].at).toBeGreaterThanOrEqual(1100);
  });

  test('the same query is fetched once, also while in flight, and again after 24 hours', async () => {
    const { geocode, calls, advance } = setup();
    await Promise.all([geocode('Tha Phae', 'en'), geocode(' tha phae ', 'en')]);
    await geocode('THA PHAE', 'en');
    expect(calls).toHaveLength(1);
    await geocode('tha phae', 'th');
    expect(calls).toHaveLength(2);
    advance(86_400_001);
    await geocode('tha phae', 'en');
    expect(calls).toHaveLength(3);
  });

  test('gives up after the timeout and aborts the request', async () => {
    let signal: AbortSignal | undefined;
    const { geocode } = setup(
      (_u, init) =>
        new Promise((_res, rej) => {
          signal = init.signal ?? undefined;
          init.signal?.addEventListener('abort', () => rej(new Error('aborted')));
        }),
      { timeoutMs: 20 },
    );
    expect(await geocode('ช้า', 'th')).toBeNull();
    expect(signal?.aborted).toBe(true);
  });

  test.each([
    ['503', () => new Response('busy', { status: 503 })],
    ['broken JSON', () => new Response('{', { status: 200 })],
    ['not an array', () => Response.json({ error: 'x' })],
    ['a thrown fetch', () => Promise.reject(new TypeError('offline'))],
  ])('%s -> null', async (_n, answer) => {
    const { geocode } = setup(answer as () => Response);
    expect(await geocode('พัง', 'th')).toBeNull();
  });

  test('a failure is remembered for a minute only', async () => {
    const { geocode, calls, advance } = setup(() => new Response('busy', { status: 503 }));
    await geocode('พัง', 'th');
    await geocode('พัง', 'th');
    expect(calls).toHaveLength(1);
    advance(60_001);
    await geocode('พัง', 'th');
    expect(calls).toHaveLength(2);
  });

  test('the oldest entry leaves when the cache is full', async () => {
    const { geocode, calls } = setup(undefined, { cacheMax: 2 });
    await geocode('aa', 'th');
    await geocode('bb', 'th');
    await geocode('cc', 'th');
    await geocode('bb', 'th');
    expect(calls).toHaveLength(3);
    await geocode('aa', 'th');
    expect(calls).toHaveLength(4);
  });

  test('a long queue answers null at once instead of waiting', async () => {
    const { geocode, calls } = setup(undefined, { maxWaiting: 2 });
    const out = await Promise.all(['aa', 'bb', 'cc', 'dd'].map((q) => geocode(q, 'th')));
    expect(out.filter((x) => x === null)).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });
});
