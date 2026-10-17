import { TestBed } from '@angular/core/testing';
import type { DemoUser } from '@jaeng/shared/api';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { LoginFormComponent } from './login-form.component';

const DEMO: DemoUser[] = [
  { who: 'reporter', label_th: 'คนแจ้ง' },
  { who: 'neighbor1', label_th: 'เพื่อนบ้าน' },
  { who: 'admin', label_th: 'ผู้ดูแล' },
];

async function setup(opts: { quickLogin?: DemoUser[]; configFails?: boolean } = {}) {
  const auth = {
    sendCode: vi.fn().mockResolvedValue(undefined),
    verifyCode: vi.fn().mockResolvedValue(undefined),
    quickLogin: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
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
  return { fixture, root, auth, done, type, button, submit, stable };
}

async function toCodeStep(t: Awaited<ReturnType<typeof setup>>) {
  await t.type('input[type="email"]', 'pla@example.com');
  await t.submit();
}

describe('LoginFormComponent', () => {
  afterEach(() => vi.useRealTimers());

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
    expect(t.done).toHaveBeenCalledTimes(1);
  });

  it('keeps only digits in the code field', async () => {
    const t = await setup();
    await toCodeStep(t);
    await t.type('input[autocomplete="one-time-code"]', '12 34-56');
    expect(t.root.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!.value).toBe('123456');
  });

  it('shows a wrong code in Thai in role="alert" and does not finish', async () => {
    const t = await setup();
    t.auth.verifyCode.mockRejectedValue(new Error('รหัสไม่ถูก หรือหมดอายุแล้ว ลองขอรหัสใหม่นะ'));
    await toCodeStep(t);
    await t.type('input[autocomplete="one-time-code"]', '000000');
    await t.submit();
    expect(t.root.querySelector('[role="alert"]')?.textContent).toContain('รหัสไม่ถูก หรือหมดอายุแล้ว');
    expect(t.done).not.toHaveBeenCalled();
  });

  it('shows a send failure in role="alert" and stays on the email step', async () => {
    const t = await setup();
    t.auth.sendCode.mockRejectedValue(new Error('ขอรหัสถี่ไปหน่อย รอสักครู่แล้วลองใหม่นะ'));
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
    t.auth.quickLogin.mockRejectedValue(new Error('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ'));
    await t.stable();
    t.button('คนแจ้ง')!.click();
    await t.stable();
    expect(t.root.querySelector('[role="alert"]')?.textContent).toContain('เข้าสู่ระบบไม่สำเร็จ');
    expect(t.done).not.toHaveBeenCalled();
  });
});
