import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DemoUser } from '@jaeng/shared/api';
import { AuthError, AuthService } from '../../core/auth.service';
import { DeviceService } from '../../core/device.service';
import { I18nService } from '../../core/i18n.service';
import { SupabaseService } from '../../core/supabase.service';
import { MeService } from '../me/me.service';
import { LoginFormComponent, VERIFIED_HOLD_MS } from './login-form.component';

const DEMO: DemoUser[] = [
  { who: 'reporter', label_th: 'คนแจ้ง', label_en: 'Reporter' },
  { who: 'neighbor1', label_th: 'เพื่อนบ้าน', label_en: 'Neighbour' },
  { who: 'admin', label_th: 'ผู้ดูแล', label_en: 'Moderator' },
];

/** a member whose profile is set up, so the login ends at the code step like it always did */
const SET_UP = { id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' };

async function setup(opts: { quickLogin?: DemoUser[]; configFails?: boolean; profile?: typeof SET_UP | null } = {}) {
  const profile = signal<typeof SET_UP | null>(opts.profile === undefined ? SET_UP : opts.profile);
  const auth = {
    sendCode: vi.fn().mockResolvedValue(undefined),
    verifyCode: vi.fn().mockResolvedValue(undefined),
    quickLogin: vi.fn().mockResolvedValue(undefined),
    loadedProfile: vi.fn(async () => profile()),
    profile,
    setProfile: vi.fn(),
  };
  const me = {
    completeProfile: vi.fn().mockResolvedValue({ display_name: 'น้องเมย์', locale: 'th', avatar_path: null, onboarded: true }),
    uploadAvatar: vi.fn().mockResolvedValue('u1/a.webp'),
    removeAvatar: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: MeService, useValue: me },
      { provide: DeviceService, useValue: { native: false } },
      {
        provide: SupabaseService,
        useValue: {
          config: async () => {
            if (opts.configFails) throw new Error('config 503');
            return { supabaseAnonKey: 'k', quickLogin: opts.quickLogin ?? [] };
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(LoginFormComponent);
  const done = vi.fn();
  fixture.componentInstance.done.subscribe(done);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const stable = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
  };
  const type = async (selector: string, value: string) => {
    const input = root.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await stable();
  };
  const button = (text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));
  const submit = async () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await stable();
  };
  return { fixture, root, auth, me, done, type, button, submit, stable };
}

async function toCodeStep(t: Awaited<ReturnType<typeof setup>>) {
  await t.type('input[type="email"]', 'pla@example.com');
  await t.submit();
}

describe('LoginFormComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('switches to English in place, keeping the typed email and the demo labels', async () => {
    const t = await setup({ quickLogin: DEMO });
    await t.type('input[type="email"]', 'pla@example.com');
    TestBed.inject(I18nService).setLocale('en');
    await t.stable();
    expect(t.root.querySelector('h2')!.textContent).toContain('Sign in');
    expect(t.button('Send code')).toBeDefined();
    expect(t.button('Moderator')).toBeDefined();
    expect(t.root.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('pla@example.com');
  });

  it('words an auth error in English', async () => {
    const t = await setup();
    t.auth.sendCode.mockRejectedValue(new AuthError('tooOften'));
    TestBed.inject(I18nService).setLocale('en');
    await toCodeStep(t);
    expect(t.root.querySelector('.error')!.textContent).toContain('That was a lot of codes');
  });

  it('keeps "ส่งรหัส" disabled until the email looks right', async () => {
    const t = await setup();
    expect(t.button('ส่งรหัส')!.disabled).toBe(true);
    await t.type('input[type="email"]', 'pla@');
    expect(t.button('ส่งรหัส')!.disabled).toBe(true);
    await t.type('input[type="email"]', 'pla@example.com');
    expect(t.button('ส่งรหัส')!.disabled).toBe(false);
  });

  it('sends the code and then asks for it, naming the email it went to', async () => {
    const t = await setup();
    await toCodeStep(t);
    expect(t.auth.sendCode).toHaveBeenCalledWith('pla@example.com');
    const code = t.root.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
    expect(code).not.toBeNull();
    expect(code.getAttribute('inputmode')).toBe('numeric');
    expect(code.getAttribute('maxlength')).toBe('6');
    expect(t.root.textContent).toContain('pla@example.com');
  });

  it('trims and lowercases the email before sending', async () => {
    const t = await setup();
    await t.type('input[type="email"]', '  Pla@Example.COM ');
    await t.submit();
    expect(t.auth.sendCode).toHaveBeenCalledWith('pla@example.com');
  });

  it('cannot confirm a 5 digit code, can confirm 6 and then says done', async () => {
    const t = await setup();
    await toCodeStep(t);
    await t.type('input[autocomplete="one-time-code"]', '12345');
    expect(t.button('ยืนยัน')!.disabled).toBe(true);
    await t.type('input[autocomplete="one-time-code"]', '123456');
    expect(t.button('ยืนยัน')!.disabled).toBe(false);
    await t.submit();
    expect(t.auth.verifyCode).toHaveBeenCalledWith('pla@example.com', '123456');
    // a right code is shown (accent, a tick that draws) for a moment before the sheet closes
    expect(t.done).not.toHaveBeenCalled();
    expect(t.root.querySelector('.otp.ok .check app-tick svg.play')).not.toBeNull();
    await new Promise((r) => setTimeout(r, VERIFIED_HOLD_MS + 60));
    expect(t.done).toHaveBeenCalledTimes(1);
  });

  describe('a new member (profile not set up yet)', () => {
    const NEW_MEMBER = { ...SET_UP, display_name: 'เพื่อนบ้าน0001', onboarded_at: null as string | null };

    async function toProfileStep() {
      const t = await setup({ profile: NEW_MEMBER as typeof SET_UP });
      await toCodeStep(t);
      await t.type('input[autocomplete="one-time-code"]', '123456');
      await t.submit();
      await new Promise((r) => setTimeout(r, VERIFIED_HOLD_MS + 60));
      await t.stable();
      return t;
    }

    it('goes on to the profile step after the right code, and is not done yet', async () => {
      const t = await toProfileStep();
      expect(t.done).not.toHaveBeenCalled();
      expect(t.root.querySelector('app-profile-form')).not.toBeNull();
      expect(t.root.querySelector('h2')?.textContent).toContain('ตั้งโปรไฟล์ของคุณ');
      expect(t.root.querySelector('input[type="email"]')).toBeNull();
    });

    it('is done once the nickname is saved', async () => {
      const t = await toProfileStep();
      await t.type('input[autocomplete="nickname"]', 'น้องเมย์');
      await t.submit();
      expect(t.me.completeProfile).toHaveBeenCalledWith('น้องเมย์');
      expect(t.done).toHaveBeenCalledTimes(1);
    });

    it('a quick login of a member without a profile also goes to the profile step', async () => {
      const t = await setup({ quickLogin: DEMO, profile: NEW_MEMBER as typeof SET_UP });
      t.button('คนแจ้ง')!.click();
      await t.stable();
      expect(t.done).not.toHaveBeenCalled();
      expect(t.root.querySelector('app-profile-form')).not.toBeNull();
    });

    it('a profile that could not be read finishes the login (the profile sheet takes over later)', async () => {
      const t = await setup({ profile: null });
      await toCodeStep(t);
      await t.type('input[autocomplete="one-time-code"]', '123456');
      await t.submit();
      await new Promise((r) => setTimeout(r, VERIFIED_HOLD_MS + 60));
      expect(t.done).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the six cells filling from the left, and shakes the row on a wrong code', async () => {
    const t = await setup();
    t.auth.verifyCode.mockRejectedValue(new AuthError('badCode'));
    await toCodeStep(t);
    await t.type('input[autocomplete="one-time-code"]', '123');
    const cells = [...t.root.querySelectorAll('.cells .cell')];
    expect(cells.map((c) => c.textContent?.trim())).toEqual(['1', '2', '3', '', '', '']);
    expect(cells.map((c) => c.classList.contains('filled'))).toEqual([true, true, true, false, false, false]);
    expect(cells[3].classList.contains('now')).toBe(true);
    await t.type('input[autocomplete="one-time-code"]', '123456');
    await t.submit();
    expect(t.root.querySelector('.otp.shake')).not.toBeNull();
    expect(t.root.querySelector('.otp.ok')).toBeNull();
  });

  it('keeps only digits in the code field', async () => {
    const t = await setup();
    await toCodeStep(t);
    await t.type('input[autocomplete="one-time-code"]', '12 34-56');
    expect(t.root.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!.value).toBe('123456');
  });

  it('shows a wrong code in Thai in role="alert" and does not finish', async () => {
    const t = await setup();
    t.auth.verifyCode.mockRejectedValue(new AuthError('badCode'));
    await toCodeStep(t);
    await t.type('input[autocomplete="one-time-code"]', '000000');
    await t.submit();
    expect(t.root.querySelector('[role="alert"]')?.textContent).toContain('รหัสไม่ถูก หรือหมดอายุแล้ว');
    expect(t.done).not.toHaveBeenCalled();
  });

  it('shows a send failure in role="alert" and stays on the email step', async () => {
    const t = await setup();
    t.auth.sendCode.mockRejectedValue(new AuthError('tooOften'));
    await toCodeStep(t);
    expect(t.root.querySelector('[role="alert"]')?.textContent).toContain('ขอรหัสถี่ไปหน่อย');
    const email = t.root.querySelector('input[type="email"]')!;
    expect(email).not.toBeNull();
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });

  it('has no demo section when the API config cannot load, and email login still works', async () => {
    const t = await setup({ configFails: true });
    await t.stable();
    expect(t.root.textContent).not.toContain('สลับผู้ใช้สำหรับเดโม');
    await toCodeStep(t);
    expect(t.auth.sendCode).toHaveBeenCalledWith('pla@example.com');
  });

  it('unlocks "ส่งรหัสใหม่" after 60 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const t = await setup();
    await toCodeStep(t);
    expect(t.button('ส่งรหัสใหม่')!.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(59_000);
    await t.stable();
    expect(t.button('ส่งรหัสใหม่')!.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    await t.stable();
    const resend = t.button('ส่งรหัสใหม่')!;
    expect(resend.disabled).toBe(false);
    resend.click();
    await t.stable();
    expect(t.auth.sendCode).toHaveBeenCalledTimes(2);
    expect(t.button('ส่งรหัสใหม่')!.disabled).toBe(true);
  });

  it('goes back to the email step with "เปลี่ยนอีเมล"', async () => {
    const t = await setup();
    await toCodeStep(t);
    t.button('เปลี่ยนอีเมล')!.click();
    await t.stable();
    expect(t.root.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('pla@example.com');
  });

  it('has no demo section without quick login users', async () => {
    const t = await setup();
    await t.stable();
    expect(t.root.textContent).not.toContain('สลับผู้ใช้สำหรับเดโม');
  });

  it('offers one button per demo user and finishes after a quick login', async () => {
    const t = await setup({ quickLogin: DEMO });
    await t.stable();
    expect(t.root.textContent).toContain('สลับผู้ใช้สำหรับเดโม');
    for (const u of DEMO) expect(t.button(u.label_th)).toBeDefined();
    t.button('ผู้ดูแล')!.click();
    await t.stable();
    expect(t.auth.quickLogin).toHaveBeenCalledWith('admin');
    expect(t.done).toHaveBeenCalledTimes(1);
  });

  it('shows a failed quick login in role="alert"', async () => {
    const t = await setup({ quickLogin: DEMO });
    t.auth.quickLogin.mockRejectedValue(new AuthError('failed'));
    await t.stable();
    t.button('คนแจ้ง')!.click();
    await t.stable();
    expect(t.root.querySelector('[role="alert"]')?.textContent).toContain('เข้าสู่ระบบไม่สำเร็จ');
    expect(t.done).not.toHaveBeenCalled();
  });

  it('never shows a raw technical message, only the generic Thai one', async () => {
    const t = await setup({ quickLogin: DEMO });
    t.auth.sendCode.mockRejectedValue(new Error('config 503'));
    t.auth.quickLogin.mockRejectedValue(new TypeError('Failed to fetch'));
    await t.stable();
    await toCodeStep(t);
    const alert = t.root.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alert).not.toContain('config 503');
    expect(alert).toContain('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    t.button('คนแจ้ง')!.click();
    await t.stable();
    const all = t.root.textContent ?? '';
    expect(all).not.toContain('Failed to fetch');
    expect(all).toContain('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ');
  });
});
