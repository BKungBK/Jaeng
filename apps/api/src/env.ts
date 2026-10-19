const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

export type Env = Record<(typeof REQUIRED)[number], string> & {
  quickLogin: boolean;
  demoPassword: string | null;
  rateLimits: { reports: number; comments: number; photos: number; fixClaims: number; flags: number };
};

function positiveInt(source: Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = source[key];
  if (raw === undefined || raw === '') return fallback;
  if (!/^[0-9]+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`${key} must be a positive integer, got "${raw}"`);
  }
  return Number(raw);
}

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
  const rateLimits = {
    reports: positiveInt(source, 'RATE_LIMIT_REPORTS_PER_DAY', 5),
    comments: positiveInt(source, 'RATE_LIMIT_COMMENTS_PER_DAY', 30),
    photos: positiveInt(source, 'RATE_LIMIT_PHOTOS_PER_DAY', 40),
    fixClaims: positiveInt(source, 'RATE_LIMIT_FIX_CLAIMS_PER_DAY', 10),
    flags: positiveInt(source, 'RATE_LIMIT_FLAGS_PER_DAY', 20),
  };
  return { ...required, quickLogin, demoPassword, rateLimits };
}
