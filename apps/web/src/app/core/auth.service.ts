import { computed, inject, Injectable, signal } from '@angular/core';
import type { DemoWho } from '@jaeng/shared/api';
import type { Session } from '@supabase/supabase-js';
import { en } from '../i18n/en';
import { th } from '../i18n/th';
import { I18nService } from './i18n.service';
import { ServerConfigService } from './server-config.service';
import { SupabaseService } from './supabase.service';

export type Profile = { id: string; display_name: string; role: 'user' | 'admin'; locale: 'th' | 'en' };

export type AuthErrorKey = keyof typeof th.auth.error;

/** An error worded for the visitor in both languages; anything else is never shown as is. */
export class AuthError extends Error {
  override name = 'AuthError';
  readonly messageTh: string;
  readonly messageEn: string;
  constructor(readonly key: AuthErrorKey) {
    super(th.auth.error[key]);
    this.messageTh = th.auth.error[key];
    this.messageEn = en.auth.error[key];
  }
}

type AuthErr = { status?: number; code?: string; message?: string };

/** `verifying`: a 400/403 then means the code is wrong or expired; asking for a code, it is just a failure. */
function toAuthError(e: AuthErr, verifying = false): AuthError {
  if (e.status === 429 || e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit') {
    return new AuthError('tooOften');
  }
  if (verifying && (e.code === 'otp_expired' || e.code === 'otp_disabled' || e.status === 403 || e.status === 400)) {
    return new AuthError('badCode');
  }
  return new AuthError('failed');
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private i18n = inject(I18nService);
  private server = inject(ServerConfigService);
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
  /** The user whose profile has been read or is being read; reset when the read fails, so the next event retries. */
  private profileFor: string | null = null;

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
      this.profileFor = null;
      return;
    }
    // never keep the previous user's profile (and role) attached to a new user
    if (this.profileSig()?.id !== s.user.id) this.profileSig.set(null);
    const id = s.user.id;
    // the same user's profile is already read (or being read): the start applies the session twice
    // (getSession and the first auth event) and every token refresh applies it again, none needs a read
    if (this.profileFor === id) return;
    this.profileFor = id;
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
      if (this.sessionSig()?.user.id !== id) return;
      const profile = (data as Profile | null) ?? null;
      this.profileSig.set(profile);
      // a device that never chose a language takes the account's (plan 6 decision 2)
      if (profile?.locale) this.i18n.adoptProfileLocale(profile.locale);
    } catch {
      // A failed read keeps whatever is shown for the same user, and lets the next event try again.
      // apply() has already cleared it when the user changed, so nothing of another user survives.
      if (this.profileFor === id) this.profileFor = null;
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
    if (error) throw toAuthError(error);
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const client = await this.clientReady();
    const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw toAuthError(error, true);
  }

  async quickLogin(who: DemoWho): Promise<void> {
    let tokens: { access_token: string; refresh_token: string };
    try {
      const res = await fetch(this.server.apiUrl('/dev/quick-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ who }),
      });
      if (!res.ok) throw new Error(`quick login ${res.status}`);
      tokens = (await res.json()) as typeof tokens;
      if (typeof tokens?.access_token !== 'string' || typeof tokens?.refresh_token !== 'string') throw new Error('no tokens');
    } catch {
      throw new AuthError('failed'); // offline, API down, not JSON, or a refusal: one message
    }
    try {
      const client = await this.clientReady();
      const { error } = await client.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      if (error) throw error;
    } catch {
      throw new AuthError('failed');
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
