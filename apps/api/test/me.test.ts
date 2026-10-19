import { describe, expect, test } from 'bun:test';
import { createApp, type AppDeps } from '../src/app';
import { toSameOrigin } from '../src/routes/me';
import type { PhotoStorage } from '../src/photos/storage';
import type { Member, Store } from '../src/store';

type Row = Awaited<ReturnType<Store['myReports']>>[number];

const base: Omit<Row, 'id' | 'status' | 'cover_path'> = {
  title: 'ถนนพัง',
  category: 'road',
  danger_level: 2,
  reject_reason: null,
  place_name: 'ลาดพร้าว',
  confirm_count: 1,
  comment_count: 0,
  created_at: '2026-10-17T00:00:00Z',
};

function setup(over: { store?: Partial<Store>; storage?: Partial<PhotoStorage>; member?: Member | null; rows?: Row[] } = {}) {
  const calls = {
    myReports: [] as string[],
    rename: [] as [string, string][],
    signed: [] as [string, number][],
  };
  const store = {
    member: async () => (over.member === undefined ? { id: 'user-1', role: 'user', banned: false } : over.member),
    myReports: async (uid: string) => {
      calls.myReports.push(uid);
      return over.rows ?? [];
    },
    renameMember: async (uid: string, name: string) => {
      calls.rename.push([uid, name]);
      return name;
    },
    ...over.store,
  } as Store;
  const photos: PhotoStorage = {
    put: async () => {},
    remove: async () => {},
    promote: async () => {},
    signedUrl: async (path, sec) => {
      calls.signed.push([path, sec]);
      return `http://kong:8000/storage/v1/object/sign/photos-private/${path}?token=abc`;
    },
    ...over.storage,
  };
  const deps: AppDeps = {
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => 'user-1',
    quickLogin: { users: () => [], signIn: async () => { throw new Error('unused'); } },
    store,
    broadcast: async () => {},
    photos,
    rateLimits: { reports: 5, comments: 12, photos: 40, fixClaims: 10, flags: 20 },
  };
  return { app: createApp(deps), calls };
}

const get = (app: ReturnType<typeof createApp>, auth: string | null = 'Bearer tok') =>
  app.handle(new Request('http://localhost/me/reports', { headers: auth ? { authorization: auth } : {} }));

const patch = (app: ReturnType<typeof createApp>, body: unknown, auth: string | null = 'Bearer tok') =>
  app.handle(
    new Request('http://localhost/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
      body: JSON.stringify(body),
    }),
  );

describe('toSameOrigin', () => {
  test('strips the internal origin and keeps path and query', () => {
    expect(toSameOrigin('http://kong:8000/storage/v1/object/sign/photos-private/a/b_thumb.webp?token=abc')).toBe(
      '/sb/storage/v1/object/sign/photos-private/a/b_thumb.webp?token=abc',
    );
  });
  test('already-relative storage path is prefixed', () => {
    expect(toSameOrigin('/storage/v1/object/sign/x?token=t')).toBe('/sb/storage/v1/object/sign/x?token=t');
  });
});

describe('GET /me/reports', () => {
  test('no token -> 401', async () => {
    const { app, calls } = setup();
    expect((await get(app, null)).status).toBe(401);
    expect(calls.myReports).toEqual([]);
  });

  test('queries with the caller id', async () => {
    const { app, calls } = setup();
    const res = await get(app);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reports: [] });
    expect(calls.myReports).toEqual(['user-1']);
  });

  test('pending_review gets a same-origin signed thumb url (3600 s, thumb path)', async () => {
    const { app, calls } = setup({
      rows: [{ ...base, id: 'r1', status: 'pending_review', cover_path: 'r1/p1.webp' }],
    });
    const body = await (await get(app)).json();
    expect(calls.signed).toEqual([['r1/p1_thumb.webp', 3600]]);
    expect(body.reports[0].thumb_url).toBe('/sb/storage/v1/object/sign/photos-private/r1/p1_thumb.webp?token=abc');
  });

  test.each(['open', 'fix_claimed', 'resolved'] as const)('%s gets the public url without signing', async (status) => {
    const { app, calls } = setup({ rows: [{ ...base, id: 'r1', status, cover_path: 'r1/p1.webp' }] });
    const body = await (await get(app)).json();
    expect(body.reports[0].thumb_url).toBe('/sb/storage/v1/object/public/photos-public/r1/p1_thumb.webp');
    expect(calls.signed).toEqual([]);
  });

  test('no photo -> thumb_url null; signedUrl null -> null', async () => {
    const a = setup({ rows: [{ ...base, id: 'r1', status: 'pending_review', cover_path: null }] });
    expect((await (await get(a.app)).json()).reports[0].thumb_url).toBeNull();
    expect(a.calls.signed).toEqual([]);
    const b = setup({
      rows: [{ ...base, id: 'r1', status: 'rejected', cover_path: 'r1/p1.webp' }],
      storage: { signedUrl: async () => null },
    });
    expect((await (await get(b.app)).json()).reports[0].thumb_url).toBeNull();
  });

  test('output has no coordinates and no cover_path', async () => {
    const { app } = setup({
      rows: [{ ...base, id: 'r1', status: 'open', cover_path: 'r1/p1.webp', lng: 100, lat: 13, location: 'x' } as Row],
    });
    const r = (await (await get(app)).json()).reports[0];
    expect(Object.keys(r).sort()).toEqual(
      ['category', 'comment_count', 'confirm_count', 'created_at', 'danger_level', 'id', 'place_name', 'reject_reason', 'status', 'thumb_url', 'title'],
    );
  });
});

describe('PATCH /me', () => {
  test('no token -> 401', async () => {
    const { app } = setup();
    expect((await patch(app, { display_name: 'สมชาย' }, null)).status).toBe(401);
  });

  test('trims and stores', async () => {
    const { app, calls } = setup();
    const res = await patch(app, { display_name: '  สมชาย  ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ display_name: 'สมชาย' });
    expect(calls.rename).toEqual([['user-1', 'สมชาย']]);
  });

  test.each([
    ['too short', 'ก'],
    ['31 chars', 'ก'.repeat(31)],
    ['not a string', 5],
    ['blank', '   '],
    ['two zero-width spaces', '​​'],
    ['newline inside', 'สม\nชาย'],
    ['control character', 'สม\u0007ชาย'],
  ])('%s -> 400 invalid_display_name', async (_n, display_name) => {
    const { app, calls } = setup();
    const res = await patch(app, { display_name });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_display_name');
    expect(calls.rename).toEqual([]);
  });

  test('30 chars and 2 chars are accepted; length counts code points', async () => {
    const { app } = setup();
    expect((await patch(app, { display_name: 'ก'.repeat(30) })).status).toBe(200);
    expect((await patch(app, { display_name: 'กข' })).status).toBe(200);
    expect((await patch(app, { display_name: '😀'.repeat(30) })).status).toBe(200);
    expect((await patch(app, { display_name: '😀'.repeat(31) })).status).toBe(400);
  });

  test('profanity -> 422 and store untouched', async () => {
    const { app, calls } = setup();
    const res = await patch(app, { display_name: 'ไอ้เหี้ย' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('profanity');
    expect(calls.rename).toEqual([]);
  });
});
