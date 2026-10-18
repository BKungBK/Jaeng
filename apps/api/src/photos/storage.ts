import { thumbPath } from '@jaeng/shared/report';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Bucket = 'photos-private' | 'photos-public';

export type PhotoStorage = {
  put(bucket: Bucket, path: string, bytes: Uint8Array): Promise<void>;
  remove(bucket: Bucket, paths: string[]): Promise<void>;
  /** private -> public: the file and its thumbPath(). */
  promote(from: string, to: string): Promise<void>;
  signedUrl(path: string, expiresInSec: number): Promise<string | null>;
};

function check(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`storage ${what} failed: ${error.message}`);
}

export function createSupabasePhotoStorage(client: SupabaseClient): PhotoStorage {
  return {
    async put(bucket, path, bytes) {
      const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: 'image/webp', upsert: false });
      check('upload', error);
    },

    async remove(bucket, paths) {
      if (paths.length === 0) return;
      const { error } = await client.storage.from(bucket).remove(paths);
      check('remove', error);
    },

    async promote(from, to) {
      for (const [src, dst] of [
        [from, to],
        [thumbPath(from), thumbPath(to)],
      ]) {
        const { error } = await client.storage.from('photos-private').move(src, dst, { destinationBucket: 'photos-public' });
        check('move', error);
      }
    },

    async signedUrl(path, expiresInSec) {
      const { data, error } = await client.storage.from('photos-private').createSignedUrl(path, expiresInSec);
      if (error || !data) return null;
      return data.signedUrl;
    },
  };
}
