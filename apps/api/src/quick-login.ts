import type { DemoUser } from '@jaeng/shared/api';
import { ApiError } from './errors';

export const DEMO_USERS: readonly (DemoUser & { email: string })[] = [
  { who: 'reporter', email: 'reporter@jaeng.local', label_th: 'ผู้แจ้ง (เพื่อนบ้านใจดี)', label_en: 'Reporter (friendly neighbour)' },
  { who: 'neighbor1', email: 'neighbor1@jaeng.local', label_th: 'เพื่อนบ้านอีกคน', label_en: 'Another neighbour' },
  { who: 'admin', email: 'admin@jaeng.local', label_th: 'ผู้ดูแล', label_en: 'Moderator' },
];

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

export type QuickLogin = {
  users(host: string | null): DemoUser[];
  signIn(host: string | null, who: string): Promise<{ access_token: string; refresh_token: string }>;
};

export function createQuickLogin(opts: {
  enabled: boolean;
  supabaseUrl: string;
  anonKey: string;
  password: string | null;
  fetchFn?: typeof fetch;
}): QuickLogin {
  // Trusts the client-supplied Host header: DEV_QUICK_LOGIN must be false outside local dev.
  const active = (host: string | null) => opts.enabled && !!opts.password && isLocalHost(host);
  const doFetch = opts.fetchFn ?? fetch;
  return {
    users: (host) => (active(host) ? DEMO_USERS.map(({ who, label_th, label_en }) => ({ who, label_th, label_en })) : []),
    async signIn(host, who) {
      const user = active(host) ? DEMO_USERS.find((u) => u.who === who) : undefined;
      if (!user) throw new ApiError('not_found');
      const res = await doFetch(`${opts.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: opts.anonKey, 'content-type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: opts.password }),
      });
      if (!res.ok) throw new Error(`quick login failed: ${res.status}`);
      const json = (await res.json()) as { access_token?: string; refresh_token?: string };
      if (!json.access_token || !json.refresh_token) throw new Error('quick login: missing tokens');
      return { access_token: json.access_token, refresh_token: json.refresh_token };
    },
  };
}
