import { describe, expect, test } from 'bun:test';
import { createApp, type AppDeps } from '../src/app';

const deps = (over: Partial<AppDeps> = {}): AppDeps => ({
  checkDb: async () => true,
  anonKey: 'k',
  verify: async () => 'user-1',
  store: {
    member: async () => null,
    toggleConfirmation: async () => {
      throw new Error('unused');
    },
    addComment: async () => {
      throw new Error('unused');
    },
  },
  broadcast: async () => {},
  ...over,
});

const get = (app: ReturnType<typeof createApp>, path: string) =>
  app.handle(new Request(`http://localhost${path}`));

describe('GET /health', () => {
  test('health ok', async () => {
    const res = await get(createApp(deps()), '/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  test('health db down', async () => {
    const res = await get(createApp(deps({ checkDb: async () => false })), '/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: false });
  });

  test('health db throws', async () => {
    const app = createApp(
      deps({
        checkDb: async () => {
          throw new Error('connection refused');
        },
      }),
    );
    const res = await get(app, '/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: false });
  });
});

describe('GET /config', () => {
  test('config', async () => {
    const res = await get(createApp(deps()), '/config');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ supabaseAnonKey: 'k' });
  });
});

describe('onError', () => {
  test('unknown route answers the not_found error body', async () => {
    const res = await get(createApp(deps()), '/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'not_found', message_th: 'ไม่พบหน้านี้', message_en: 'Not found.' },
    });
  });
});
