import { expect, test } from 'bun:test';
import { loadEnv } from '../src/env';

const full = {
  SUPABASE_URL: 'http://kong:8000',
  SUPABASE_ANON_KEY: 'a',
  SUPABASE_SERVICE_ROLE_KEY: 's',
};

test('loadEnv returns required keys', () => {
  expect(loadEnv(full).SUPABASE_URL).toBe('http://kong:8000');
});

test('loadEnv names the first missing key', () => {
  expect(() => loadEnv({ ...full, SUPABASE_ANON_KEY: '' })).toThrow('SUPABASE_ANON_KEY');
});

test('Nominatim defaults to the public server and the repo as contact', () => {
  const env = loadEnv(full);
  expect(env.nominatimUrl).toBe('https://nominatim.openstreetmap.org');
  expect(env.nominatimContact).toBe('https://github.com/BKungBK/Jaeng');
  const set = loadEnv({ ...full, NOMINATIM_URL: 'http://x.test/', NOMINATIM_CONTACT: 'ops@x.test' });
  expect(set.nominatimUrl).toBe('http://x.test');
  expect(set.nominatimContact).toBe('ops@x.test');
});

test('SUPABASE_JWT_SECRET is not required', () => {
  expect(() => loadEnv(full)).not.toThrow();
});

test('rate limits default to 5 reports, 30 comments, 40 photos, 10 fix claims, 20 flags per day', () => {
  expect(loadEnv(full).rateLimits).toEqual({ reports: 5, comments: 30, photos: 40, fixClaims: 10, flags: 20 });
});

test('fix claim and flag limits reject non-positive values and can be overridden', () => {
  expect(() => loadEnv({ ...full, RATE_LIMIT_FLAGS_PER_DAY: '0' })).toThrow('RATE_LIMIT_FLAGS_PER_DAY');
  expect(() => loadEnv({ ...full, RATE_LIMIT_FIX_CLAIMS_PER_DAY: 'x' })).toThrow('RATE_LIMIT_FIX_CLAIMS_PER_DAY');
  expect(loadEnv({ ...full, RATE_LIMIT_FIX_CLAIMS_PER_DAY: '3' }).rateLimits.fixClaims).toBe(3);
});

test('rate limits can be overridden', () => {
  expect(loadEnv({ ...full, RATE_LIMIT_PHOTOS_PER_DAY: '7' }).rateLimits.photos).toBe(7);
});

test('a rate limit that is not a positive integer names its variable', () => {
  expect(() => loadEnv({ ...full, RATE_LIMIT_REPORTS_PER_DAY: '0' })).toThrow('RATE_LIMIT_REPORTS_PER_DAY');
  expect(() => loadEnv({ ...full, RATE_LIMIT_COMMENTS_PER_DAY: 'abc' })).toThrow('RATE_LIMIT_COMMENTS_PER_DAY');
  expect(() => loadEnv({ ...full, RATE_LIMIT_PHOTOS_PER_DAY: '1.5' })).toThrow('RATE_LIMIT_PHOTOS_PER_DAY');
});

test('quick login is off by default', () => {
  const env = loadEnv(full);
  expect(env.quickLogin).toBe(false);
  expect(env.demoPassword).toBeNull();
});

test('quick login needs DEMO_PASSWORD', () => {
  expect(() => loadEnv({ ...full, DEV_QUICK_LOGIN: 'true' })).toThrow('DEMO_PASSWORD');
});

test('quick login with DEMO_PASSWORD', () => {
  const env = loadEnv({ ...full, DEV_QUICK_LOGIN: 'true', DEMO_PASSWORD: 'pw' });
  expect(env.quickLogin).toBe(true);
  expect(env.demoPassword).toBe('pw');
});
