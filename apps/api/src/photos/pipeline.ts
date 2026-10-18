import { PHOTO_MAX_SIDE, THUMB_SIDE } from '@jaeng/shared/report';
import sharp from 'sharp';
import { ApiError } from '../errors';

export type ImageKind = 'jpeg' | 'png' | 'webp';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, at: number, magic: readonly number[]) =>
  bytes.length >= at + magic.length && magic.every((b, i) => bytes[at + i] === b);

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Magic bytes only: neither the declared content type nor the file name is trusted. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, 0, PNG_MAGIC)) return 'png';
  if (startsWith(bytes, 0, ascii('RIFF')) && startsWith(bytes, 8, ascii('WEBP'))) return 'webp';
  return null;
}

/**
 * Decodes and re-encodes as WebP. Metadata is not carried over (no withMetadata), so EXIF/GPS and
 * ICC are dropped; rotate() applies the EXIF orientation first.
 */
export async function reencode(bytes: Uint8Array): Promise<{ image: Buffer; width: number; height: number }> {
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error' })
      .rotate()
      .resize(PHOTO_MAX_SIDE, PHOTO_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { image: data, width: info.width, height: info.height };
  } catch {
    throw new ApiError('invalid_photo');
  }
}

export async function makeThumb(image: Buffer): Promise<Buffer> {
  try {
    return await sharp(image)
      .resize(THUMB_SIDE, THUMB_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
  } catch {
    throw new ApiError('invalid_photo');
  }
}
