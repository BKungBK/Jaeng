import { describe, expect, test } from 'bun:test';
import type { LiveSignal } from '@jaeng/shared/api';
import type { ModerationEffect } from '@jaeng/shared/admin';
import { createApp, type AppDeps } from '../src/app';
import { ApiError } from '../src/errors';
import type { PhotoStorage } from '../src/photos/storage';
import type { Member, Store } from '../src/store';

const ID = '7c1f1f4e-9b0e-4c55-8d0a-6f3d1f0b2a11';
const ADMIN: Member = { id: 'admin-1', role: 'admin', banned: false };
const opened: LiveSignal = { id: ID, status: 'open', confirm_count: 0, comment_count: 0 };
const none: ModerationEffect = { report: null, promote: [], demote: [] };

type Calls = Record<string, unknown[][]> & { promote: string[][]; demote: string[]; broadcast: LiveSignal[] };

function setup(over: { store?: Partial<Store>; member?: Member | null; effect?: ModerationEffect } = {}) {
  const calls: Calls = { promote: [], demote: [], broadcast: [] } as unknown as Calls;
  const record = (name: string, effect: ModerationEffect = over.effect ?? none) => async (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return effect;
  };
  const store = {
    member: async () => (over.member === undefined ? ADMIN : over.member),
    approveReport: record('approveReport', over.effect ?? { report: opened, promote: [], demote: [] }),
    rejectReport: record('rejectReport'),
    reviewFixClaim: record('reviewFixClaim'),
    hide: record('hide'),
    restore: record('restore'),
    resolveFlags: record('resolveFlags'),
    setBan: record('setBan'),
    adminRemoveAvatar: async (...args: unknown[]) => {
      (calls.adminRemoveAvatar ??= []).push(args);
      return 'u/old.webp';
    },
    ...over.store,
  } as unknown as Store;
  const photos = {
    put: async () => {},
    remove: async (bucket: string, paths: string[]) => {
      (calls.removed ??= []).push([bucket, paths]);
    },
    promote: async (from: string, to: string) => {
      calls.promote.push([from, to]);
    },
    demote: async (path: string) => {
      calls.demote.push(path);
    },
    signedUrl: async (path: string) => `/storage/v1/object/sign/photos-private/${path}?token=t`,
  } as PhotoStorage;
  const deps: AppDeps = {
    photos,
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => 'admin-1',
    quickLogin: { users: () => [], signIn: async () => { throw new Error('unused'); } },
    store,
    rateLimits: { reports: 5, comments: 12, photos: 40, fixClaims: 10, flags: 20 },
    broadcast: async (s) => {
      calls.broadcast.push(s);
    },
  };
  return { app: createApp(deps), calls };
}

