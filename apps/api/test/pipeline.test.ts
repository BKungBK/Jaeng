import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';
import { ApiError } from '../src/errors';
import { makeThumb, reencode, sniffImage } from '../src/photos/pipeline';
import { processForPrivacy } from '../src/photos/privacy';

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 60, b: 30 } } }).png().toBuffer();
const jpeg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 90, b: 200 } } }).jpeg().toBuffer();
const webp = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 90, b: 200 } } }).webp().toBuffer();

async function rejects(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected rejection');
}

describe('sniffImage', () => {
  test('real JPEG, PNG and WebP', async () => {
    expect(sniffImage(await jpeg(8, 8))).toBe('jpeg');
    expect(sniffImage(await png(8, 8))).toBe('png');
    expect(sniffImage(await webp(8, 8))).toBe('webp');
  });

  test('text, empty, RIFF that is not WEBP, and GIF are null', () => {
    expect(sniffImage(new TextEncoder().encode('hello world, not an image'))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WAVEfmt '))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('GIF89a\x01\0\x01\0'))).toBeNull();
  });
});

describe('reencode', () => {
  test('2400x1800 PNG becomes a 1600x1200 WebP', async () => {
    const out = await reencode(await png(2400, 1800));
    expect([out.width, out.height]).toEqual([1600, 1200]);
    const meta = await sharp(out.image).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([1600, 1200]);
  });

  test('small image is not enlarged', async () => {
    const out = await reencode(await png(300, 200));
    expect([out.width, out.height]).toEqual([300, 200]);
  });

  test('EXIF and ICC are stripped', async () => {
    const src = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#888' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'SecretMake', Orientation: '1' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '13/1 45/1 0/1' } })
      .withIccProfile('srgb')
      .toBuffer();
    expect(Buffer.from(src).includes('Exif')).toBe(true);
    const out = await reencode(src);
    const meta = await sharp(out.image).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(out.image.includes('Exif')).toBe(false);
    expect(out.image.includes('SecretMake')).toBe(false);
  });

  test('EXIF orientation 6 rotates a 400x200 JPEG to 200x400', async () => {
    const src = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#888' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(src).metadata()).orientation).toBe(6);
    const out = await reencode(src);
    expect([out.width, out.height]).toEqual([200, 400]);
    const meta = await sharp(out.image).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
  });

  test('8000x6000 PNG (over 40 MP) -> invalid_photo', async () => {
    const e = await rejects(reencode(await png(8000, 6000)));
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe('invalid_photo');
  });

  test('random bytes with a JPEG header -> invalid_photo', async () => {
    const bytes = new Uint8Array(2000);
    crypto.getRandomValues(bytes);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    const e = await rejects(reencode(bytes));
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe('invalid_photo');
  });
});

describe('makeThumb', () => {
  test('long side is 400', async () => {
    const meta = await sharp(await makeThumb(await webp(1600, 1200))).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([400, 300, 'webp']);
  });

  test('smaller image is not enlarged', async () => {
    const meta = await sharp(await makeThumb(await webp(300, 200))).metadata();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });
});

describe('processForPrivacy', () => {
  test('returns the same buffer, not blurred', async () => {
    const buf = await webp(20, 20);
    const out = await processForPrivacy(buf);
    expect(out.image).toBe(buf);
    expect(out.blurred).toBe(false);
  });
});
