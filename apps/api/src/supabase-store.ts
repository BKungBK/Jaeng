import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModerationEffect } from '@jaeng/shared/admin';
import type { LiveSignal, PublicComment } from '@jaeng/shared/api';
import type { CategorySlug } from '@jaeng/shared/categories';
import type { DuplicateCandidate, MyReport } from '@jaeng/shared/report';
import { ApiError, type ErrorCode } from './errors';
import { areaToPlace, type AreaRow } from './places/areas';
import type { Store } from './store';

// Short codes raised by the SQL functions (`raise exception '<code>'`).
const SQL_CODES = new Set<ErrorCode>([
  'report_not_found',
  'report_resolved',
  'rate_limited',
  'invalid_photos',
  'invalid_report',
  'invalid_state',
  'item_not_found',
  'claim_pending',
  'already_resolved',
  'cannot_ban_admin',
  'invalid_note',
  'invalid_location',
  'invalid_request',
]);

function rethrow(error: { message: string }): never {
  if (SQL_CODES.has(error.message as ErrorCode)) throw new ApiError(error.message as ErrorCode);
  throw new Error(`rpc failed: ${error.message}`);
}

/**
 * The comment as everyone else sees it (the `public_comments` view holds the anonymity rule), read back after
 * the insert. The comment already exists by then, so when the read fails the answer is built from what was
 * inserted instead of an error: a 500 would make the writer send it again and post it twice.
 */
export async function commentAfterInsert(client: SupabaseClient, fallback: PublicComment): Promise<PublicComment> {
  try {
    const { data, error } = await client
      .from('public_comments')
      .select('id, report_id, body, author_name, created_at, by_reporter, photo_path, author_avatar')
      .eq('id', fallback.id)
      .single<PublicComment>();
    if (error || !data) throw new Error(error?.message ?? 'no row');
    return data;
  } catch (e) {
    console.warn('comment read-back failed, answering from the insert', e instanceof Error ? e.message : e);
    return fallback;
  }
}

const insertedComment = (id: string, reportId: string, body: string): PublicComment => ({
  id,
  report_id: reportId,
  body: body.trim(),
  author_name: null,
  created_at: new Date().toISOString(),
  by_reporter: false,
  photo_path: null,
  author_avatar: null,
});

export const MERGE_COMMENT_BODY = 'เจอเหมือนกัน แนบรูปเพิ่ม';

const LIVE_STATUSES = new Set(['open', 'fix_claimed', 'resolved', 'hidden']);

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/** Checks the jsonb a moderation function returned instead of trusting a cast. */
export function toEffect(raw: unknown): ModerationEffect {
  const bad = (why: string): never => {
    throw new Error(`moderation effect: ${why}`);
  };
  if (typeof raw !== 'object' || raw === null) bad('not an object');
  const o = raw as Record<string, unknown>;
  let report: LiveSignal | null = null;
  if (o.report !== null) {
    const r = o.report as Record<string, unknown> | undefined;
    if (
      typeof r !== 'object' || r === null || typeof r.id !== 'string' || !LIVE_STATUSES.has(r.status as string) ||
      !isCount(r.confirm_count) || !isCount(r.comment_count)
    ) {
      bad('bad report');
    }
    report = { id: r!.id as string, status: r!.status as LiveSignal['status'], confirm_count: r!.confirm_count as number, comment_count: r!.comment_count as number };
  }
  if (!Array.isArray(o.promote) || !o.promote.every((p) => typeof p?.from === 'string' && typeof p?.to === 'string')) bad('bad promote');
  if (!Array.isArray(o.demote) || !o.demote.every((p) => typeof p === 'string')) bad('bad demote');
  return {
    report,
    promote: (o.promote as { from: string; to: string }[]).map(({ from, to }) => ({ from, to })),
    demote: [...(o.demote as string[])],
  };
}