const send = (app: ReturnType<typeof createApp>, method: string, path: string, body?: unknown, auth: string | null = 'Bearer tok') =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { ...(auth ? { authorization: auth } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

const post = (app: ReturnType<typeof createApp>, path: string, body: unknown = {}, auth?: string | null) =>
  send(app, 'POST', path, body, auth);
const code = async (res: Response) => (await res.json()).error.code;

const ACTIONS: [string, unknown, string][] = [
  [`/admin/reports/${ID}/approve`, { location: 'keep' }, 'approveReport'],
  [`/admin/reports/${ID}/reject`, { reason: 'duplicate' }, 'rejectReport'],
  [`/admin/fix-claims/${ID}/approve`, {}, 'reviewFixClaim'],
  [`/admin/fix-claims/${ID}/reject`, {}, 'reviewFixClaim'],
  [`/admin/flags/${ID}/resolve`, { action: 'dismiss' }, 'resolveFlags'],
  ['/admin/hide', { target_type: 'report', target_id: ID }, 'hide'],
  ['/admin/restore', { target_type: 'report', target_id: ID }, 'restore'],
  [`/admin/users/${ID}/ban`, {}, 'setBan'],
  [`/admin/users/${ID}/unban`, {}, 'setBan'],
  [`/admin/users/${ID}/remove-avatar`, {}, 'adminRemoveAvatar'],
];

describe('every admin action needs an admin', () => {
  for (const [path, body, method] of ACTIONS) {
    test(`${path}: no token 401, member 403, store untouched`, async () => {
      const anon = setup();
      expect((await post(anon.app, path, body, null)).status).toBe(401);
      const member = setup({ member: { id: 'u', role: 'user', banned: false } });
      const res = await post(member.app, path, body);
      expect(res.status).toBe(403);
      expect(await code(res)).toBe('forbidden');
      expect(member.calls[method]).toBeUndefined();
    });
  }

  test('a banned admin is banned', async () => {
    const { app } = setup({ member: { id: 'a', role: 'admin', banned: true } });
    expect(await code(await post(app, '/admin/hide', { target_type: 'report', target_id: ID }))).toBe('banned');
  });
});

describe('POST /admin/reports/:id/approve', () => {
  test('keep with no edits sends nulls', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/admin/reports/${ID}/approve`, { location: 'keep' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ report: opened });
    expect(calls.approveReport).toEqual([
      ['admin-1', ID, { category: null, danger: null, title: null, location: 'keep', lng: null, lat: null }],
    ]);
  });

  test('edits are passed trimmed', async () => {
    const { app, calls } = setup();
    await post(app, `/admin/reports/${ID}/approve`, { location: 'fuzz', category: 'hazard', danger_level: 3, title: '  ท่อแตก  ' });
    expect(calls.approveReport[0][2]).toEqual({ category: 'hazard', danger: 3, title: 'ท่อแตก', location: 'fuzz', lng: null, lat: null });
  });

  test('point inside Thailand passes its coordinates; outside is invalid_location', async () => {
    const { app, calls } = setup();
    await post(app, `/admin/reports/${ID}/approve`, { location: 'point', lng: 100.5, lat: 13.7 });
    expect(calls.approveReport[0][2]).toMatchObject({ location: 'point', lng: 100.5, lat: 13.7 });
    const out = await post(app, `/admin/reports/${ID}/approve`, { location: 'point', lng: 0, lat: 0 });
    expect(out.status).toBe(400);
    expect(await code(out)).toBe('invalid_location');
    expect(await code(await post(app, `/admin/reports/${ID}/approve`, { location: 'point', lng: '100' }))).toBe('invalid_location');
  });

  test('bad mode is invalid_request; bad edits are invalid_report', async () => {
    const { app, calls } = setup();
    expect(await code(await post(app, `/admin/reports/${ID}/approve`, { location: 'x' }))).toBe('invalid_request');
    expect(await code(await post(app, `/admin/reports/${ID}/approve`, {}))).toBe('invalid_request');
    expect(await code(await post(app, `/admin/reports/${ID}/approve`, { location: 'keep', danger_level: 1.5 }))).toBe('invalid_report');
    expect(await code(await post(app, `/admin/reports/${ID}/approve`, { location: 'keep', category: 'nope' }))).toBe('invalid_report');
    expect(await code(await post(app, `/admin/reports/${ID}/approve`, { location: 'keep', title: 'ก'.repeat(121) }))).toBe('invalid_report');
    expect(calls.approveReport).toBeUndefined();
  });

  test('moves the listed files, then broadcasts once', async () => {
    const effect: ModerationEffect = {
      report: opened,
      promote: [{ from: 'u/a.webp', to: `${ID}/a.webp` }, { from: 'u/b.webp', to: `${ID}/b.webp` }],
      demote: [],
    };
    const { app, calls } = setup({ effect });
    await post(app, `/admin/reports/${ID}/approve`, { location: 'keep' });
    expect(calls.promote).toEqual([['u/a.webp', `${ID}/a.webp`], ['u/b.webp', `${ID}/b.webp`]]);
    expect(calls.broadcast).toEqual([opened]);
  });

  test('invalid_state -> 409, nothing moved or broadcast', async () => {
    const { app, calls } = setup({ store: { approveReport: async () => { throw new ApiError('invalid_state'); } } });
    const res = await post(app, `/admin/reports/${ID}/approve`, { location: 'keep' });
    expect(res.status).toBe(409);
    expect(await code(res)).toBe('invalid_state');
    expect(calls.promote).toEqual([]);
    expect(calls.broadcast).toEqual([]);
  });

  test('a report id that is not a uuid is report_not_found', async () => {
    const { app } = setup();
    expect(await code(await post(app, '/admin/reports/x/approve', { location: 'keep' }))).toBe('report_not_found');
  });
});

describe('POST /admin/reports/:id/reject', () => {
  test('other with a note: trimmed, {ok:true}, no broadcast', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/admin/reports/${ID}/reject`, { reason: 'other', note: ' พิกัดไม่ชัด ' });
    expect(await res.json()).toEqual({ ok: true });
    expect(calls.rejectReport).toEqual([['admin-1', ID, 'other', 'พิกัดไม่ชัด']]);
    expect(calls.broadcast).toEqual([]);
  });

  test('missing reason -> 400 invalid_request; note over 200 -> invalid_note', async () => {
    const { app } = setup();
    expect(await code(await post(app, `/admin/reports/${ID}/reject`, {}))).toBe('invalid_request');
    expect(await code(await post(app, `/admin/reports/${ID}/reject`, { reason: 'other', note: 'ก'.repeat(201) }))).toBe('invalid_note');
  });
});

