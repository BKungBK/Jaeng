import { describe, expect, test } from 'bun:test';
import { createApp, type AppDeps } from '../src/app';
import type { Store } from '../src/store';

function setup() {
  const calls = [] as [string, { display_name?: string; locale?: 'th' | 'en'; complete?: boolean }][];
  const store = {
    member: async () => ({ id: 'user-1', role: 'user', banned: false }),
    updateMe: async (uid: string, patch: { display_name?: string; locale?: 'th' | 'en'; complete?: boolean }) => {
      calls.push([uid, patch]);
      return { display_name: patch.display_name ?? 'เดิม', locale: patch.locale ?? 'th', avatar_path: null, onboarded: patch.complete === true };
    },
  } as unknown as Store;
  const deps = {
    checkDb: async () => true,
    anonKey: 'k',
    verify: async () => 'user-1',
    quickLogin: { users: () => [], signIn: async () => { throw new Error('unused'); } },
    store,
    broadcast: async () => {},
    photos: {} as AppDeps['photos'],
    rateLimits: { reports: 5, comments: 30, photos: 40, fixClaims: 10, flags: 20, avatars: 10 },
  } as AppDeps;
  return { app: createApp(deps), calls };
}

const patch = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.handle(
    new Request('http://localhost/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
      body: JSON.stringify(body),
    }),
  );

describe('PATCH /me with complete_profile', () => {
  test('saves the nickname and marks the profile set up', async () => {
    const { app, calls } = setup();
    const res = await patch(app, { display_name: '  น้องเมย์ ', complete_profile: true });
    expect(res.status).toBe(200);
    expect((await res.json()).onboarded).toBe(true);
    expect(calls).toEqual([['user-1', { display_name: 'น้องเมย์', complete: true }]]);
  });

  test('without a nickname -> 400 invalid_request', async () => {
    const { app, calls } = setup();
    const res = await patch(app, { complete_profile: true, locale: 'th' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
    expect(calls).toEqual([]);
  });

  test.each([
    ['a number', 1],
    ['a string', 'true'],
  ])('complete_profile as %s -> 400 invalid_request', async (_n, complete_profile) => {
    const { app, calls } = setup();
    expect((await patch(app, { display_name: 'น้องเมย์', complete_profile })).status).toBe(400);
    expect(calls).toEqual([]);
  });

  test.each([
    ['one character', 'ก', 400, 'invalid_display_name'],
    ['invisible characters', '​​​', 400, 'invalid_display_name'],
    ['a newline inside', 'สม\nชาย', 400, 'invalid_display_name'],
    ['a rude word', 'ไอ้เหี้ย', 422, 'profanity'],
  ])('a nickname with %s is refused and nothing is saved', async (_n, display_name, status, code) => {
    const { app, calls } = setup();
    const res = await patch(app, { display_name, complete_profile: true });
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
    expect(calls).toEqual([]);
  });

  test('complete_profile: false behaves like a plain rename', async () => {
    const { app, calls } = setup();
    expect((await patch(app, { display_name: 'สมชาย', complete_profile: false })).status).toBe(200);
    expect(calls).toEqual([['user-1', { display_name: 'สมชาย' }]]);
  });
});
