import { describe, expect, test } from 'bun:test';
import type { PublicComment, ReportSignal } from '@jaeng/shared/api';
import type { DuplicateCandidate } from '@jaeng/shared/report';
import { createApp, type AppDeps } from '../src/app';
import { ApiError } from '../src/errors';
import type { PhotoStorage } from '../src/photos/storage';
import type { Member, Store } from '../src/store';

const ID = '7c1f1f4e-9b0e-4c55-8d0a-6f3d1f0b2a11';
const report: ReportSignal = { id: ID, status: 'open', confirm_count: 3, comment_count: 2 };
const comment: PublicComment = {
  id: 'c1',
  report_id: ID,
  body: 'สวัสดี',
  author_name: 'สมชาย',
  by_reporter: false,
  created_at: '2026-10-17T00:00:00Z',
};

const dupes: DuplicateCandidate[] = [
  { id: ID, title: 'ถนนพัง', category: 'road', status: 'open', danger_level: 2, confirm_count: 4, cover_photo_path: null },
];

function setup(over: { store?: Partial<Store>; member?: Member | null; promoteFails?: boolean } = {}) {
  const calls = {
    merge: [] as unknown[][],
    promote: [] as string[][],
    toggle: 0,
    add: [] as string[],
    broadcast: [] as ReportSignal[],
    find: [] as unknown[][],
    create: [] as Parameters<Store['createReport']>[0][],
  };
  const store: Store = {
    member: async () => (over.member === undefined ? { id: 'user-1', role: 'user', banned: false } : over.member),
    registerPhoto: async () => {},
    deletePhoto: async () => {},
    findDuplicates: async (...args) => {
      calls.find.push(args);
      return dupes;
    },
    createReport: async (input) => {
      calls.create.push(input);
      return { id: ID, status: 'pending_review' };
    },
    toggleConfirmation: async () => {
      calls.toggle++;
      return { confirmed: true, report };
    },
    addComment: async (_r, _u, body) => {
      calls.add.push(body);
      return { comment, report };
    },
    mergeDuplicate: async (...args) => {
      calls.merge.push(args);
      return { confirmed: true, comment, report, moved: [{ from: 'u/p.webp', to: `${ID}/p.webp` }] };
    },
    ...over.store,
  } as Store;
  const photos: PhotoStorage = {
    put: async () => {},
    remove: async () => {},
    promote: async (from, to) => {
      calls.promote.push([from, to]);
      if (over.promoteFails) throw new Error('storage down');
    },
    signedUrl: async () => null,
  };
  const deps: AppDeps = {
    photos,
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => 'user-1',
    quickLogin: { users: () => [], signIn: async () => { throw new Error('unused'); } },
    store,
    rateLimits: { reports: 5, comments: 12, photos: 40, fixClaims: 10, flags: 20 },
    broadcast: async (s) => {
      calls.broadcast.push(s);
    },
  };
  return { app: createApp(deps), calls };
}

const post = (app: ReturnType<typeof createApp>, path: string, body?: unknown, auth: string | null = 'Bearer tok', raw?: string) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        ...(auth ? { authorization: auth } : {}),
        ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    }),
  );

describe('POST /reports/:id/confirm', () => {
  test('success returns store result and broadcasts once', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/reports/${ID}/confirm`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: true, report });
    expect(calls.broadcast).toEqual([report]);
  });

  test('no token -> 401 and store untouched', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/reports/${ID}/confirm`, undefined, null);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('unauthorized');
    expect(calls.toggle).toBe(0);
  });

  test('banned user -> 403 and toggle not called', async () => {
    const { app, calls } = setup({ member: { id: 'user-1', role: 'user', banned: true } });
    const res = await post(app, `/reports/${ID}/confirm`);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('banned');
    expect(calls.toggle).toBe(0);
  });

  test('non-uuid id -> 404 report_not_found without calling store', async () => {
    const { app, calls } = setup();
    const res = await post(app, '/reports/not-a-uuid/confirm');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('report_not_found');
    expect(calls.toggle).toBe(0);
  });

  test('report_resolved -> 409 and no broadcast', async () => {
    const { app, calls } = setup({
      store: {
        toggleConfirmation: async () => {
          throw new ApiError('report_resolved');
        },
      },
    });
    const res = await post(app, `/reports/${ID}/confirm`);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('report_resolved');
    expect(calls.broadcast).toEqual([]);
  });

  test('generic store error -> 500 internal without stack', async () => {
    const { app } = setup({
      store: {
        toggleConfirmation: async () => {
          throw new Error('boom secret detail');
        },
      },
    });
    const res = await post(app, `/reports/${ID}/confirm`);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('internal');
    expect(text).not.toContain('boom');
    expect(text).not.toContain('at ');
  });
});

