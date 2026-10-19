import { expect, test } from 'bun:test';
import { PUBLIC_PREFIX, toAdminPhoto } from '../src/moderation/photo-urls';

const ref = { path: 'r/p.webp', width: 800, height: 600 };

function signer(result: string | null = 'http://kong:8000/storage/v1/object/sign/photos-private/x?token=t') {
  const calls: [string, number][] = [];
  return {
    calls,
    photos: {
      signedUrl: async (path: string, sec: number) => {
        calls.push([path, sec]);
        return result;
      },
    },
  };
}

test('a public photo uses the public bucket URL and never signs', async () => {
  const s = signer();
  const p = await toAdminPhoto(s.photos, ref, true);
  expect(p).toEqual({ ...ref, url: `${PUBLIC_PREFIX}r/p.webp`, thumb_url: `${PUBLIC_PREFIX}r/p_thumb.webp` });
  expect(PUBLIC_PREFIX).toBe('/sb/storage/v1/object/public/photos-public/');
  expect(s.calls).toEqual([]);
});

test('a private photo signs the file and the thumbnail for an hour, same origin', async () => {
  const s = signer();
  const p = await toAdminPhoto(s.photos, ref, false);
  expect(s.calls).toEqual([['r/p.webp', 3600], ['r/p_thumb.webp', 3600]]);
  expect(p.url.startsWith('/sb/storage/v1/object/sign/')).toBe(true);
  expect(p.thumb_url.startsWith('/sb/storage/v1/object/sign/')).toBe(true);
  expect(p.width).toBe(800);
});

test('a failed signing gives an empty URL', async () => {
  const p = await toAdminPhoto(signer(null).photos, ref, false);
  expect(p.url).toBe('');
  expect(p.thumb_url).toBe('');
});
