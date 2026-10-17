import { COMMENT_MAX, type ReportSignal } from '@jaeng/shared/api';
import { Elysia } from 'elysia';
import { requireMember } from '../auth';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function reportRoutes(deps: AppDeps) {
  const announce = (report: ReportSignal) => void deps.broadcast(report);

  return new Elysia()
    .post('/reports/:id/confirm', async ({ params, headers }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const id = parseId(params.id);
      const result = await deps.store.toggleConfirmation(id, member.id);
      announce(result.report);
      return result;
    })
    .post('/reports/:id/comments', async ({ params, headers, body, set }) => {
      const member = await requireMember(headers.authorization, deps.verify, deps.store);
      const id = parseId(params.id);
      const text = parseCommentBody(body);
      const result = await deps.store.addComment(id, member.id, text);
      announce(result.report);
      set.status = 201;
      return result;
    });
}