describe('POST /reports/:id/comments', () => {
  const url = `/reports/${ID}/comments`;

  test('success -> 201, trimmed body passed to store, broadcast', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { body: '  สวัสดี  ' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ comment, report });
    expect(calls.add).toEqual(['สวัสดี']);
    expect(calls.broadcast).toEqual([report]);
  });

  test('exactly 500 chars -> 201', async () => {
    const { app } = setup();
    expect((await post(app, url, { body: 'ก'.repeat(500) })).status).toBe(201);
  });

  test.each([
    ['whitespace only', { body: '   ' }],
    ['501 chars', { body: 'ก'.repeat(501) }],
    ['missing body', {}],
    ['non-string body', { body: 5 }],
  ])('%s -> 400 invalid_body', async (_n, payload) => {
    const { app, calls } = setup();
    const res = await post(app, url, payload);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_body');
    expect(calls.add).toEqual([]);
    expect(calls.broadcast).toEqual([]);
  });

  test('no request body at all -> 400 invalid_body', async () => {
    const { app } = setup();
    const res = await post(app, url);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_body');
  });

  test('malformed JSON -> 400 invalid_request', async () => {
    const { app } = setup();
    const res = await post(app, url, undefined, 'Bearer tok', '{not json');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
  });

  test('non-uuid id -> 404', async () => {
    const { app } = setup();
    const res = await post(app, '/reports/xyz/comments', { body: 'hi' });
    expect(res.status).toBe(404);
  });

  test('no token -> 401', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { body: 'hi' }, null);
    expect(res.status).toBe(401);
    expect(calls.add).toEqual([]);
  });

  test('profanity -> 422 profanity, store and broadcast untouched', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { body: 'ไอ้เหี้ยนี่' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('profanity');
    expect(calls.add).toEqual([]);
    expect(calls.broadcast).toEqual([]);
  });

  test('English profanity -> 422', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { body: 'what the FUCK' });
    expect(res.status).toBe(422);
    expect(calls.add).toEqual([]);
  });

  test('store rate_limited -> 429 and no broadcast', async () => {
    const { app, calls } = setup({
      store: {
        addComment: async () => {
          throw new ApiError('rate_limited');
        },
      },
    });
    const res = await post(app, url, { body: 'hi' });
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('rate_limited');
    expect(calls.broadcast).toEqual([]);
  });

  test('passes rateLimits.comments as limit to the store', async () => {
    let seen: number | undefined;
    const { app } = setup({
      store: {
        addComment: async (_r, _u, _b, limit) => {
          seen = limit;
          return { comment, report };
        },
      },
    });
    expect((await post(app, url, { body: 'hi' })).status).toBe(201);
    expect(seen).toBe(12);
  });

  test('generic store error -> 500 internal', async () => {
    const { app } = setup({
      store: {
        addComment: async () => {
          throw new Error('db exploded');
        },
      },
    });
    const res = await post(app, url, { body: 'hi' });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('exploded');
  });
});

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const P3 = '33333333-3333-4333-8333-333333333333';
const P4 = '44444444-4444-4444-8444-444444444444';
const P5 = '55555555-5555-4555-8555-555555555555';
const BKK = { lng: 100.5, lat: 13.75 };

describe('POST /reports/check-duplicate', () => {
  const url = '/reports/check-duplicate';

  test('no token -> 401', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { ...BKK, category: 'road' }, null);
    expect(res.status).toBe(401);
    expect(calls.find).toEqual([]);
  });

  test('banned -> 403', async () => {
    const { app } = setup({ member: { id: 'user-1', role: 'user', banned: true } });
    expect((await post(app, url, { ...BKK, category: 'road' })).status).toBe(403);
  });

  test('outside Thailand -> 400 invalid_location', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { lng: 0, lat: 0, category: 'road' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_location');
    expect(calls.find).toEqual([]);
  });

  test('unknown category -> 400 invalid_report', async () => {
    const { app } = setup();
    const res = await post(app, url, { ...BKK, category: 'nope' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_report');
  });

  test('success passes lng, lat, category and returns duplicates', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { ...BKK, category: 'road' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ duplicates: dupes });
    expect(calls.find).toEqual([[100.5, 13.75, 'road']]);
  });
});

