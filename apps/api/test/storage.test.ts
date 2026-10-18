import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabasePhotoStorage } from '../src/photos/storage';

function fakeClient() {
  const log: unknown[][] = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _b: unknown, opts: unknown) => (log.push(['upload', bucket, path, opts]), { error: null }),
        remove: async (paths: string[]) => (log.push(['remove', bucket, paths]), { error: null }),
        move: async (src: string, dst: string, opts: unknown) => (log.push(['move', bucket, src, dst, opts]), { error: null }),
        createSignedUrl: async (path: string, sec: number) => (
          log.push(['sign', bucket, path, sec]), { data: { signedUrl: 'http://x/s' }, error: null }
        ),
      }),
    },
  } as unknown as SupabaseClient;
  return { client, log };
}

describe('createSupabasePhotoStorage', () => {
  test('promote moves the file and its thumbnail from private to public', async () => {
    const { client, log } = fakeClient();
    await createSupabasePhotoStorage(client).promote('u/p.webp', 'u/p.webp');
    expect(log).toEqual([
      ['move', 'photos-private', 'u/p.webp', 'u/p.webp', { destinationBucket: 'photos-public' }],
      ['move', 'photos-private', 'u/p_thumb.webp', 'u/p_thumb.webp', { destinationBucket: 'photos-public' }],
    ]);
  });

  test('put uploads with webp content type; signedUrl reads photos-private', async () => {
    const { client, log } = fakeClient();
    const s = createSupabasePhotoStorage(client);
    await s.put('photos-private', 'u/p.webp', new Uint8Array([1]));
    expect(await s.signedUrl('u/p.webp', 60)).toBe('http://x/s');
    expect(log[0]).toEqual(['upload', 'photos-private', 'u/p.webp', { contentType: 'image/webp', upsert: false }]);
    expect(log[1]).toEqual(['sign', 'photos-private', 'u/p.webp', 60]);
  });

  test('a storage error throws', async () => {
    const client = {
      storage: { from: () => ({ move: async () => ({ error: { message: 'nope' } }) }) },
    } as unknown as SupabaseClient;
    await expect(createSupabasePhotoStorage(client).promote('a', 'b')).rejects.toThrow('nope');
  });
});
