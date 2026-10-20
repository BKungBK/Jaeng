import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, thumbPath, type MyReport } from '@jaeng/shared/report';
import { Elysia } from 'elysia';
import { requireMember } from '../auth';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { containsBadWord } from '../moderation/badwords';
import { PUBLIC_PREFIX, toSameOrigin } from '../moderation/photo-urls';

export { toSameOrigin };

const PUBLIC_STATUSES = new Set(['open', 'fix_claimed', 'resolved']);

function checkName(raw: unknown): string {
  if (typeof raw !== 'string') throw new ApiError('invalid_display_name');
  const name = raw.trim();
  const len = [...name].length;
  if (len < DISPLAY_NAME_MIN || len > DISPLAY_NAME_MAX) throw new ApiError('invalid_display_name');
  // control and invisible format characters (newlines, zero-width spaces) make a blank-looking name
  if (/[\p{Cc}\p{Cf}]/u.test(name)) throw new ApiError('invalid_display_name');
  if (containsBadWord(name)) throw new ApiError('profanity');
  return name;
}

export function meRoutes(deps: AppDeps) {
  return new Elysia()
    .get('/me/reports', async ({ headers }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const rows = await deps.store.myReports(member.id);
      const reports: MyReport[] = await Promise.all(
        rows.map(async ({ cover_path, ...r }) => {
          let thumb_url: string | null = null;
          if (cover_path) {
            if (PUBLIC_STATUSES.has(r.status)) {
              thumb_url = `${PUBLIC_PREFIX}${thumbPath(cover_path)}`;
            } else {
              const signed = await deps.photos.signedUrl(thumbPath(cover_path), 3600);
              thumb_url = signed ? toSameOrigin(signed) : null;
            }
          }
          return {
            id: r.id,
            title: r.title,
            category: r.category,
            danger_level: r.danger_level,
            status: r.status,
            reject_reason: r.reject_reason,
            place_name: r.place_name,
            confirm_count: r.confirm_count,
            comment_count: r.comment_count,
            created_at: r.created_at,
            thumb_url,
          };
        }),
      );
      return { reports };
    })
    .patch('/me', async ({ headers, body }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const b = typeof body === 'object' && body !== null ? (body as { display_name?: unknown; locale?: unknown }) : {};
      if (b.display_name === undefined && b.locale === undefined) throw new ApiError('invalid_request');
      const patch: { display_name?: string; locale?: 'th' | 'en' } = {};
      if (b.locale !== undefined) {
        if (b.locale !== 'th' && b.locale !== 'en') throw new ApiError('invalid_request');
        patch.locale = b.locale;
      }
      if (b.display_name !== undefined) patch.display_name = checkName(b.display_name);
      return deps.store.updateMe(member.id, patch);
    });
}
