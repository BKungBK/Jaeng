import { describe, expect, test } from 'bun:test';
import type { PublicComment, ReportSignal } from '@jaeng/shared/api';
import { createApp, type AppDeps } from '../src/app';
import { ApiError } from '../src/errors';
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

function setup(over: { store?: Partial<Store>; member?: Member | null } = {}) {
  const calls = { toggle: 0, add: [] as string[], broadcast: [] as ReportSignal[] };
  const store: Store = {
    member: async () => (over.member === undefined ? { id: 'user-1', role: 'user', banned: false } : over.member),
    toggleConfirmation: async () => {
      calls.toggle++;
      return { confirmed: true, report };
    },
    addComment: async (_r, _u, body) => {
      calls.add.push(body);
      return { comment, report };
    },
    ...over.store,
  };
  const deps: AppDeps = {
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => 'user-1',
    store,
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
