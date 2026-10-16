import { describe, expect, test } from 'bun:test';
import { createApp } from '../src/app';

const get = (app: ReturnType<typeof createApp>, path: string) =>
  app.handle(new Request(`http://localhost${path}`));

describe('GET /health', () => {
  test('health ok', async () => {
    const res = await get(createApp({ checkDb: async () => true, anonKey: 'k' }), '/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  test('health db down', async () => {
    const res = await get(createApp({ checkDb: async () => false, anonKey: 'k' }), '/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: false });
  });

  test('health db throws', async () => {
    const app = createApp({
      checkDb: async () => {
        throw new Error('connection refused');
      },
      anonKey: 'k',
    });
    const res = await get(app, '/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: false });
  });
});

describe('GET /config', () => {
  test('config', async () => {
    const res = await get(createApp({ checkDb: async () => true, anonKey: 'k' }), '/config');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ supabaseAnonKey: 'k' });
  });
});
