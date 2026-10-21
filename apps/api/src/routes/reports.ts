import { COMMENT_MAX, type ReportSignal } from '@jaeng/shared/api';
import { CATEGORY_SLUGS, type CategorySlug } from '@jaeng/shared/categories';
import {
  DESCRIPTION_MAX,
  inThailand,
  normalizeTag,
  PHOTOS_PER_REPORT_MAX,
  TAGS_MAX,
  TITLE_MAX,
} from '@jaeng/shared/report';
import { Elysia } from 'elysia';
import { requireMember } from '../auth';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { containsBadWord } from '../moderation/badwords';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(id: string): string {
  if (!UUID.test(id)) throw new ApiError('report_not_found');
  return id;
}

function parseCommentBody(body: unknown): string {
  const raw = typeof body === 'object' && body !== null ? (body as { body?: unknown }).body : undefined;
  if (typeof raw !== 'string') throw new ApiError('invalid_body');
  const text = raw.trim();
  if (text.length === 0 || [...text].length > COMMENT_MAX) throw new ApiError('invalid_body');
  return text;
}

export type Raw = Record<string, unknown>;

export function asObject(body: unknown): Raw {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Raw) : {};
}

function parseLocation(raw: Raw): { lng: number; lat: number } {
  const { lng, lat } = raw;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new ApiError('invalid_location');
  }
  if (!inThailand(lng, lat)) throw new ApiError('invalid_location');
  return { lng, lat };
}

function parseCategory(raw: Raw): CategorySlug {
  const { category } = raw;
  if (typeof category !== 'string' || !(CATEGORY_SLUGS as readonly string[]).includes(category)) {
    throw new ApiError('invalid_report');
  }
  return category as CategorySlug;
}

function parsePhotoIds(raw: Raw): string[] {
  const ids = raw.photo_ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > PHOTOS_PER_REPORT_MAX) throw new ApiError('invalid_photos');
  if (!ids.every((id) => typeof id === 'string' && UUID.test(id))) throw new ApiError('invalid_photos');
  const lower = ids.map((id: string) => id.toLowerCase());
  if (new Set(lower).size !== lower.length) throw new ApiError('invalid_photos');
  return lower;
}

/** Optional text: absent or null -> null; a non-string or over-long value is invalid; blank -> null. */
function parseText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ApiError('invalid_report');
  const text = value.trim();
  if ([...text].length > max) throw new ApiError('invalid_report');
  return text.length === 0 ? null : text;
}

function parseDanger(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 3) throw new ApiError('invalid_report');
  return value;
}

function parseTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((t) => typeof t !== 'string')) throw new ApiError('invalid_report');
  const tags = [...new Set(value.map((t: string) => normalizeTag(t)).filter((t): t is string => t !== null))];
  if (tags.length > TAGS_MAX) throw new ApiError('invalid_report');
  return tags;
}

function parseHideAuthor(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') throw new ApiError('invalid_report');
  return value;
}

export function reportRoutes(deps: AppDeps) {
  // a failed broadcast must neither fail the request (the change is committed) nor go unseen
  const announce = (report: ReportSignal) => {
    void Promise.resolve()
      .then(() => deps.broadcast(report))
      .catch((e) => console.warn('broadcast failed', e instanceof Error ? e.message : e));
  };

  // Declared before the /reports/:id/... routes so the literal path never reads as an :id.
  return new Elysia()
    .post('/reports/check-duplicate', async ({ headers, body }) => {
      await requireMember(headers.authorization, deps.verify, deps.store);
      const raw = asObject(body);
      const { lng, lat } = parseLocation(raw);
      const category = parseCategory(raw);
      return { duplicates: await deps.store.findDuplicates(lng, lat, category) };
    })
    .post('/reports', async ({ headers, body, set }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const raw = asObject(body);
      const { lng, lat } = parseLocation(raw);
      const category = parseCategory(raw);
      const photoIds = parsePhotoIds(raw);
      const title = parseText(raw.title, TITLE_MAX);
      const description = parseText(raw.description, DESCRIPTION_MAX);
      const danger = parseDanger(raw.danger_level);
      const tags = parseTags(raw.tags);
      const hideAuthor = parseHideAuthor(raw.hide_author);
      // Flagged for admins, never rejected (spec 6.2).
      const flagged = containsBadWord(`${title ?? ''} ${description ?? ''} ${tags.join(' ')}`);
      const report = await deps.store.createReport({
        userId: member.id,
        category,
        lng,
        lat,
        photoIds,
        title,
        description,
        danger,
        tags,
        hideAuthor,
        flagged,
        limit: deps.rateLimits.reports,
      });
      set.status = 201;
      return { report };
    })
    .post('/reports/:id/confirm', async ({ params, headers }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const id = parseId(params.id);
      const result = await deps.store.toggleConfirmation(id, member.id);
      announce(result.report);
      return result;
    })
    .post('/reports/:id/merge', async ({ params, headers, body }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const id = parseId(params.id);
      const photoIds = parsePhotoIds(asObject(body));
      const result = await deps.store.mergeDuplicate(id, member.id, photoIds, deps.rateLimits.comments);
      // The database change is committed; a failed file move is retried once, then only logged
      // (the row already points at the new path, so the file can be moved by hand later).
      for (const { from, to } of result.moved) {
        try {
          await deps.photos.promote(from, to);
        } catch {
          try {
            await deps.photos.promote(from, to);
          } catch (e) {
            console.error('photo promote failed', from, to, e);
          }
        }
      }
      announce(result.report);
      return { confirmed: result.confirmed, comment: result.comment, report: result.report };
    })
    .post('/reports/:id/comments', async ({ params, headers, body, set }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const id = parseId(params.id);
      const text = parseCommentBody(body);
      if (containsBadWord(text)) throw new ApiError('profanity');
      const result = await deps.store.addComment(id, member.id, text, deps.rateLimits.comments);
      announce(result.report);
      set.status = 201;
      return result;
    });
}
