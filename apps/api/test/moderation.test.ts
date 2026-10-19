import { describe, expect, test } from 'bun:test';
import type { LiveSignal } from '@jaeng/shared/api';
import type { ModerationEffect } from '@jaeng/shared/admin';
import { createApp, type AppDeps } from '../src/app';
import { ApiError } from '../src/errors';
import type { PhotoStorage } from '../src/photos/storage';
import type { Member, Store } from '../src/store';

const ID = '7c1f1f4e-9b0e-4c55-8d0a-6f3d1f0b2a11';
const PHOTO = '0b8a3a7e-1d2c-4f5e-9a8b-7c6d5e4f3a21';
const CLAIM = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const claimed: LiveSignal = { id: ID, status: 'fix_claimed', confirm_count: 2, comment_count: 1 };

function setup(over: { store?: Partial<Store>; member?: Member | null } = {}) {
  const calls = {
    claim: [] as Parameters<Store['createFixClaim']>[0][],
    flag: [] as Parameters<Store['createFlag']>[0][],
    promote: [] as string[][],
    demote: [] as string[],
    broadcast: [] as LiveSignal[],
  };
  const store = {
    member: async () => (over.member === undefined ? { id: 'user-1', role: 'user', banned: false } : over.member),
    createFixClaim: async (i) => {
      calls.claim.push(i);
      return { claimId: CLAIM, effect: { report: claimed, promote: [], demote: [] } };
    },
    createFlag: async (i) => {
      calls.flag.push(i);
      return { flagId: 'f1', hidden: false, effect: { report: null, promote: [], demote: [] } };
    },
    ...over.store,
  } as Store;
  const photos = {
    put: async () => {},
    remove: async () => {},
    promote: async (from: string, to: string) => {
      calls.promote.push([from, to]);
    },
    demote: async (path: string) => {
      calls.demote.push(path);
    },
    signedUrl: async () => null,
  } as PhotoStorage;
  const deps: AppDeps = {
    photos,
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => 'user-1',
    quickLogin: { users: () => [], signIn: async () => { throw new Error('unused'); } },
    store,
    rateLimits: { reports: 5, comments: 12, photos: 40, fixClaims: 7, flags: 9 },
    broadcast: async (s) => {
      calls.broadcast.push(s);
    },
  };
  return { app: createApp(deps), calls };
}

const post = (app: ReturnType<typeof createApp>, path: string, body?: unknown, auth: string | null = 'Bearer tok') =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { ...(auth ? { authorization: auth } : {}), 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),
  );

const code = async (res: Response) => (await res.json()).error.code;