export function createSupabaseStore(client: SupabaseClient): Store {
  const effectRpc = async (fn: string, args: Record<string, unknown>): Promise<ModerationEffect> => {
    const { data, error } = await client.rpc(fn, args);
    if (error) rethrow(error);
    return toEffect(data);
  };

  /** A jsonb array from an admin read; checks the top level (an array of objects with the key) before trusting it. */
  const listRpc = async <T>(fn: string, args: Record<string, unknown>, key: string): Promise<T[]> => {
    const { data, error } = await client.rpc(fn, args);
    if (error) rethrow(error);
    if (!Array.isArray(data) || !data.every((x) => typeof x === 'object' && x !== null && key in x)) {
      throw new Error(`${fn} returned a bad list`);
    }
    return data as T[];
  };

  return {
    async member(id) {
      const { data, error } = await client.from('profiles').select('id, role, banned_at').eq('id', id).maybeSingle();
      if (error) throw new Error(`profile lookup failed: ${error.message}`);
      if (!data) return null;
      return { id: data.id, role: data.role, banned: data.banned_at != null };
    },

    async registerPhoto(p, limit) {
      const { error } = await client.rpc('register_photo', {
        p_id: p.id,
        p_uploader: p.uploaderId,
        p_path: p.path,
        p_width: p.width,
        p_height: p.height,
        p_blurred: p.blurred,
        p_limit: limit,
      });
      if (error) rethrow(error);
    },

    async deletePhoto(id) {
      const { error } = await client.from('report_photos').delete().eq('id', id).is('report_id', null);
      if (error) throw new Error(`photo delete failed: ${error.message}`);
    },

    async findDuplicates(lng, lat, category) {
      const { data, error } = await client.rpc('find_duplicates', { p_lng: lng, p_lat: lat, p_category: category });
      if (error) rethrow(error);
      return (data ?? []) as DuplicateCandidate[];
    },

    async createReport(input) {
      const { data, error } = await client.rpc('create_report', {
        p_user: input.userId,
        p_category: input.category,
        p_lng: input.lng,
        p_lat: input.lat,
        p_photo_ids: input.photoIds,
        p_title: input.title,
        p_description: input.description,
        p_danger: input.danger,
        p_tags: input.tags,
        p_hide_author: input.hideAuthor,
        p_flagged: input.flagged,
        p_limit: input.limit,
      });
      if (error) rethrow(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('create_report returned no row');
      return { id: row.id, status: 'pending_review' };
    },

    async toggleConfirmation(reportId, userId) {
      const { data, error } = await client.rpc('toggle_confirmation', { p_report: reportId, p_user: userId });
      if (error) rethrow(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('toggle_confirmation returned no row');
      return {
        confirmed: row.confirmed,
        report: { id: reportId, status: row.status, confirm_count: row.confirm_count, comment_count: row.comment_count },
      };
    },

    async addComment(reportId, userId, body, limit = 30) {
      const { data, error } = await client.rpc('add_comment', {
        p_report: reportId,
        p_user: userId,
        p_body: body,
        p_limit: limit,
      });
      if (error) rethrow(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('add_comment returned no row');
      // The anonymity rule lives in the public_comments view only.
      const comment = await commentAfterInsert(client, insertedComment(row.comment_id, reportId, body));
      return {
        comment,
        report: { id: reportId, status: row.status, confirm_count: row.confirm_count, comment_count: row.comment_count },
      };
    },

    async mergeDuplicate(reportId, userId, photoIds, limit) {
      const { data, error } = await client.rpc('merge_duplicate', {
        p_target: reportId,
        p_user: userId,
        p_photo_ids: photoIds,
        p_limit: limit,
      });
      if (error) rethrow(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('merge_duplicate returned no row');
      // the words merge_duplicate gives its comment (migration 20261018000200); the photo path is not known here
      const comment = await commentAfterInsert(client, insertedComment(row.comment_id, reportId, MERGE_COMMENT_BODY));
      return {
        confirmed: row.confirmed,
        comment,
        report: { id: reportId, status: row.status, confirm_count: row.confirm_count, comment_count: row.comment_count },
        moved: (row.moved ?? []) as { from: string; to: string }[],
      };
    },

    async myReports(userId) {
      type Row = {
        id: string;
        title: string;
        danger_level: number;
        status: MyReport['status'];
        reject_reason: string | null;
        place_name: string | null;
        confirm_count: number;
        comment_count: number;
        created_at: string;
        categories: { slug: CategorySlug } | { slug: CategorySlug }[] | null;
        report_photos: { storage_path: string; kind: string; created_at: string }[];
      };
      // Explicit columns only: location and public_location are never selected.
      const { data, error } = await client
        .from('reports')
        .select(
          'id, title, danger_level, status, reject_reason, place_name, confirm_count, comment_count, created_at, categories(slug), report_photos(storage_path, kind, created_at)',
        )
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)
        .returns<Row[]>();
      if (error) throw new Error(`my reports failed: ${error.message}`);
      return (data ?? []).map((r) => {
        const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
        const cover = r.report_photos
          .filter((p) => p.kind === 'before')
          .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
        return {
          id: r.id,
          title: r.title,
          category: cat!.slug,
          danger_level: r.danger_level,
          status: r.status,
          reject_reason: r.reject_reason,
          place_name: r.place_name,
          confirm_count: r.confirm_count,
          comment_count: r.comment_count,
          created_at: r.created_at,
          cover_path: cover?.storage_path ?? null,
        };
      });
    },

    async updateMe(userId, patch) {
      if (patch.complete) {
        const { error } = await client.rpc('complete_profile', { p_user: userId, p_name: patch.display_name });
        if (error) rethrow(error);
      }
      const fields: { display_name?: string; locale?: 'th' | 'en' } = {};
      if (!patch.complete && patch.display_name !== undefined) fields.display_name = patch.display_name;
      if (patch.locale !== undefined) fields.locale = patch.locale;
      if (Object.keys(fields).length > 0) {
        const { error } = await client.from('profiles').update(fields).eq('id', userId);
        if (error) throw new Error(`profile update failed: ${error.message}`);
      }
      const { data, error } = await client
        .from('profiles')
        .select('display_name, locale, avatar_path, onboarded_at')
        .eq('id', userId)
        .single();
      if (error) throw new Error(`profile read failed: ${error.message}`);
      return {
        display_name: data.display_name as string,
        locale: data.locale === 'en' ? 'en' : 'th',
        avatar_path: (data.avatar_path as string | null) ?? null,
        onboarded: data.onboarded_at != null,
      };
    },

    async setAvatar(userId, path, limit) {
      const { data, error } = await client.rpc('set_avatar', { p_user: userId, p_path: path, p_limit: limit });
      if (error) rethrow(error);
      return typeof data === 'string' ? data : null;
    },

    async adminRemoveAvatar(adminId, userId) {
      const { data, error } = await client.rpc('admin_remove_avatar', { p_admin: adminId, p_user: userId });
      if (error) rethrow(error);
      return typeof data === 'string' ? data : null;
    },

    async searchAreas(q, limit, lang) {
      const { data, error } = await client.rpc('search_areas', { q, p_limit: limit });
      if (error) throw new Error(`search_areas failed: ${error.message}`);
      return ((data ?? []) as AreaRow[]).map((a) => areaToPlace(a, lang));
    },

    async deleteOrphanPhotos(olderThanHours) {
      const { data, error } = await client.rpc('delete_orphan_photos', { p_older_than: `${olderThanHours} hours` });
      if (error) throw new Error(`orphan sweep failed: ${error.message}`);
      return ((data ?? []) as { id: string; storage_path: string }[]).map((r) => ({ id: r.id, path: r.storage_path }));
    },

    async createFixClaim(i) {
      const { data, error } = await client.rpc('create_fix_claim', {
        p_user: i.userId,
        p_report: i.reportId,
        p_note: i.note,
        p_photo: i.photoId,
        p_limit: i.limit,
      });
      if (error) rethrow(error);
      const claimId = (data as { claim_id?: unknown } | null)?.claim_id;
      if (typeof claimId !== 'string') throw new Error('create_fix_claim returned no claim_id');
      return { claimId, effect: toEffect(data) };
    },

    async createFlag(i) {
      const { data, error } = await client.rpc('create_flag', {
        p_user: i.userId,
        p_target_type: i.targetType,
        p_target_id: i.targetId,
        p_reason: i.reason,
        p_note: i.note,
        p_limit: i.limit,
      });
      if (error) rethrow(error);
      const row = data as { flag_id?: unknown; hidden?: unknown } | null;
      if (typeof row?.flag_id !== 'string' || typeof row.hidden !== 'boolean') throw new Error('create_flag returned a bad row');
      return { flagId: row.flag_id, hidden: row.hidden, effect: toEffect(data) };
    },

    approveReport: (adminId, reportId, e) =>
      effectRpc('admin_approve_report', {
        p_admin: adminId,
        p_report: reportId,
        p_category: e.category,
        p_danger: e.danger,
        p_title: e.title,
        p_location_mode: e.location,
        p_lng: e.lng,
        p_lat: e.lat,
      }),
    rejectReport: (adminId, reportId, reason, note) =>
      effectRpc('admin_reject_report', { p_admin: adminId, p_report: reportId, p_reason: reason, p_note: note }),
    reviewFixClaim: (adminId, claimId, approve) =>
      effectRpc('admin_review_fix_claim', { p_admin: adminId, p_claim: claimId, p_approve: approve }),
    hide: (adminId, targetType, targetId) =>
      effectRpc('admin_hide', { p_admin: adminId, p_target_type: targetType, p_target_id: targetId }),
    restore: (adminId, targetType, targetId) =>
      effectRpc('admin_restore', { p_admin: adminId, p_target_type: targetType, p_target_id: targetId }),
    resolveFlags: (adminId, flagId, action) =>
      effectRpc('admin_resolve_flags', { p_admin: adminId, p_flag: flagId, p_action: action }),
    setBan: (adminId, userId, banned) =>
      effectRpc('admin_set_ban', { p_admin: adminId, p_user: userId, p_banned: banned }),

    async adminCounts() {
      const { data, error } = await client.rpc('admin_counts');
      if (error) rethrow(error);
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
      if (!row || ![row.reports, row.claims, row.flags].every((n) => typeof n === 'number')) {
        throw new Error('admin_counts returned a bad row');
      }
      return { reports: row.reports as number, claims: row.claims as number, flags: row.flags as number };
    },
    queueReports: () => listRpc('admin_queue_reports', {}, 'id'),
    queueClaims: () => listRpc('admin_queue_claims', {}, 'id'),
    queueFlags: () => listRpc('admin_queue_flags', {}, 'flag_id'),
    hiddenItems: () => listRpc('admin_hidden', {}, 'target_id'),
    adminUsers: (q) => listRpc('admin_users', { p_q: q }, 'id'),
    adminLog: (before) => listRpc('admin_log', { p_before: before }, 'id'),
  };
}