describe('POST /reports', () => {
  const valid = { category: 'road', ...BKK, photo_ids: [P1] };
  const code = async (res: Response) => (await res.json()).error.code;

  test('success -> 201, normalised input, no broadcast', async () => {
    const { app, calls } = setup();
    const res = await post(app, '/reports', { ...valid, title: '  ', tags: ['#A', 'a ', ' B'] });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ report: { id: ID, status: 'pending_review' } });
    expect(calls.broadcast).toEqual([]);
    expect(calls.create).toEqual([
      {
        userId: 'user-1',
        category: 'road',
        lng: 100.5,
        lat: 13.75,
        photoIds: [P1],
        title: null,
        description: null,
        danger: null,
        tags: ['a', 'b'],
        hideAuthor: false,
        flagged: false,
        limit: 5,
      },
    ]);
  });

  test('trims title and description, passes danger and hide_author', async () => {
    const { app, calls } = setup();
    const res = await post(app, '/reports', {
      ...valid,
      title: '  ถนนพัง ',
      description: ' หลุมลึก ',
      danger_level: 3,
      hide_author: true,
    });
    expect(res.status).toBe(201);
    expect(calls.create[0]).toMatchObject({ title: 'ถนนพัง', description: 'หลุมลึก', danger: 3, hideAuthor: true });
  });

  test('no token -> 401, banned -> 403', async () => {
    const a = setup();
    expect((await post(a.app, '/reports', valid, null)).status).toBe(401);
    const b = setup({ member: { id: 'user-1', role: 'user', banned: true } });
    const res = await post(b.app, '/reports', valid);
    expect(res.status).toBe(403);
    expect(b.calls.create).toEqual([]);
  });

  test.each([
    ['0 photos', []],
    ['5 photos', [P1, P2, P3, P4, P5]],
    ['duplicate ids', [P1, P1]],
    ['not a uuid', ['abc']],
    ['non-string id', [5]],
  ])('%s -> 400 invalid_photos', async (_n, photo_ids) => {
    const { app, calls } = setup();
    const res = await post(app, '/reports', { ...valid, photo_ids });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('invalid_photos');
    expect(calls.create).toEqual([]);
  });

  test('missing photo_ids -> 400 invalid_photos', async () => {
    const { app } = setup();
    const res = await post(app, '/reports', { category: 'road', ...BKK });
    expect(await code(res)).toBe('invalid_photos');
  });

  test('4 photos accepted', async () => {
    const { app } = setup();
    expect((await post(app, '/reports', { ...valid, photo_ids: [P1, P2, P3, P4] })).status).toBe(201);
  });

  test.each([
    ['title 121', { title: 'ก'.repeat(121) }],
    ['description 1001', { description: 'ก'.repeat(1001) }],
    ['danger 4', { danger_level: 4 }],
    ['danger 1.5', { danger_level: 1.5 }],
    ['danger -1', { danger_level: -1 }],
    ['danger string', { danger_level: '2' }],
    ['6 distinct tags', { tags: ['a', 'b', 'c', 'd', 'e', 'f'] }],
    ['title not string', { title: 5 }],
    ['tags not array', { tags: 'a' }],
    ['unknown category', { category: 'nope' }],
    ['hide_author not boolean', { hide_author: 'yes' }],
  ])('%s -> 400 invalid_report', async (_n, extra) => {
    const { app, calls } = setup();
    const res = await post(app, '/reports', { ...valid, ...extra });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('invalid_report');
    expect(calls.create).toEqual([]);
  });

  test('exact limits are accepted; tags that dedupe to 5 are accepted; invalid tags dropped', async () => {
    const { app, calls } = setup();
    const res = await post(app, '/reports', {
      ...valid,
      title: 'ก'.repeat(120),
      description: 'ข'.repeat(1000),
      tags: ['a', 'A', '#a', 'b', 'c', 'd', 'e', '###', 'x'.repeat(31)],
    });
    expect(res.status).toBe(201);
    expect(calls.create[0]!.tags).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('title length counts code points', async () => {
    const { app } = setup();
    expect((await post(app, '/reports', { ...valid, title: '😀'.repeat(120) })).status).toBe(201);
    expect((await post(app, '/reports', { ...valid, title: '😀'.repeat(121) })).status).toBe(400);
  });

  test.each([
    ['outside Thailand', { lng: 0, lat: 0 }],
    ['lng not a number', { lng: '100' }],
    ['lat missing', { lat: undefined }],
    ['lng null', { lng: null }],
  ])('%s -> 400 invalid_location', async (_n, extra) => {
    const { app, calls } = setup();
    const res = await post(app, '/reports', { ...valid, ...extra });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('invalid_location');
    expect(calls.create).toEqual([]);
  });

  test('profane title is accepted but flagged; clean report is not', async () => {
    const bad = setup();
    expect((await post(bad.app, '/reports', { ...valid, title: 'ไอ้เหี้ยนี่' })).status).toBe(201);
    expect(bad.calls.create[0]!.flagged).toBe(true);
    const tag = setup();
    await post(tag.app, '/reports', { ...valid, tags: ['fuck'] });
    expect(tag.calls.create[0]!.flagged).toBe(true);
    const ok = setup();
    await post(ok.app, '/reports', { ...valid, title: 'ถนนพัง' });
    expect(ok.calls.create[0]!.flagged).toBe(false);
  });

  test.each([
    ['invalid_photos', 400],
    ['rate_limited', 429],
    ['invalid_report', 400],
  ] as const)('store %s -> %d', async (c, status) => {
    const { app, calls } = setup({
      store: {
        createReport: async () => {
          throw new ApiError(c);
        },
      },
    });
    const res = await post(app, '/reports', valid);
    expect(res.status).toBe(status);
    expect(await code(res)).toBe(c);
    expect(calls.broadcast).toEqual([]);
  });

  test('malformed JSON -> 400 invalid_request', async () => {
    const { app } = setup();
    const res = await post(app, '/reports', undefined, 'Bearer tok', '{nope');
    expect(res.status).toBe(400);
  });

  test('/reports/:id routes still work', async () => {
    const { app } = setup();
    expect((await post(app, `/reports/${ID}/confirm`)).status).toBe(200);
  });
});

