import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { DemoUser, DemoWho } from '@jaeng/shared/api';
import { AuthError, AuthService } from '../../core/auth.service';
import { I18nService, type Said } from '../../core/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { SupabaseService } from '../../core/supabase.service';
import { IconComponent } from '../../shared/icon.component';

/** Supabase's minimum gap between two codes for one email. */
export const RESEND_AFTER_MS = 60_000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Busy = 'send' | 'verify' | 'resend' | DemoWho;

let nextId = 0;

// Email OTP in two steps (email, then the 6 digit code), plus one-tap demo users when the API offers them.
@Component({
  selector: 'app-login-form',
  templateUrl: 'login-form.component.html',
  styleUrls: ['login-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgTemplateOutlet, TPipe],
})
export class LoginFormComponent {
  private auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  protected readonly i18n = inject(I18nService);

  /** Emits once the user is signed in. */
  readonly done = output<void>();

  protected readonly id = `login-${++nextId}`;
  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly sentTo = signal('');
  protected readonly busy = signal<Busy | null>(null);
  protected readonly error = signal<Said>(null);
  protected readonly demoError = signal<Said>(null);
  protected readonly status = signal<Said>(null);
  protected readonly demo = signal<DemoUser[]>([]);

  private readonly until = signal(0);
  private readonly now = signal(Date.now());
  private ticker?: ReturnType<typeof setInterval>;

  protected readonly emailOk = computed(() => EMAIL.test(this.normalized()));
  protected readonly codeOk = computed(() => /^\d{6}$/.test(this.code()));
  protected readonly wait = computed(() => Math.max(0, Math.ceil((this.until() - this.now()) / 1000)));

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.ticker));
    this.supabase
      .config()
      .then((c) => this.demo.set(c.quickLogin))
      .catch(() => this.demo.set([])); // no API config: email login still works
    afterNextRender(() => this.focusFirst());
  }

  /**
   * Puts the caret in the first field, with a mouse and keyboard only: on a phone the keyboard would
   * pop up over the demo buttons before the visitor has chosen how to log in.
   */
  focusFirst() {
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) this.emailInput()?.nativeElement.focus();
  }

  private normalized() {
    return this.email().trim().toLowerCase();
  }

  protected onEmail(e: Event) {
    this.email.set((e.target as HTMLInputElement).value);
  }

  protected onCode(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = digits; // keep only digits, also when a whole message is pasted
    this.code.set(digits);
  }

  protected submit(e: Event) {
    e.preventDefault();
    if (this.step() === 'email') void this.send();
    else void this.verify();
  }

  private async send() {
    if (!this.emailOk() || this.busy()) return;
    const email = this.normalized();
    await this.run('send', async () => {
      await this.auth.sendCode(email);
      this.sentTo.set(email);
      this.code.set('');
      this.step.set('code');
      this.startCountdown();
      this.focus(this.codeInput);
    });
  }

  protected async resend() {
    if (this.wait() > 0 || this.busy()) return;
    this.status.set(null);
    await this.run('resend', async () => {
      await this.auth.sendCode(this.sentTo());
      this.startCountdown();
      this.status.set('auth.resent');
      this.focus(this.codeInput);
    });
  }

  private async verify() {
    if (!this.codeOk() || this.busy()) return;
    const ok = await this.run('verify', () => this.auth.verifyCode(this.sentTo(), this.code()));
    if (ok) this.done.emit();
    else this.focus(this.codeInput, true);
  }

  protected async quick(who: DemoWho) {
    if (this.busy()) return;
    if (await this.run(who, () => this.auth.quickLogin(who), this.demoError)) this.done.emit();
  }

  protected back() {
    this.step.set('email');
    this.error.set(null);
    this.status.set(null);
    this.focus(this.emailInput);
  }

  /** Runs one request at a time, showing its error. Resolves true on success. */
  private async run(what: Busy, job: () => Promise<void>, errorSig: WritableSignal<Said> = this.error) {
    this.busy.set(what);
    this.error.set(null);
    this.demoError.set(null);
    try {
      await job();
      return true;
    } catch (e) {
      // only AuthService's own words are shown; "config 503" or "Failed to fetch" never reach the visitor
      errorSig.set(e instanceof AuthError ? { error: e } : 'auth.error.failed');
      return false;
    } finally {
      this.busy.set(null);
    }
  }

  private startCountdown() {
    this.now.set(Date.now());
    this.until.set(Date.now() + RESEND_AFTER_MS);
    clearInterval(this.ticker);
    this.ticker = setInterval(() => {
      this.now.set(Date.now());
      if (this.wait() === 0) clearInterval(this.ticker);
    }, 1000);
  }

  protected demoLabel = (u: DemoUser) => (this.i18n.locale() === 'en' ? u.label_en : u.label_th);

  private focus(ref: () => ElementRef<HTMLInputElement> | undefined, select = false) {
    setTimeout(() => {
      const el = ref()?.nativeElement;
      el?.focus();
      if (select) el?.select();
    });
  }
}
