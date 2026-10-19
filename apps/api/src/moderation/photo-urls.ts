import type { AdminPhoto, PhotoRef } from '@jaeng/shared/admin';
import { thumbPath } from '@jaeng/shared/report';
import type { PhotoStorage } from '../photos/storage';

export const PUBLIC_PREFIX = '/sb/storage/v1/object/public/photos-public/';

/** The web is served from the same origin as Supabase (behind /sb), so strip the internal host. */
export function toSameOrigin(url: string): string {
  const u = new URL(url, 'http://internal.invalid');
  return `/sb${u.pathname}${u.search}`;
}

/** Adds URLs to a photo: the public bucket when it is public, else hour-long signed URLs ('' when signing fails). */
export async function toAdminPhoto(photos: Pick<PhotoStorage, 'signedUrl'>, ref: PhotoRef, isPublic: boolean): Promise<AdminPhoto> {
  if (isPublic) {
    return { ...ref, url: `${PUBLIC_PREFIX}${ref.path}`, thumb_url: `${PUBLIC_PREFIX}${thumbPath(ref.path)}` };
  }
  const sign = async (path: string) => {
    const signed = await photos.signedUrl(path, 3600);
    return signed ? toSameOrigin(signed) : '';
  };
  const [url, thumb_url] = await Promise.all([sign(ref.path), sign(thumbPath(ref.path))]);
  return { ...ref, url, thumb_url };
}
