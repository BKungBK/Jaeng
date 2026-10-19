import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModerationEffect } from '@jaeng/shared/admin';
import type { LiveSignal, PublicComment } from '@jaeng/shared/api';
import type { CategorySlug } from '@jaeng/shared/categories';
import type { DuplicateCandidate, MyReport } from '@jaeng/shared/report';
import { ApiError, type ErrorCode } from './errors';
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
      const { data: comment, error: readError } = await client
        .from('public_comments')
        .select('id, report_id, body, author_name, created_at, by_reporter, photo_path')
        .eq('id', row.comment_id)
        .single<PublicComment>();
      if (readError) throw new Error(`comment read failed: ${readError.message}`);
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
      const { data: comment, error: readError } = await client
        .from('public_comments')
        .select('id, report_id, body, author_name, created_at, by_reporter, photo_path')
        .eq('id', row.comment_id)
        .single<PublicComment>();
      if (readError) throw new Error(`comment read failed: ${readError.message}`);
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

    async renameMember(userId, name) {
      const { data, error } = await client
        .from('profiles')
        .update({ display_name: name })
        .eq('id', userId)
        .select('display_name')
        .single();
      if (error) throw new Error(`rename failed: ${error.message}`);
      return data.display_name as string;
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
  };
}
