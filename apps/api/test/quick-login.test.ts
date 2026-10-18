import { describe, expect, test } from 'bun:test';
import { createApp, type AppDeps } from '../src/app';
import { ApiError } from '../src/errors';
import { createQuickLogin, DEMO_USERS, isLocalHost } from '../src/quick-login';

describe('isLocalHost', () => {
  test('accepts loopback hosts with or without a port', () => {
    expect(isLocalHost('localhost:8000')).toBe(true);
    expect(isLocalHost('127.0.0.1:8000')).toBe(true);
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('[::1]:8000')).toBe(true);
  });
  test('rejects everything else', () => {
    expect(isLocalHost('192.168.1.20:8000')).toBe(false);
    expect(isLocalHost('localhost.evil.com')).toBe(false);
    expect(isLocalHost('evil.com:localhost')).toBe(false);
    expect(isLocalHost(null)).toBe(false);
    expect(isLocalHost(undefined)).toBe(false);
    expect(isLocalHost('')).toBe(false);
  });
});

type Call = { url: string; init: RequestInit };
function fakeFetch(calls: Call[]): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: {} }), { status: 200 });
  }) as unknown as typeof fetch;
}

const make = (over: Partial<Parameters<typeof createQuickLogin>[0]> = {}, calls: Call[] = []) =>
  createQuickLogin({
    enabled: true,
    supabaseUrl: 'http://sb',
    anonKey: 'anon',
    password: 'pw',
    fetchFn: fakeFetch(calls),
    ...over,
  });

describe('createQuickLogin', () => {
  test('lists the three demo users on localhost only', () => {
    const q = make();
    expect(q.users('localhost:8000').map((u) => u.who)).toEqual(['reporter', 'neighbor1', 'admin']);
    expect(q.users('localhost:8000')[0]).toEqual({ who: 'reporter', label_th: DEMO_USERS[0].label_th });
    expect(q.users('192.168.1.20:8000')).toEqual([]);
    expect(q.users(null)).toEqual([]);
  });

  test('disabled: no users and signIn is not_found', async () => {
    const q = make({ enabled: false });
    expect(q.users('localhost:8000')).toEqual([]);
    await expect(q.signIn('localhost:8000', 'reporter')).rejects.toMatchObject({ code: 'not_found' });
  });

  test('missing password counts as disabled', async () => {
    const q = make({ password: null });
    expect(q.users('localhost:8000')).toEqual([]);
    await expect(q.signIn('localhost:8000', 'reporter')).rejects.toBeInstanceOf(ApiError);
  });

  test('unknown who and non-local host are not_found', async () => {
    const q = make();
    await expect(q.signIn('localhost:8000', 'nobody')).rejects.toMatchObject({ code: 'not_found' });
    await expect(q.signIn('192.168.1.20:8000', 'reporter')).rejects.toMatchObject({ code: 'not_found' });
  });

  test('signIn posts the demo email and password with the anon key', async () => {
    const calls: Call[] = [];
    const q = make({}, calls);
    const tokens = await q.signIn('localhost:8000', 'neighbor1');
    expect(tokens).toEqual({ access_token: 'a', refresh_token: 'r' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://sb/auth/v1/token?grant_type=password');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).apikey).toBe('anon');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ email: 'neighbor1@jaeng.local', password: 'pw' });
  });

  test('upstream failure rejects (surfaces as 500 internal)', async () => {
    const q = make({ fetchFn: (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch });
    await expect(q.signIn('localhost:8000', 'admin')).rejects.toThrow();
  });
});

describe('quick login routes', () => {
  const deps = (): AppDeps => ({
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => 'user-1',
    store: { member: async () => null, toggleConfirmation: async () => { throw new Error('x'); }, addComment: async () => { throw new Error('x'); } },
    broadcast: async () => {},
    quickLogin: make(),
  });
  const req = (path: string, host: string, init?: RequestInit) =>
    createApp(deps()).handle(new Request(`http://internal${path}`, { ...init, headers: { host, 'content-type': 'application/json' } }));

  test('/config lists 3 users from localhost and none from a LAN IP', async () => {
    const local = await (await req('/config', 'localhost:8000')).json();
    expect(local.supabaseAnonKey).toBe('k');
    expect(local.quickLogin).toHaveLength(3);
    const lan = await (await req('/config', '192.168.1.20:8000')).json();
    expect(lan.quickLogin).toEqual([]);
  });

  test('POST /dev/quick-login returns tokens on localhost, 404 on LAN', async () => {
    const ok = await req('/dev/quick-login', 'localhost:8000', { method: 'POST', body: JSON.stringify({ who: 'reporter' }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ access_token: 'a', refresh_token: 'r' });
    const lan = await req('/dev/quick-login', '192.168.1.20:8000', { method: 'POST', body: JSON.stringify({ who: 'reporter' }) });
    expect(lan.status).toBe(404);
    const bad = await req('/dev/quick-login', 'localhost:8000', { method: 'POST', body: '{}' });
    expect(bad.status).toBe(404);
  });
});
