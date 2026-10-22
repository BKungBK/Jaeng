import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';
import { AVATAR_SIDE, PHOTO_MAX_BYTES } from '@jaeng/shared/report';
import { createApp, type AppDeps } from '../src/app';
import { ApiError } from '../src/errors';
import type { Bucket, PhotoStorage } from '../src/photos/storage';
import type { Member, Store } from '../src/store';

const UUID_PATH = /^user-1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

type Over = { store?: Partial<Store>; storage?: Partial<PhotoStorage>; member?: Member | null; avatar?: string | null };

function setup(over: Over = {}) {
  const calls = {
    puts: [] as { bucket: Bucket; path: string; bytes: Uint8Array }[],
    removed: [] as { bucket: Bucket; paths: string[] }[],
    setAvatar: [] as { userId: string; path: string | null; limit: number }[],
  };
  // what the member has now: the store answers with the path a new one replaces
  let current: string | null = over.avatar ?? null;
  const store = {
    member: async () => (over.member === undefined ? { id: 'user-1', role: 'user', banned: false } : over.member),
    setAvatar: async (userId: string, path: string | null, limit: number) => {
      calls.setAvatar.push({ userId, path, limit });
      const previous = current;
      current = path;
      return previous;
    },
    ...over.store,
  } as Store;
  const photos: PhotoStorage = {
    put: async (bucket, path, bytes) => {
      calls.puts.push({ bucket, path, bytes });
    },
    remove: async (bucket, paths) => {
      calls.removed.push({ bucket, paths });
    },
    promote: async () => {},
    demote: async () => {},
    signedUrl: async () => null,
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
    rateLimits: { reports: 5, comments: 30, photos: 40, fixClaims: 10, flags: 20, avatars: 3 },
  } as AppDeps;
  return { app: createApp(deps), calls };
}

/** A tall photo with the real-world quirks of a phone picture: EXIF data, not square. */
const phonePhoto = () =>
  sharp({ create: { width: 300, height: 600, channels: 3, background: '#468' } })
    .withExif({ IFD0: { Copyright: 'someone' } })
    .jpeg()
    .toBuffer();

function put(app: ReturnType<typeof createApp>, file: BodyInit | null, auth: string | null = 'Bearer tok', name = 'me.jpg') {
  const form = new FormData();
  if (file !== null) form.append('file', new File([file], name, { type: 'image/jpeg' }));
  else form.append('other', 'x');
  return app.handle(new Request('http://localhost/me/avatar', { method: 'PUT', headers: auth ? { authorization: auth } : {}, body: form }));
}

const del = (app: ReturnType<typeof createApp>, auth: string | null = 'Bearer tok') =>
  app.handle(new Request('http://localhost/me/avatar', { method: 'DELETE', headers: auth ? { authorization: auth } : {} }));

describe('PUT /me/avatar', () => {
  test('stores a 256 px square WebP without metadata in the avatars bucket, then records the path', async () => {
    const { app, calls } = setup();
    const res = await put(app, await phonePhoto());
    expect(res.status).toBe(200);
    const { avatar_path } = await res.json();
    expect(avatar_path).toMatch(UUID_PATH);
    expect(calls.puts).toHaveLength(1);
    expect(calls.puts[0].bucket).toBe('avatars');
    expect(calls.puts[0].path).toBe(avatar_path);
    const meta = await sharp(calls.puts[0].bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', AVATAR_SIDE, AVATAR_SIDE]);
    expect(meta.exif).toBeUndefined();
    expect(calls.setAvatar).toEqual([{ userId: 'user-1', path: avatar_path, limit: 3 }]);
  });

  test('changing it deletes the previous file', async () => {
    const { app, calls } = setup({ avatar: 'user-1/old.webp' });
    const res = await put(app, await phonePhoto());
    expect(res.status).toBe(200);
    expect(calls.removed).toEqual([{ bucket: 'avatars', paths: ['user-1/old.webp'] }]);
  });

  test('a failed delete of the old file does not fail the change', async () => {
    const { app } = setup({
      avatar: 'user-1/old.webp',
      storage: {
        remove: async () => {
          throw new Error('storage down');
        },
      },
    });
    expect((await put(app, await phonePhoto())).status).toBe(200);
  });

  test('no token -> 401, nothing stored', async () => {
    const { app, calls } = setup();
    expect((await put(app, await phonePhoto(), null)).status).toBe(401);
    expect(calls.puts).toHaveLength(0);
  });

  test('a banned member -> 403', async () => {
    const { app, calls } = setup({ member: { id: 'user-1', role: 'user', banned: true } });
    expect((await put(app, await phonePhoto())).status).toBe(403);
    expect(calls.puts).toHaveLength(0);
  });

  test('a text file named me.jpg -> 415 invalid_photo', async () => {
    const { app, calls } = setup();
    const res = await put(app, 'not an image at all');
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe('invalid_photo');
    expect(calls.puts).toHaveLength(0);
  });

  test('a truncated image with a real header -> 415, nothing stored', async () => {
    const { app, calls } = setup();
    const whole = await phonePhoto();
    const res = await put(app, whole.subarray(0, 40));
    expect(res.status).toBe(415);
    expect(calls.puts).toHaveLength(0);
  });

  test('over 3 MB -> 413 photo_too_large', async () => {
    const { app, calls } = setup();
    const big = new Uint8Array(PHOTO_MAX_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    const res = await put(app, big);
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('photo_too_large');
    expect(calls.puts).toHaveLength(0);
  });

  test('no file field -> 400 invalid_request', async () => {
    const { app } = setup();
    const res = await put(app, null);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
  });

  test('over the daily limit -> 429 and the file just stored is removed again', async () => {
    const { app, calls } = setup({
      store: {
        setAvatar: async () => {
          throw new ApiError('rate_limited');
        },
      },
    });
    const res = await put(app, await phonePhoto());
    expect(res.status).toBe(429);
    expect(calls.puts).toHaveLength(1);
    expect(calls.removed).toEqual([{ bucket: 'avatars', paths: [calls.puts[0].path] }]);
  });

  test('storage failure -> 500 and the path is never recorded', async () => {
    const { app, calls } = setup({
      storage: {
        put: async () => {
          throw new Error('storage down');
        },
      },
    });
    const res = await put(app, await phonePhoto());
    expect(res.status).toBe(500);
    expect(calls.setAvatar).toHaveLength(0);
  });
});

describe('DELETE /me/avatar', () => {
  test('clears the path and deletes the file', async () => {
    const { app, calls } = setup({ avatar: 'user-1/old.webp' });
    const res = await del(app);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ avatar_path: null });
    expect(calls.setAvatar).toEqual([{ userId: 'user-1', path: null, limit: 3 }]);
    expect(calls.removed).toEqual([{ bucket: 'avatars', paths: ['user-1/old.webp'] }]);
  });

  test('twice in a row is fine and deletes nothing the second time', async () => {
    const { app, calls } = setup({ avatar: 'user-1/old.webp' });
    expect((await del(app)).status).toBe(200);
    expect((await del(app)).status).toBe(200);
    expect(calls.removed).toHaveLength(1);
  });

  test('no token -> 401', async () => {
    const { app, calls } = setup();
    expect((await del(app, null)).status).toBe(401);
    expect(calls.setAvatar).toHaveLength(0);
  });
});
