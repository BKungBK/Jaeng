import { computed, inject, Injectable, signal } from '@angular/core';
import type { DemoWho } from '@jaeng/shared/api';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export type Profile = { id: string; display_name: string; role: 'user' | 'admin'; locale: 'th' | 'en' };

const MSG_BAD_CODE = 'รหัสไม่ถูก หรือหมดอายุแล้ว ลองขอรหัสใหม่นะ';
const MSG_TOO_OFTEN = 'ขอรหัสถี่ไปหน่อย รอสักครู่แล้วลองใหม่นะ';
export const MSG_LOGIN_FAILED = 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ';
const MSG_GENERIC = MSG_LOGIN_FAILED;

/** An error whose message is Thai text written for the visitor; anything else is never shown as is. */
export class AuthError extends Error {
  override name = 'AuthError';
}

type AuthErr = { status?: number; code?: string; message?: string };

function thaiError(e: AuthErr): AuthError {
  if (e.status === 429 || e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit') {
    return new AuthError(MSG_TOO_OFTEN);
  }
  if (e.code === 'otp_expired' || e.code === 'otp_disabled' || e.status === 403 || e.status === 400) {
    return new AuthError(MSG_BAD_CODE);
  }
  return new AuthError(MSG_GENERIC);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private sessionSig = signal<Session | null>(null);
  private profileSig = signal<Profile | null>(null);

  readonly session = this.sessionSig.asReadonly();
  readonly profile = this.profileSig.asReadonly();
  readonly signedIn = computed(() => this.sessionSig() !== null);
  readonly ready: Promise<void>;

  private started?: Promise<void>;
  private subscribed = false;
  /** The profile read of the current session, while it runs (and after: it stays settled). */
  private profileLoad: Promise<void> = Promise.resolve();

  constructor() {
    this.ready = this.start().catch(() => {
      // offline or API down: stay signed out; the next call retries
    });
  }

  /** Idempotent and retryable: a failed start is forgotten so the next caller tries again. */
  private start(): Promise<void> {
    this.started ??= this.init().catch((e) => {
      this.started = undefined;
      throw e;
    });
    return this.started;
  }

  private async init(): Promise<void> {
    const client = await this.supabase.client();
    if (!this.subscribed) {
      this.subscribed = true;
      // callback must not await supabase calls (it runs inside the auth lock), so load async
      client.auth.onAuthStateChange((_event, s) => this.apply(s));
    }
    const { data } = await client.auth.getSession();
    this.apply(data.session);
  }

  /** The client, after making sure the auth subscription exists (when it can be made). */
  private async clientReady() {
    await this.start().catch(() => {});
    return this.supabase.client();
  }

  private apply(s: Session | null): void {
    this.sessionSig.set(s);
    if (!s) {
      this.profileSig.set(null);
      return;
    }
    // never keep the previous user's profile (and role) attached to a new user
    if (this.profileSig()?.id !== s.user.id) this.profileSig.set(null);
    const id = s.user.id;
    this.profileLoad = new Promise<void>((done) => setTimeout(() => void this.loadProfile(id).finally(done), 0));
  }

  /**
   * The profile once it is known: waits for the stored session and for the profile read that is in
   * flight. null when signed out or the read failed. Guards use this, so a page refresh never decides
   * "not an admin" before the role has loaded.
   */
  async loadedProfile(): Promise<Profile | null> {
    await this.ready;
    await this.profileLoad;
    return this.sessionSig() ? this.profileSig() : null;
  }

  private async loadProfile(id: string): Promise<void> {
    try {
      const client = await this.supabase.client();
      const { data, error } = await client.from('profiles').select('id, display_name, role, locale').eq('id', id).maybeSingle();
      if (error) throw error;
      // ignore a stale answer if the user changed meanwhile
      if (this.sessionSig()?.user.id === id) this.profileSig.set((data as Profile | null) ?? null);
    } catch {
      // A failed reload for the same user (e.g. on TOKEN_REFRESHED) keeps the profile already shown.
      // apply() has already cleared it when the user changed, so nothing of another user survives.
      if (this.sessionSig()?.user.id === id && this.profileSig()?.id !== id) this.profileSig.set(null);
    }
  }

  /** After the API accepted a new display name: what the app shows follows without another read. */
  setDisplayName(name: string): void {
    this.profileSig.update((p) => (p ? { ...p, display_name: name } : p));
  }

  async sendCode(email: string): Promise<void> {
    const client = await this.clientReady();
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw thaiError(error);
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const client = await this.clientReady();
    const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw thaiError(error);
  }

  async quickLogin(who: DemoWho): Promise<void> {
    let tokens: { access_token: string; refresh_token: string };
    try {
      const res = await fetch('/api/dev/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ who }),
      });
      if (!res.ok) throw new Error(`quick login ${res.status}`);
      tokens = (await res.json()) as typeof tokens;
      if (typeof tokens?.access_token !== 'string' || typeof tokens?.refresh_token !== 'string') throw new Error('no tokens');
    } catch {
      throw new AuthError(MSG_GENERIC); // offline, API down, not JSON, or a refusal: one Thai message
    }
    try {
      const client = await this.clientReady();
      const { error } = await client.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      if (error) throw error;
    } catch {
      throw new AuthError(MSG_GENERIC);
    }
  }

  async signOut(): Promise<void> {
    const client = await this.clientReady();
    await client.auth.signOut();
  }

  /** getSession() makes supabase-js refresh a token that is close to expiry. */
  async accessToken(): Promise<string | null> {
    const client = await this.clientReady();
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async refresh(): Promise<string | null> {
    const client = await this.clientReady();
    const { data, error } = await client.auth.refreshSession();
    return error ? null : (data.session?.access_token ?? null);
  }
}
