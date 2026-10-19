import { FLAG_REASONS, NOTE_MAX, type FlagReason, type FlagTarget } from '@jaeng/shared/admin';
import { Elysia } from 'elysia';
import { requireMember } from '../auth';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { applyEffect } from '../moderation/effects';
import { asObject, UUID } from './reports';

/** Optional note for admins: absent/null/blank -> null; not a string or over `max` code points -> invalid_note. */
export function parseNote(value: unknown, max: number = NOTE_MAX): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ApiError('invalid_note');
  const text = value.trim();
  if ([...text].length > max) throw new ApiError('invalid_note');
  return text.length === 0 ? null : text;
}

function parseTargetType(value: unknown): FlagTarget {
  if (value !== 'report' && value !== 'comment') throw new ApiError('invalid_request');
  return value;
}

/** A target id that is not a uuid cannot exist: 404 in the words of its type. */
export function parseTargetId(type: FlagTarget, value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ApiError(type === 'report' ? 'report_not_found' : 'item_not_found');
  }
  return value;
}

// Member routes of plan 5: "it's fixed" and content reports. Notes are read by admins only, so
// they skip the profanity filter (plan 5 decision 10).
export function moderationRoutes(deps: AppDeps) {
  return new Elysia()
    .post('/reports/:id/fix-claims', async ({ params, headers, body, set }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const reportId = parseTargetId('report', params.id);
      const raw = asObject(body);
      const note = parseNote(raw.note);
      let photoId: string | null = null;
      if (raw.photo_id !== undefined && raw.photo_id !== null) {
        if (typeof raw.photo_id !== 'string' || !UUID.test(raw.photo_id)) throw new ApiError('invalid_photos');
        photoId = raw.photo_id.toLowerCase();
      }
      const { claimId, effect } = await deps.store.createFixClaim({
        reportId,
        userId: member.id,
        note,
        photoId,
        limit: deps.rateLimits.fixClaims,
      });
      const report = effect.report;
      if (!report || report.status !== 'fix_claimed') throw new Error('create_fix_claim gave no fix_claimed signal');
      await applyEffect(deps, effect);
      set.status = 201;
      return { claim_id: claimId, report: { ...report, status: 'fix_claimed' as const } };
    })
    .post('/flags', async ({ headers, body, set }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const raw = asObject(body);
      const targetType = parseTargetType(raw.target_type);
      if (typeof raw.reason !== 'string' || !(FLAG_REASONS as readonly string[]).includes(raw.reason)) {
        throw new ApiError('invalid_request');
      }
      const reason = raw.reason as FlagReason;
      const targetId = parseTargetId(targetType, raw.target_id);
      const note = parseNote(raw.note);
      const { flagId, hidden, effect } = await deps.store.createFlag({
        userId: member.id,
        targetType,
        targetId,
        reason,
        note,
        limit: deps.rateLimits.flags,
      });
      // An auto-hide moves the files back to private and takes the beacon off every open map.
      await applyEffect(deps, effect);
      set.status = 201;
      // Never how many others reported it.
      return { flag_id: flagId, hidden };
    });
}
