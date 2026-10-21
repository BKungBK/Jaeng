import { Injectable, signal } from '@angular/core';
import { platform } from './platform';

/** Where the server is. On the web that is the page itself; in the APK the page is http://localhost,
 *  so the address the reader saved (plan 7). Module state, because `coverPhotoUrl` is a plain function. */
let saved: string | null = null;

export function setServerOrigin(origin: string | null): void {
  saved = origin ? origin.replace(/\/+$/, '') : null;
}

export function serverOrigin(): string {
  return saved ?? location.origin;
}

const FULL_URL = /^(https?:|blob:|data:)/i;

/** A URL the API or a template hands over: full ones stay, `/sb/...` gets the server in front. */
export function serverUrl(u: string): string {
  return FULL_URL.test(u) || !u.startsWith('/') ? u : `${serverOrigin()}${u}`;
}

/** An approved report photo in the public bucket, by its path in the bucket. */
export function publicPhotoUrl(path: string): string {
  return `${serverOrigin()}/sb/storage/v1/object/public/photos-public/${path}`;
}

/** What the reader typed → `scheme://host[:port]`, or null when it cannot be a server address. */
export function normalizeServerUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname ? url.origin : null;
  } catch {
    return null;
  }
}

export type ServerReason = 'invalid' | 'unreachable' | 'notJaeng';
export type ServerCheck = { ok: true; address: string } | { ok: false; reason: ServerReason };

export class ServerCheckError extends Error {
  override name = 'ServerCheckError';
  constructor(readonly reason: ServerReason) {
    super(reason);
  }
}

const PREF_KEY = 'server';

@Injectable({ providedIn: 'root' })
export class ServerConfigService {
  readonly native = platform.isNative();
  private addressSig = signal('');
  /** The saved address in the APK; '' on the web and before one is set. */
  readonly address = this.addressSig.asReadonly();

  apiUrl(path: string): string {
    return `${serverOrigin()}/api${path}`;
  }

  sbUrl(): string {
    return `${serverOrigin()}/sb`;
  }

  /** Before the first request: what the reader saved wins over the address the APK was built with. Never rejects. */
  async init(): Promise<void> {
    if (!this.native) return;
    try {
      const value = await platform.getPreference(PREF_KEY);
      const address = (value && normalizeServerUrl(value)) || (await this.bundledAddress());
      if (!address) return;
      setServerOrigin(address);
      this.addressSig.set(address);
    } catch {
      // storage unavailable: the page asks for an address
    }
  }

  /** Asks `/api/health` of the typed address. A 503 with `ok:false` is still the right server (its database is down). */
  async check(raw: string, timeoutMs = 5000): Promise<ServerCheck> {
    const address = normalizeServerUrl(raw);
    if (!address) return { ok: false, reason: 'invalid' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${address}/api/health`, { signal: controller.signal });
      const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
      return typeof body?.ok === 'boolean' ? { ok: true, address } : { ok: false, reason: 'notJaeng' };
    } catch {
      return { ok: false, reason: 'unreachable' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Checks, saves and reloads the app: the Supabase client, realtime and the session all belong to one address. */
  async save(raw: string): Promise<void> {
    const result = await this.check(raw);
    if (!result.ok) throw new ServerCheckError(result.reason);
    await platform.setPreference(PREF_KEY, result.address);
    platform.reload();
  }

  /** At start-up in the APK: why the app cannot reach its server, or null when it can (always null on the web). */
  async startupProblem(): Promise<'unset' | ServerReason | null> {
    if (!this.native) return null;
    const address = this.addressSig();
    if (!address) return 'unset';
    const result = await this.check(address);
    return result.ok ? null : result.reason;
  }

  private async bundledAddress(): Promise<string | null> {
    try {
      const res = await fetch('server.json');
      const body = (await res.json()) as { server?: unknown };
      return normalizeServerUrl(String(body.server ?? ''));
    } catch {
      return null;
    }
  }
}
