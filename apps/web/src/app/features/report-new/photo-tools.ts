import { InjectionToken } from '@angular/core';
import { inThailand, PHOTO_MAX_BYTES, PHOTO_MAX_SIDE } from '@jaeng/shared/report';
import { gps } from 'exifr/dist/lite.esm.mjs';
import type { LngLat } from '../../core/device.service';

export const MSG_PHOTO_TOO_LARGE = 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)';

export class PhotoTooLargeError extends Error {
  readonly messageTh = MSG_PHOTO_TOO_LARGE;
  constructor() {
    super('photo too large');
  }
}

/** Where the photo was taken, from its EXIF. null when absent, unreadable or outside Thailand. */
export async function readGps(file: Blob): Promise<LngLat | null> {
  try {
    const g = await gps(file);
    const lng = g?.longitude;
    const lat = g?.latitude;
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return inThailand(lng, lat) ? { lng, lat } : null;
  } catch {
    return null;
  }
}

/** Keeps the aspect ratio, never enlarges, never returns a zero side. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  if (scale === 1) return { width, height };
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type CompressedPhoto = { blob: Blob; width: number; height: number; type: 'image/webp' | 'image/jpeg' };

export type CompressDeps = {
  /** size of the image as it looks (EXIF orientation applied) */
  decode(file: File): Promise<{ width: number; height: number }>;
  /** draw the decoded image within maxSide and encode it; the browser may return another type than asked */
  encode(type: string, quality: number, maxSide: number): Promise<Blob>;
  /** free the decoded image (a phone photo holds ~50 MB of pixels); called once, whatever happened */
  dispose?(): void;
};

const MAX_SIDE_RETRY = 1200;

/** The three tries, smallest last. JPEG starts a little higher than WebP because it compresses
 *  less well at the same setting; the retries use 0.7 for both. */
const TRIES = [
  { webp: 0.8, jpeg: 0.82, maxSide: PHOTO_MAX_SIDE },
  { webp: 0.7, jpeg: 0.7, maxSide: PHOTO_MAX_SIDE },
  { webp: 0.7, jpeg: 0.7, maxSide: MAX_SIDE_RETRY },
] as const;

export async function compressImage(file: File, deps: CompressDeps = browserDeps()): Promise<CompressedPhoto> {
  try {
    const src = await deps.decode(file);
    // Safari answers a WebP request with PNG: once that happens, every later try goes straight to JPEG
    let webp = true;
    let out: CompressedPhoto | undefined;
    for (const t of TRIES) {
      const size = fitWithin(src.width, src.height, t.maxSide);
      out = undefined;
      if (webp) {
        const blob = await deps.encode('image/webp', t.webp, t.maxSide);
        if (blob.type === 'image/webp') out = { blob, ...size, type: 'image/webp' };
        else webp = false;
      }
      out ??= { blob: await deps.encode('image/jpeg', t.jpeg, t.maxSide), ...size, type: 'image/jpeg' };
      if (out.blob.size <= PHOTO_MAX_BYTES) return out;
    }
    throw new PhotoTooLargeError();
  } finally {
    deps.dispose?.();
  }
}

type Drawable = ImageBitmap | HTMLImageElement;

/** Thin browser implementation: verified in a real browser (Task 11), not in jsdom. */
function browserDeps(): CompressDeps {
  let bitmap: ImageBitmap | undefined;
  return {
    async decode(file) {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { width: bitmap.width, height: bitmap.height };
    },
    async encode(type, quality, maxSide) {
      if (!bitmap) throw new Error('decode first');
      const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
      return drawAndEncode(bitmap, width, height, type, quality);
    },
    dispose() {
      bitmap?.close();
      bitmap = undefined;
    },
  };
}

/** What the draft runs per photo; a token so tests can skip the canvas (jsdom has none). */
export type PhotoPipeline = {
  readGps(file: Blob): Promise<LngLat | null>;
  compress(file: File): Promise<CompressedPhoto>;
};

export const PHOTO_PIPELINE = new InjectionToken<PhotoPipeline>('PHOTO_PIPELINE', {
  providedIn: 'root',
  factory: () => ({ readGps, compress: (file) => compressImage(file) }),
});

async function drawAndEncode(img: Drawable, width: number, height: number, type: string, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.convertToBlob({ type, quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality),
  );
}