describe('fix claims, flags, hide, restore, bans', () => {
  test('claim approve/reject pass the decision; files move per the effect', async () => {
    const effect: ModerationEffect = { report: { ...opened, status: 'resolved' }, promote: [{ from: 'n/c.webp', to: `${ID}/c.webp` }], demote: [] };
    const { app, calls } = setup({ effect });
    const res = await post(app, `/admin/fix-claims/${ID}/approve`);
    expect(await res.json()).toEqual({ report: effect.report });
    await post(app, `/admin/fix-claims/${ID}/reject`);
    expect(calls.reviewFixClaim).toEqual([['admin-1', ID, true], ['admin-1', ID, false]]);
    expect(calls.promote[0]).toEqual(['n/c.webp', `${ID}/c.webp`]);
    expect(await code(await post(app, '/admin/fix-claims/x/approve'))).toBe('item_not_found');
  });

  test('resolve passes the action; an unknown action is invalid_request', async () => {
    const { app, calls } = setup();
    await post(app, `/admin/flags/${ID}/resolve`, { action: 'ban' });
    expect(calls.resolveFlags).toEqual([['admin-1', ID, 'ban']]);
    expect(await code(await post(app, `/admin/flags/${ID}/resolve`, { action: 'nuke' }))).toBe('invalid_request');
  });

  test('hide demotes per path; restore; an unknown target type is invalid_request', async () => {
    const hidden: LiveSignal = { ...opened, status: 'hidden' };
    const { app, calls } = setup({ effect: { report: hidden, promote: [], demote: [`${ID}/a.webp`] } });
    const res = await post(app, '/admin/hide', { target_type: 'report', target_id: ID });
    expect(await res.json()).toEqual({ report: hidden });
    expect(calls.hide).toEqual([['admin-1', 'report', ID]]);
    expect(calls.demote).toEqual([`${ID}/a.webp`]);
    expect(calls.broadcast).toEqual([hidden]);
    await post(app, '/admin/restore', { target_type: 'comment', target_id: ID });
    expect(calls.restore).toEqual([['admin-1', 'comment', ID]]);
    expect(await code(await post(app, '/admin/hide', { target_type: 'user', target_id: ID }))).toBe('invalid_request');
    expect(await code(await post(app, '/admin/hide', { target_type: 'comment', target_id: 'x' }))).toBe('item_not_found');
  });

  test('ban and unban; cannot_ban_admin -> 409', async () => {
    const { app, calls } = setup();
    expect(await (await post(app, `/admin/users/${ID}/ban`)).json()).toEqual({ ok: true });
    await post(app, `/admin/users/${ID}/unban`);
    expect(calls.setBan).toEqual([['admin-1', ID, true], ['admin-1', ID, false]]);
    const blocked = setup({ store: { setBan: async () => { throw new ApiError('cannot_ban_admin'); } } });
    const res = await post(blocked.app, `/admin/users/${ID}/ban`);
    expect(res.status).toBe(409);
    expect(await code(res)).toBe('cannot_ban_admin');
  });
});

describe('POST /admin/users/:id/remove-avatar', () => {
  test('clears the picture and deletes its file', async () => {
    const { app, calls } = setup();
    const res = await post(app, `/admin/users/${ID}/remove-avatar`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls.adminRemoveAvatar).toEqual([['admin-1', ID]]);
    expect(calls.removed).toEqual([['avatars', ['u/old.webp']]]);
  });

  test('a member without a picture: fine, no file to delete', async () => {
    const { app, calls } = setup({ store: { adminRemoveAvatar: async () => null } });
    expect((await post(app, `/admin/users/${ID}/remove-avatar`)).status).toBe(200);
    expect(calls.removed).toBeUndefined();
  });

  test('a member that does not exist -> 404; a bad id -> 404', async () => {
    const gone = setup({
      store: {
        adminRemoveAvatar: async () => {
          throw new ApiError('item_not_found');
        },
      },
    });
    expect((await post(gone.app, `/admin/users/${ID}/remove-avatar`)).status).toBe(404);
    expect((await post(setup().app, '/admin/users/not-an-id/remove-avatar')).status).toBe(404);
  });
});

