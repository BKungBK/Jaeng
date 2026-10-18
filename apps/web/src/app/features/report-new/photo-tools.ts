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
};

const MAX_SIDE_RETRY = 1200;

export async function compressImage(file: File, deps: CompressDeps = browserDeps()): Promise<CompressedPhoto> {
  const src = await deps.decode(file);
  const encodeAt = async (quality: number, maxSide: number, jpegOnly: boolean): Promise<CompressedPhoto & { webp: boolean }> => {
    const size = fitWithin(src.width, src.height, maxSide);
    if (!jpegOnly) {
      const blob = await deps.encode('image/webp', quality, maxSide);
      if (blob.type === 'image/webp') return { blob, ...size, type: 'image/webp', webp: true };
    }
    // Safari answers a WebP request with PNG; JPEG compresses a little less well, so 0.82
    const blob = await deps.encode('image/jpeg', jpegOnly && quality < 0.8 ? quality : 0.82, maxSide);
    return { blob, ...size, type: 'image/jpeg', webp: false };
  };

  let out = await encodeAt(0.8, PHOTO_MAX_SIDE, false);
  const jpegOnly = !out.webp;
  if (out.blob.size > PHOTO_MAX_BYTES) out = await encodeAt(0.7, PHOTO_MAX_SIDE, jpegOnly);
  if (out.blob.size > PHOTO_MAX_BYTES) out = await encodeAt(0.7, MAX_SIDE_RETRY, jpegOnly);
  if (out.blob.size > PHOTO_MAX_BYTES) throw new PhotoTooLargeError();
  return { blob: out.blob, width: out.width, height: out.height, type: out.type };
}

type Drawable = ImageBitmap | HTMLImageElement;

/** Thin browser implementation: verified in a real browser (Task 11), not in jsdom. */
function browserDeps(): CompressDeps {
  let decoded: { file: File; bitmap: ImageBitmap } | undefined;
  return {
    async decode(file) {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      decoded = { file, bitmap };
      return { width: bitmap.width, height: bitmap.height };
    },
    async encode(type, quality, maxSide) {
      const bitmap = decoded?.bitmap;
      if (!bitmap) throw new Error('decode first');
      const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
      return drawAndEncode(bitmap, width, height, type, quality);
    },
  };
}

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
