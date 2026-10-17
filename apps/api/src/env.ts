const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

export type Env = Record<(typeof REQUIRED)[number], string> & {
  quickLogin: boolean;
  demoPassword: string | null;
};

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const required = {} as Record<(typeof REQUIRED)[number], string>;
  for (const key of REQUIRED) {
    const value = source[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    required[key] = value;
  }
  const quickLogin = source.DEV_QUICK_LOGIN === 'true';
  const demoPassword = source.DEMO_PASSWORD || null;
  if (quickLogin && !demoPassword) {
    throw new Error('DEV_QUICK_LOGIN=true requires DEMO_PASSWORD');
  }
  return { ...required, quickLogin, demoPassword };
}
