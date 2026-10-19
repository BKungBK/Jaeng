import { blobOf, gpsJpeg } from './gps-jpeg.testing';
import { compressImage, fitWithin, PhotoTooLargeError, readGps } from './photo-tools';

describe('readGps', () => {
  it('reads Bangkok', async () => {
    const p = await readGps(blobOf(gpsJpeg({ lat: 13.75, latRef: 'N', lng: 100.5, lngRef: 'E' })));
    expect(p).not.toBeNull();
    expect(p!.lng).toBeCloseTo(100.5, 3);
    expect(p!.lat).toBeCloseTo(13.75, 3);
  });

  it('applies the S and W references', async () => {
    // southern and western hemispheres land outside Thailand, so check the signs through the
    // bounding box: S of the equator is never inside, but flipping only the right ref must matter
    const north = await readGps(blobOf(gpsJpeg({ lat: 13.75, latRef: 'N', lng: 100.5, lngRef: 'E' })));
    const south = await readGps(blobOf(gpsJpeg({ lat: 13.75, latRef: 'S', lng: 100.5, lngRef: 'E' })));
    const west = await readGps(blobOf(gpsJpeg({ lat: 13.75, latRef: 'N', lng: 100.5, lngRef: 'W' })));
    expect(north).not.toBeNull();
    expect(south).toBeNull(); // -13.75 is outside Thailand
    expect(west).toBeNull(); // -100.5 is outside Thailand
  });

  it('returns null without EXIF', async () => {
    expect(await readGps(blobOf(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])))).toBeNull();
  });

  it('returns null for a position outside Thailand', async () => {
    expect(await readGps(blobOf(gpsJpeg({ lat: 33.8, latRef: 'S', lng: 151.2, lngRef: 'E' })))).toBeNull();
  });

  it('returns null for corrupt bytes without throwing', async () => {
    expect(await readGps(blobOf(new Uint8Array([1, 2, 3, 4, 5])))).toBeNull();
    const bad = gpsJpeg({ lat: 13.75, latRef: 'N', lng: 100.5, lngRef: 'E' }).slice(0, 40);
    expect(await readGps(blobOf(bad))).toBeNull();
    expect(await readGps(new Blob([]))).toBeNull();
  });
});

describe('fitWithin', () => {
  it('scales the long side down to max', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never enlarges', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('never returns a zero side', () => {
    expect(fitWithin(10000, 10, 1600)).toEqual({ width: 1600, height: 2 });
    expect(fitWithin(100000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('compressImage', () => {
  const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
  const blob = (type: string, size: number) => new Blob([new Uint8Array(size)], { type });
  const MB = 1024 * 1024;

  function deps(encode: (type: string, quality: number, maxSide: number) => Promise<Blob>, size = { width: 4000, height: 3000 }) {
    return { decode: vi.fn().mockResolvedValue(size), encode: vi.fn(encode), dispose: vi.fn() };
  }

  it('uses WebP 0.8 at 1600 px when the browser can encode it', async () => {
    const d = deps(async (type) => blob(type, 500_000));
    const out = await compressImage(file, d);
    expect(d.encode).toHaveBeenCalledTimes(1);
    expect(d.encode).toHaveBeenCalledWith('image/webp', 0.8, 1600);
    expect(out).toMatchObject({ type: 'image/webp', width: 1600, height: 1200 });
    expect(out.blob.size).toBe(500_000);
  });

  it('falls back to JPEG 0.82 when the browser answers with another type (Safari)', async () => {
    const d = deps(async (type) => blob(type === 'image/webp' ? 'image/png' : type, 400_000));
    const out = await compressImage(file, d);
    expect(d.encode.mock.calls).toEqual([
      ['image/webp', 0.8, 1600],
      ['image/jpeg', 0.82, 1600],
    ]);
    expect(out.type).toBe('image/jpeg');
  });

  it('retries at 0.7 and then at 1200 px when the result is over 3 MB', async () => {
    const d = deps(async (type, q, side) => blob(type, side === 1200 ? 2 * MB : 4 * MB));
    const out = await compressImage(file, d);
    expect(d.encode.mock.calls).toEqual([
      ['image/webp', 0.8, 1600],
      ['image/webp', 0.7, 1600],
      ['image/webp', 0.7, 1200],
    ]);
    expect(out).toMatchObject({ type: 'image/webp', width: 1200, height: 900 });
  });

  it('stops at 0.7 when that is small enough', async () => {
    const d = deps(async (type, q) => blob(type, q === 0.7 ? 2 * MB : 4 * MB));
    const out = await compressImage(file, d);
    expect(d.encode).toHaveBeenCalledTimes(2);
    expect(out.width).toBe(1600);
  });

  it('keeps JPEG through the retries when WebP is unsupported', async () => {
    const d = deps(async (type, q, side) =>
      type === 'image/webp' ? blob('image/png', 10) : blob(type, side === 1200 ? 1 * MB : 4 * MB),
    );
    const out = await compressImage(file, d);
    expect(out.type).toBe('image/jpeg');
    expect(d.encode.mock.calls).toEqual([
      ['image/webp', 0.8, 1600],
      ['image/jpeg', 0.82, 1600],
      ['image/jpeg', 0.7, 1600],
      ['image/jpeg', 0.7, 1200],
    ]);
  });

  it('throws PhotoTooLargeError with a Thai message when still over 3 MB', async () => {
    const d = deps(async (type) => blob(type, 5 * MB));
    const err = await compressImage(file, d).catch((e) => e);
    expect(err).toBeInstanceOf(PhotoTooLargeError);
    expect(err.messageTh).toBe('รูปใหญ่เกินไป (ไม่เกิน 3 MB)');
  });

  it('follows fitWithin for the output size of a small photo', async () => {
    const d = deps(async (type) => blob(type, 1000), { width: 800, height: 600 });
    expect(await compressImage(file, d)).toMatchObject({ width: 800, height: 600 });
  });

  it('frees the decoded image once, after a success', async () => {
    const d = deps(async (type) => blob(type, 1000));
    await compressImage(file, d);
    expect(d.dispose).toHaveBeenCalledTimes(1);
  });

  it('frees the decoded image when the photo is too large or encoding fails', async () => {
    const big = deps(async (type) => blob(type, 5 * MB));
    await compressImage(file, big).catch(() => undefined);
    expect(big.dispose).toHaveBeenCalledTimes(1);
    const broken = deps(async () => {
      throw new Error('encode failed');
    });
    await compressImage(file, broken).catch(() => undefined);
    expect(broken.dispose).toHaveBeenCalledTimes(1);
  });
});
