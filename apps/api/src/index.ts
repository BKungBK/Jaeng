import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet } from 'jose';
import { createApp } from './app';
import { createVerifier } from './auth';
import { createBroadcaster } from './broadcast';
import { loadEnv } from './env';
import { createSupabaseStore } from './supabase-store';

const env = loadEnv();

// PostgREST answers its root only when it can reach the database, so this works
// before any migration exists.
async function checkDb(): Promise<boolean> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    signal: AbortSignal.timeout(3000),
  });
  return res.ok;
}

const verify = createVerifier(createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)));
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

createApp({
  checkDb,
  anonKey: env.SUPABASE_ANON_KEY,
  verify,
  store: createSupabaseStore(client),
  broadcast: createBroadcaster(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
}).listen({ hostname: '0.0.0.0', port: 3000 });
console.log('api listening on :3000');
