import {
  compressImage,
  fitWithin,
  PhotoTooLargeError,
  readGps,
  type CompressDeps,
} from './photo-tools';

// ---- a real tiny JPEG with an EXIF GPS IFD, built byte by byte ----

type Gps = { lat: number; latRef: 'N' | 'S'; lng: number; lngRef: 'E' | 'W' };

/** degrees, minutes and seconds (in thousandths) of a non-negative decimal angle */
function dms(v: number): [number, number, number] {
  const d = Math.floor(v);
  const mFull = (v - d) * 60;
  const m = Math.floor(mFull);
  return [d, m, Math.round((mFull - m) * 60 * 1000)];
}

function gpsJpeg(g: Gps): Uint8Array {
  const tiff = new Uint8Array(128);
  const dv = new DataView(tiff.buffer);
  const LE = true;
  tiff.set([0x49, 0x49]); // 'II'
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, 8, LE); // IFD0 at 8
  // IFD0: one entry, GPSInfo pointer
  dv.setUint16(8, 1, LE);
  dv.setUint16(10, 0x8825, LE);
  dv.setUint16(12, 4, LE); // LONG
  dv.setUint32(14, 1, LE);
  dv.setUint32(18, 26, LE); // GPS IFD offset
  dv.setUint32(22, 0, LE); // no next IFD
  // GPS IFD at 26: four entries, sorted by tag
  dv.setUint16(26, 4, LE);
  const entry = (i: number, tag: number, type: number, count: number, value: number | number[]) => {
    const o = 28 + i * 12;
    dv.setUint16(o, tag, LE);
    dv.setUint16(o + 2, type, LE);
    dv.setUint32(o + 4, count, LE);
    if (typeof value === 'number') dv.setUint32(o + 8, value, LE);
    else tiff.set(value, o + 8);
  };
  entry(0, 0x0001, 2, 2, [g.latRef.charCodeAt(0), 0]);
  entry(1, 0x0002, 5, 3, 80);
  entry(2, 0x0003, 2, 2, [g.lngRef.charCodeAt(0), 0]);
  entry(3, 0x0004, 5, 3, 104);
  dv.setUint32(28 + 48, 0, LE); // no next IFD
  const rationals = (at: number, [d, m, s]: [number, number, number]) => {
    dv.setUint32(at, d, LE);
    dv.setUint32(at + 4, 1, LE);
    dv.setUint32(at + 8, m, LE);
    dv.setUint32(at + 12, 1, LE);
    dv.setUint32(at + 16, s, LE);
    dv.setUint32(at + 20, 1000, LE);
  };
  rationals(80, dms(g.lat));
  rationals(104, dms(g.lng));

  const exifHead = [0x45, 0x78, 0x69, 0x66, 0, 0]; // 'Exif\0\0'
  const app1Len = 2 + exifHead.length + tiff.length;
  const out = new Uint8Array(2 + 2 + 2 + exifHead.length + tiff.length + 2);
  let o = 0;
  out.set([0xff, 0xd8, 0xff, 0xe1, app1Len >> 8, app1Len & 0xff], o);
  o += 6;
  out.set(exifHead, o);
  o += exifHead.length;
  out.set(tiff, o);
  o += tiff.length;
  out.set([0xff, 0xd9], o);
  return out;
}

const blobOf = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'image/jpeg' });

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
    return { decode: vi.fn().mockResolvedValue(size), encode: vi.fn(encode) };
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
    expect(d.encode.mock.calls.at(-1)).toEqual(['image/jpeg', 0.7, 1200]);
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
});
