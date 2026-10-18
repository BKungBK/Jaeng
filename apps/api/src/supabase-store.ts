import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicComment } from '@jaeng/shared/api';
import { ApiError } from './errors';
import type { Store } from './store';

function rethrow(error: { message: string }): never {
  if (error.message === 'report_not_found') throw new ApiError('report_not_found');
  if (error.message === 'report_resolved') throw new ApiError('report_resolved');
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

    async addComment(reportId, userId, body) {
      const { data, error } = await client.rpc('add_comment', { p_report: reportId, p_user: userId, p_body: body });
      if (error) rethrow(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('add_comment returned no row');
      // The anonymity rule lives in the public_comments view only.
      const { data: comment, error: readError } = await client
        .from('public_comments')
        .select('id, report_id, body, author_name, created_at, by_reporter')
        .eq('id', row.comment_id)
        .single();
      if (readError) throw new Error(`comment read failed: ${readError.message}`);
      return {
        comment: comment as PublicComment,
        report: { id: reportId, status: row.status, confirm_count: row.confirm_count, comment_count: row.comment_count },
      };
    },
  };
}
