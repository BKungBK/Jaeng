import { expect, test } from 'bun:test';
import { loadEnv } from '../src/env';

const full = {
  SUPABASE_URL: 'http://kong:8000',
  SUPABASE_ANON_KEY: 'a',
  SUPABASE_SERVICE_ROLE_KEY: 's',
  SUPABASE_JWT_SECRET: 'j',
};

test('loadEnv returns required keys', () => {
  expect(loadEnv(full).SUPABASE_URL).toBe('http://kong:8000');
});

test('loadEnv names the first missing key', () => {
  expect(() => loadEnv({ ...full, SUPABASE_ANON_KEY: '' })).toThrow('SUPABASE_ANON_KEY');
});
