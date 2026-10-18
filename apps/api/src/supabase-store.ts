import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicComment } from '@jaeng/shared/api';
import { ApiError, type ErrorCode } from './errors';
import type { Store } from './store';

// Short codes raised by the SQL functions (`raise exception '<code>'`).
const SQL_CODES = new Set<ErrorCode>([
  'report_not_found',
  'report_resolved',
  'rate_limited',
  'invalid_photos',
  'invalid_report',
]);

function rethrow(error: { message: string }): never {
  if (SQL_CODES.has(error.message as ErrorCode)) throw new ApiError(error.message as ErrorCode);
  throw new Error(`rpc failed: ${error.message}`);
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
  };
}