describe('POST /reports/:id/fix-claims', () => {
  test('success: 201, trimmed note, quota from env, broadcast fix_claimed', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/reports/${ID}/fix-claims`, { note: '  ซ่อมแล้ว  ', photo_id: PHOTO });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ claim_id: CLAIM, report: claimed });
    expect(calls.claim).toEqual([{ reportId: ID, userId: 'user-1', note: 'ซ่อมแล้ว', photoId: PHOTO, limit: 7 }]);
    expect(calls.broadcast).toEqual([claimed]);
  });

  test('blank or missing note and photo become null', async () => {
    const { app, calls } = setup();
    await post(app, `/reports/${ID}/fix-claims`, { note: '   ' });
    await post(app, `/reports/${ID}/fix-claims`, {});
    expect(calls.claim.map((c) => [c.note, c.photoId])).toEqual([[null, null], [null, null]]);
  });

  test('a note over 500 code points -> 400 invalid_note, store untouched', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/reports/${ID}/fix-claims`, { note: 'ก'.repeat(501) });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('invalid_note');
    expect(calls.claim).toEqual([]);
  });

  test('a note that is not a string -> 400 invalid_note', async () => {
    const { app } = setup();
    expect(await code(await post(app, `/reports/${ID}/fix-claims`, { note: 5 }))).toBe('invalid_note');
  });

  test('photo_id that is not a uuid -> 400 invalid_photos', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/reports/${ID}/fix-claims`, { photo_id: 'x' });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('invalid_photos');
    expect(calls.claim).toEqual([]);
  });

  test('id that is not a uuid -> 404 report_not_found', async () => {
    const { app } = setup();
    const res = await post(app, '/reports/x/fix-claims', {});
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('report_not_found');
  });

  for (const [err, status] of [['claim_pending', 409], ['already_resolved', 409], ['rate_limited', 429]] as const) {
    test(`store ${err} -> ${status}`, async () => {
      const { app, calls } = setup({ store: { createFixClaim: async () => { throw new ApiError(err); } } });
      const res = await post(app, `/reports/${ID}/fix-claims`, {});
      expect(res.status).toBe(status);
      expect(await code(res)).toBe(err);
      expect(calls.broadcast).toEqual([]);
    });
  }

  test('a missing report signal is an internal error', async () => {
    const { app } = setup({
      store: { createFixClaim: async () => ({ claimId: CLAIM, effect: { report: null, promote: [], demote: [] } }) },
    });
    expect((await post(app, `/reports/${ID}/fix-claims`, {})).status).toBe(500);
  });

  test('no token -> 401, banned -> 403', async () => {
    const { app } = setup();
    expect((await post(app, `/reports/${ID}/fix-claims`, {}, null)).status).toBe(401);
    const banned = setup({ member: { id: 'user-1', role: 'user', banned: true } });
    const res = await post(banned.app, `/reports/${ID}/fix-claims`, {});
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('banned');
  });
});

describe('POST /flags', () => {
  const body = { target_type: 'report', target_id: ID, reason: 'spam' };

  test('success: 201 {flag_id, hidden:false}, quota from env, no broadcast', async () => {
    const { app, calls } = setup();
    const res = await post(app, '/flags', { ...body, note: ' โฆษณา ' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ flag_id: 'f1', hidden: false });
    expect(calls.flag).toEqual([{ userId: 'user-1', targetType: 'report', targetId: ID, reason: 'spam', note: 'โฆษณา', limit: 9 }]);
    expect(calls.broadcast).toEqual([]);
  });

  test('auto-hide: files demoted per path and a hidden signal broadcast', async () => {
    const hidden: LiveSignal = { id: ID, status: 'hidden', confirm_count: 0, comment_count: 0 };
    const effect: ModerationEffect = { report: hidden, promote: [], demote: [`${ID}/a.webp`, `${ID}/b.webp`] };
    const { app, calls } = setup({ store: { createFlag: async () => ({ flagId: 'f3', hidden: true, effect }) } });
    const res = await post(app, '/flags', body);
    expect(await res.json()).toEqual({ flag_id: 'f3', hidden: true });
    expect(calls.demote).toEqual([`${ID}/a.webp`, `${ID}/b.webp`]);
    expect(calls.broadcast).toEqual([hidden]);
  });

  test('unknown reason or target type -> 400 invalid_request', async () => {
    const { app, calls } = setup();
    expect(await code(await post(app, '/flags', { ...body, reason: 'nope' }))).toBe('invalid_request');
    expect(await code(await post(app, '/flags', { ...body, target_type: 'user' }))).toBe('invalid_request');
    expect(calls.flag).toEqual([]);
  });

  test('target_id that is not a uuid -> 404 by target type', async () => {
    const { app } = setup();
    const c = await post(app, '/flags', { ...body, target_type: 'comment', target_id: 'x' });
    expect(c.status).toBe(404);
    expect(await code(c)).toBe('item_not_found');
    expect(await code(await post(app, '/flags', { ...body, target_id: 'x' }))).toBe('report_not_found');
  });

  test('a note over 500 -> 400 invalid_note', async () => {
    const { app } = setup();
    expect(await code(await post(app, '/flags', { ...body, note: 'a'.repeat(501) }))).toBe('invalid_note');
  });

  test('no token -> 401', async () => {
    const { app } = setup();
    expect((await post(app, '/flags', body, null)).status).toBe(401);
  });
});
