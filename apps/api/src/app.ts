import { Elysia } from 'elysia';

export type AppDeps = {
  checkDb: () => Promise<boolean>;
  anonKey: string;
};

// Routes are mounted without the /api prefix; Caddy strips it (handle_path /api/*).
export function createApp(deps: AppDeps) {
  return new Elysia()
    .get('/health', async ({ set }) => {
      const db = await deps.checkDb().catch(() => false);
      if (!db) set.status = 503;
      return { ok: db, db };
    })
    .get('/config', () => ({ supabaseAnonKey: deps.anonKey }));
}
