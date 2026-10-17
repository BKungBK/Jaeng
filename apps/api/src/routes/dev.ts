import { Elysia } from 'elysia';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';

export function devRoutes(deps: AppDeps) {
  return new Elysia().post('/dev/quick-login', async ({ headers, body }) => {
    const who = typeof body === 'object' && body !== null ? (body as { who?: unknown }).who : undefined;
    if (typeof who !== 'string') throw new ApiError('not_found');
    return deps.quickLogin.signIn(headers.host ?? null, who);
  });
}
