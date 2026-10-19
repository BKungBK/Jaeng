import { PHOTO_MAX_BYTES, thumbPath, type PhotoUploaded } from '@jaeng/shared/report';
import { Elysia } from 'elysia';
import { requireMember } from '../auth';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { makeThumb, reencode, sniffImage } from '../photos/pipeline';
import { processForPrivacy } from '../photos/privacy';

export function photoRoutes(deps: AppDeps) {
  return new Elysia().post('/photos', async ({ headers, body, set }) => {
    // Elysia has parsed the multipart body by now; the auth check cannot come earlier.
    const member = await requireMember(headers.authorization, deps.verify, deps.store);
    const file = typeof body === 'object' && body !== null ? (body as { file?: unknown }).file : undefined;
    if (!(file instanceof Blob)) throw new ApiError('invalid_request');
    if (file.size > PHOTO_MAX_BYTES) throw new ApiError('photo_too_large');

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sniffImage(bytes) === null) throw new ApiError('invalid_photo');

    const encoded = await reencode(bytes);
    const { image, blurred } = await processForPrivacy(encoded.image);
    const thumb = await makeThumb(image);

    const id = crypto.randomUUID();
    const path = `${member.id}/${id}.webp`;
    await deps.store.registerPhoto(
      { id, uploaderId: member.id, path, width: encoded.width, height: encoded.height, blurred },
      deps.rateLimits.photos,
    );
    try {
      await deps.photos.put('photos-private', path, image);
      await deps.photos.put('photos-private', thumbPath(path), thumb);
    } catch (e) {
      await deps.photos.remove('photos-private', [path, thumbPath(path)]).catch(() => {});
      await deps.store.deletePhoto(id).catch((err) => console.error('photo rollback failed', err));
      throw e;
    }

    set.status = 201;
    return { photo_id: id, width: encoded.width, height: encoded.height } satisfies PhotoUploaded;
  });
}