describe('POST /reports/:id/merge', () => {
  const url = `/reports/${ID}/merge`;
  const code = async (res: Response) => (await res.json()).error.code;

  test('success -> 200, promotes each moved photo, broadcasts once', async () => {
    const { app, calls } = setup();
    const res = await post(app, url, { photo_ids: [P1, P2] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: true, comment, report });
    expect(calls.merge).toEqual([[ID, 'user-1', [P1, P2], 12]]);
    expect(calls.promote).toEqual([['u/p.webp', `${ID}/p.webp`]]);
    expect(calls.broadcast).toEqual([report]);
  });

  test('promote failing twice is retried once and still answers 200', async () => {
    const err = console.error;
    console.error = () => {};
    try {
      const { app, calls } = setup({ promoteFails: true });
      const res = await post(app, url, { photo_ids: [P1] });
      expect(res.status).toBe(200);
      expect(calls.promote.length).toBe(2);
      expect(calls.broadcast).toEqual([report]);
    } finally {
      console.error = err;
    }
  });

  test.each([
    ['empty', []],
    ['5 photos', [P1, P2, P3, P4, P5]],
    ['not uuid', ['x']],
  ])('%s -> 400 invalid_photos', async (_n, photo_ids) => {
    const { app, calls } = setup();
    const res = await post(app, url, { photo_ids });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('invalid_photos');
    expect(calls.merge).toEqual([]);
  });

  test('non-uuid id -> 404 report_not_found', async () => {
    const { app, calls } = setup();
    const res = await post(app, '/reports/xyz/merge', { photo_ids: [P1] });
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('report_not_found');
    expect(calls.merge).toEqual([]);
  });

  test('report_resolved -> 409, no broadcast, no promote', async () => {
    const { app, calls } = setup({
      store: {
        mergeDuplicate: async () => {
          throw new ApiError('report_resolved');
        },
      },
    });
    const res = await post(app, url, { photo_ids: [P1] });
    expect(res.status).toBe(409);
    expect(calls.broadcast).toEqual([]);
    expect(calls.promote).toEqual([]);
  });

  test('rate_limited -> 429', async () => {
    const { app } = setup({
      store: {
        mergeDuplicate: async () => {
          throw new ApiError('rate_limited');
        },
      },
    });
    expect((await post(app, url, { photo_ids: [P1] })).status).toBe(429);
  });

  test('no token -> 401', async () => {
    const { app, calls } = setup();
    expect((await post(app, url, { photo_ids: [P1] }, null)).status).toBe(401);
    expect(calls.merge).toEqual([]);
  });
});