import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';
import { PHOTO_MAX_BYTES } from '@jaeng/shared/report';
import { createApp, type AppDeps } from '../src/app';
import { ApiError } from '../src/errors';
import type { PhotoStorage } from '../src/photos/storage';
import type { Member, Store } from '../src/store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Over = { store?: Partial<Store>; storage?: Partial<PhotoStorage>; member?: Member | null };

function setup(over: Over = {}) {
  const calls = {
    puts: [] as { bucket: string; path: string }[],
    registered: [] as { p: Parameters<Store['registerPhoto']>[0]; limit: number }[],
    deleted: [] as string[],
    member: 0,
  };
  const store = {
    member: async () => {
      calls.member++;
      return over.member === undefined ? { id: 'user-1', role: 'user', banned: false } : over.member;
    },
    registerPhoto: async (p, limit) => {
      calls.registered.push({ p, limit });
    },
    deletePhoto: async (id: string) => {
      calls.deleted.push(id);
    },
    ...over.store,
  } as Store;
  const photos: PhotoStorage = {
    put: async (bucket, path) => {
      calls.puts.push({ bucket, path });
    },
    remove: async () => {},
    promote: async () => {},
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
    rateLimits: { reports: 5, comments: 30, photos: 7 },
  };
  return { app: createApp(deps), calls };
}

const realJpeg = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: '#468' } }).jpeg().toBuffer();

function upload(app: ReturnType<typeof createApp>, file: BodyInit | null, name = 'a.jpg', type = 'image/jpeg', auth: string | null = 'Bearer tok') {
  const form = new FormData();
  if (file !== null) form.append('file', new File([file], name, { type }));
  else form.append('other', 'x');
  return app.handle(
    new Request('http://localhost/photos', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: form }),
  );
}

describe('POST /photos', () => {
  test('success -> 201, two puts into photos-private, registerPhoto with limit', async () => {
    const { app, calls } = setup();
    const res = await upload(app, await realJpeg());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.photo_id).toMatch(UUID);
    expect(body.width).toBe(64);
    expect(body.height).toBe(48);
    expect(calls.puts).toEqual([
      { bucket: 'photos-private', path: `user-1/${body.photo_id}.webp` },
      { bucket: 'photos-private', path: `user-1/${body.photo_id}_thumb.webp` },
    ]);
    expect(calls.registered).toHaveLength(1);
    expect(calls.registered[0].limit).toBe(7);
    expect(calls.registered[0].p).toMatchObject({
      id: body.photo_id,
      uploaderId: 'user-1',
      path: `user-1/${body.photo_id}.webp`,
      width: 64,
      height: 48,
      blurred: false,
    });
  });

  test('no token -> 401, store untouched', async () => {
    const { app, calls } = setup();
    const res = await upload(app, await realJpeg(), 'a.jpg', 'image/jpeg', null);
    expect(res.status).toBe(401);
    expect(calls.member).toBe(0);
    expect(calls.registered).toHaveLength(0);
  });

  test('banned user -> 403', async () => {
    const { app, calls } = setup({ member: { id: 'user-1', role: 'user', banned: true } });
    const res = await upload(app, await realJpeg());
    expect(res.status).toBe(403);
    expect(calls.registered).toHaveLength(0);
  });

  test('text file named x.jpg with image/jpeg -> 415', async () => {
    const { app, calls } = setup();
    const res = await upload(app, 'definitely not an image', 'x.jpg', 'image/jpeg');
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe('invalid_photo');
    expect(calls.registered).toHaveLength(0);
  });

  test('3 MB + 1 -> 413', async () => {
    const { app, calls } = setup();
    const big = new Uint8Array(PHOTO_MAX_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    const res = await upload(app, big);
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('photo_too_large');
    expect(calls.registered).toHaveLength(0);
  });

  test('missing file field -> 400 invalid_request', async () => {
    const { app } = setup();
    const res = await upload(app, null);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
  });

  test('rate_limited from the store -> 429 and nothing stored', async () => {
    const { app, calls } = setup({
      store: {
        registerPhoto: async () => {
          throw new ApiError('rate_limited');
        },
      },
    });
    const res = await upload(app, await realJpeg());
    expect(res.status).toBe(429);
    expect(calls.puts).toHaveLength(0);
  });

  test('put failure -> 500 internal and the new row is deleted', async () => {
    let n = 0;
    const { app, calls } = setup({
      storage: {
        put: async () => {
          if (++n === 2) throw new Error('storage down');
        },
      },
    });
    const res = await upload(app, await realJpeg());
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('internal');
    expect(calls.registered).toHaveLength(1);
    expect(calls.deleted).toEqual([calls.registered[0].p.id]);
  });
});