describe('admin reads', () => {
  const pub = '/sb/storage/v1/object/public/photos-public/';
  const ref = (path: string) => ({ path, width: 10, height: 10 });
  const queueStore = (calls: unknown[][]): Partial<Store> => ({
    adminCounts: async () => ({ reports: 3, claims: 1, flags: 2 }),
    queueReports: async () => [{ id: 'q1', photos: [ref('u/a.webp')] }] as never,
    queueClaims: async () =>
      [{ id: 'c1', photo: ref('n/c.webp'), report: { id: 'r1', photos: [ref('r1/b.webp')] } }] as never,
    queueFlags: async () =>
      [
        { flag_id: 'f1', target_type: 'report', target_id: 'r1', hidden: true, report: { id: 'r1', status: 'hidden', photo: ref('r1/a.webp') }, comment: null },
        { flag_id: 'f2', target_type: 'report', target_id: 'r2', hidden: false, report: { id: 'r2', status: 'open', photo: ref('r2/a.webp') }, comment: null },
        { flag_id: 'f3', target_type: 'comment', target_id: 'c3', hidden: true, report: { id: 'r3', status: 'open', photo: ref('r3/a.webp') }, comment: { id: 'c3', body: 'x', photo: ref('r3/c.webp') } },
      ] as never,
    hiddenItems: async () => [{ target_type: 'report', target_id: 'r1', report: { id: 'r1', photo: ref('r1/a.webp') }, comment: null }] as never,
    adminUsers: async (q: string) => {
      calls.push(['users', q]);
      return [];
    },
    adminLog: async (before: number | null) => {
      calls.push(['log', before]);
      return [];
    },
  });
  const get = (app: ReturnType<typeof createApp>, path: string, auth?: string | null) => send(app, 'GET', path, undefined, auth);

  for (const path of ['/admin/counts', '/admin/queue?type=reports', '/admin/users?q=a', '/admin/log']) {
    test(`${path} needs an admin`, async () => {
      expect((await get(setup().app, path, null)).status).toBe(401);
      const member = setup({ member: { id: 'u', role: 'user', banned: false }, store: queueStore([]) });
      expect((await get(member.app, path)).status).toBe(403);
    });
  }

  test('counts', async () => {
    const { app } = setup({ store: queueStore([]) });
    expect(await (await get(app, '/admin/counts')).json()).toEqual({ reports: 3, claims: 1, flags: 2 });
  });

  test('review queue photos are signed', async () => {
    const { app } = setup({ store: queueStore([]) });
    const { items } = await (await get(app, '/admin/queue?type=reports')).json();
    expect(items[0].photos[0].url).toBe('/sb/storage/v1/object/sign/photos-private/u/a.webp?token=t');
    expect(items[0].photos[0].thumb_url).toBe('/sb/storage/v1/object/sign/photos-private/u/a_thumb.webp?token=t');
  });

  test('claims: the claim photo is signed, the report photos are public', async () => {
    const { app } = setup({ store: queueStore([]) });
    const { items } = await (await get(app, '/admin/queue?type=claims')).json();
    expect(items[0].photo.url).toContain('/object/sign/');
    expect(items[0].report.photos[0].url).toBe(`${pub}r1/b.webp`);
  });

  test('flags: a hidden report is signed, an open one public, a hidden comment photo signed', async () => {
    const { app } = setup({ store: queueStore([]) });
    const { items } = await (await get(app, '/admin/queue?type=flags')).json();
    expect(items[0].report.photo.url).toContain('/object/sign/');
    expect(items[1].report.photo.url).toBe(`${pub}r2/a.webp`);
    expect(items[2].report.photo.url).toBe(`${pub}r3/a.webp`);
    expect(items[2].comment.photo.url).toContain('/object/sign/');
  });

  test('hidden items are signed', async () => {
    const { app } = setup({ store: queueStore([]) });
    const { items } = await (await get(app, '/admin/queue?type=hidden')).json();
    expect(items[0].report.photo.url).toContain('/object/sign/');
  });

  test('an unknown or missing queue type is invalid_request', async () => {
    const { app } = setup({ store: queueStore([]) });
    expect(await code(await get(app, '/admin/queue?type=x'))).toBe('invalid_request');
    expect(await code(await get(app, '/admin/queue'))).toBe('invalid_request');
  });

  test('users: q is trimmed and cut to 100 characters', async () => {
    const calls: unknown[][] = [];
    const { app } = setup({ store: queueStore(calls) });
    expect(await (await get(app, `/admin/users?q=${encodeURIComponent('  สม  ')}`)).json()).toEqual({ users: [] });
    await get(app, `/admin/users?q=${'a'.repeat(150)}`);
    await get(app, '/admin/users');
    expect(calls).toEqual([['users', 'สม'], ['users', 'a'.repeat(100)], ['users', '']]);
  });

  test('log: before must be a positive integer', async () => {
    const calls: unknown[][] = [];
    const { app } = setup({ store: queueStore(calls) });
    expect(await code(await get(app, '/admin/log?before=abc'))).toBe('invalid_request');
    expect(await code(await get(app, '/admin/log?before=0'))).toBe('invalid_request');
    expect(await (await get(app, '/admin/log?before=20')).json()).toEqual({ entries: [] });
    await get(app, '/admin/log');
    expect(calls).toEqual([['log', 20], ['log', null]]);
  });
});