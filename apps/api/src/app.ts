import type { ReportSignal } from '@jaeng/shared/api';
import { Elysia } from 'elysia';
import { devRoutes } from './routes/dev';
import { reportRoutes } from './routes/reports';
import type { QuickLogin } from './quick-login';
import type { Verify } from './auth';
import { ApiError, ERRORS, errorBody, type ErrorCode } from './errors';
import type { Store } from './store';

export type AppDeps = {
  checkDb: () => Promise<boolean>;
  anonKey: string;
  verify: Verify;
  store: Store;
  broadcast: (signal: ReportSignal) => Promise<void>;
  quickLogin: QuickLogin;
};

function reply(set: { status?: number | string }, code: ErrorCode) {
  set.status = ERRORS[code].status;
  return errorBody(code);
}

// Routes are mounted without the /api prefix; Caddy strips it (handle_path /api/*).
export function createApp(deps: AppDeps) {
  return new Elysia()
    .onError(({ code, error, set }) => {
      if (error instanceof ApiError) return reply(set, error.code);
      if (code === 'VALIDATION' || code === 'PARSE') return reply(set, 'invalid_request');
      if (code === 'NOT_FOUND') return reply(set, 'not_found');
      console.error('unhandled error', error);
      return reply(set, 'internal');
    })
    .get('/health', async ({ set }) => {
      const db = await deps.checkDb().catch(() => false);
      if (!db) set.status = 503;
      return { ok: db, db };
    })
    .get('/config', ({ headers }) => ({
      supabaseAnonKey: deps.anonKey,
      quickLogin: deps.quickLogin.users(headers.host ?? null),
    }))
    .use(devRoutes(deps))
    .use(reportRoutes(deps));
}
