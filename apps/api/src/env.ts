const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
] as const;

export type Env = Record<(typeof REQUIRED)[number], string>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const env = {} as Env;
  for (const key of REQUIRED) {
    const value = source[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    env[key] = value;
  }
  return env;
}
