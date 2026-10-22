import { I18nService } from '../../core/i18n.service';
import { MeService } from '../me/me.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PopoverController } from '@ionic/angular';
import { AuthService, Profile } from '../../core/auth.service';
import { AccountButtonComponent, AccountMenuComponent, initialOf } from './account-button.component';
import { ReportDraftService } from '../report-new/report-draft.service';
import { LoginPromptService } from './login-prompt.service';

async function setup(
  opts: { signedIn?: boolean; profile?: Profile | null; dismissRole?: string; variant?: 'icon' | 'tab' } = {},
) {
  const auth = {
    signedIn: signal(opts.signedIn ?? false),
    profile: signal<Profile | null>(opts.profile ?? null),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const prompt = { ask: vi.fn().mockResolvedValue(true) };
  const popover = {
    present: vi.fn().mockResolvedValue(undefined),
    onDidDismiss: vi.fn().mockResolvedValue({ role: opts.dismissRole }),
  };
  const popovers = { create: vi.fn().mockResolvedValue(popover) };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const draft = { reset: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: LoginPromptService, useValue: prompt },
      { provide: PopoverController, useValue: popovers },
      { provide: Router, useValue: router },
      { provide: ReportDraftService, useValue: draft },
    ],
  });
  const fixture = TestBed.createComponent(AccountButtonComponent);
  if (opts.variant) fixture.componentRef.setInput('variant', opts.variant);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const button = root.querySelector<HTMLButtonElement>('button')!;
  return { fixture, root, button, auth, prompt, popovers, popover, router, draft };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('AccountButtonComponent', () => {
  it('says "เข้าสู่ระบบ" when signed out and opens the login sheet', async () => {
    const { button, prompt, popovers } = await setup();
    expect(button.getAttribute('aria-label')).toBe('เข้าสู่ระบบ');
    button.click();
    await flush();
    expect(prompt.ask).toHaveBeenCalled();
    expect(popovers.create).not.toHaveBeenCalled();
  });

  it('tab: names the dock slot and still says what it does', async () => {
    const { button } = await setup({ variant: 'tab' });
    expect(button.getAttribute('aria-label')).toBe('ของฉัน: เข้าสู่ระบบ');
    expect(button.textContent?.trim()).toBe('ของฉัน');
  });

  it('names the account when signed in and follows sign-in changes', async () => {
    const { fixture, button, auth } = await setup();
    auth.signedIn.set(true);
    auth.profile.set({ id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('บัญชี: พี่ปลา');
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('Account: พี่ปลา');
  });

  it('shows the name initial when signed in, so the state is not told by colour alone', async () => {
    const { fixture, root, auth } = await setup();
    const signedOut = root.querySelector('button')!.innerHTML;
    expect(root.querySelector('.initial')).toBeNull();
    auth.signedIn.set(true);
    auth.profile.set({ id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    await fixture.whenStable();
    expect(root.querySelector('.initial')?.textContent?.trim()).toBe('พี่');
    expect(root.querySelector('button app-icon')).toBeNull();
    expect(root.querySelector('button')!.innerHTML).not.toBe(signedOut);
  });

  it('shows the member\'s picture instead of the initial when they have one', async () => {
    const { root } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th', avatar_path: 'u1/a.webp', onboarded_at: '2026-10-01T00:00:00Z' },
    });
    expect(root.querySelector('button app-avatar img')?.getAttribute('src')).toContain('/avatars/u1/a.webp');
    expect(root.querySelector('.initial')).toBeNull();
  });

  it('keeps the icon while the profile loads', async () => {
    const { root } = await setup({ signedIn: true, profile: null });
    expect(root.querySelector('.initial')).toBeNull();
    expect(root.querySelector('button app-icon')).not.toBeNull();
  });

  it('has a label while the profile is still loading', async () => {
    const { button } = await setup({ signedIn: true, profile: null });
    expect(button.getAttribute('aria-label')).toBe('บัญชีของฉัน');
  });

  it('opens the account popover when signed in', async () => {
    const { button, popovers, popover, prompt } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' },
    });
    button.click();
    await flush();
    expect(popovers.create).toHaveBeenCalledWith(expect.objectContaining({ component: AccountMenuComponent }));
    expect(popover.present).toHaveBeenCalled();
    expect(prompt.ask).not.toHaveBeenCalled();
  });

  it('opens the login sheet when the menu asks to switch user', async () => {
    const { button, prompt } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' },
      dismissRole: 'switch',
    });
    button.click();
    await flush();
    expect(prompt.ask).toHaveBeenCalled();
  });

  it('opens /me when the menu asks for "เรื่องของฉัน"', async () => {
    const { button, router, prompt } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' },
      dismissRole: 'mine',
    });
    button.click();
    await flush();
    expect(router.navigate).toHaveBeenCalledWith(['/me']);
    expect(prompt.ask).not.toHaveBeenCalled();
  });

  it('opens /admin when the menu asks for "หน้าผู้ดูแล"', async () => {
    const { button, router } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'admin', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' },
      dismissRole: 'admin',
    });
    button.click();
    await flush();
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('signs out when the menu asks to', async () => {
    const { button, auth } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' },
      dismissRole: 'signout',
    });
    button.click();
    await flush();
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('throws away an unsent report draft on a deliberate sign-out', async () => {
    const { button, auth, draft } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' },
      dismissRole: 'signout',
    });
    button.click();
    await flush();
    expect(auth.signOut).toHaveBeenCalled();
    expect(draft.reset).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft when the menu only switches user (the draft drops itself if the user changes)', async () => {
    const { button, draft } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' },
      dismissRole: 'switch',
    });
    button.click();
    await flush();
    expect(draft.reset).not.toHaveBeenCalled();
  });
});

describe('initialOf', () => {
  it.each([
    ['พี่ปลา', 'พี่'], // consonant with its combining marks stays whole
    ['เพื่อนบ้านใจดี', 'พื่'], // a leading vowel is skipped: it is not a letter on its own
    ['Admin', 'A'],
    ['  บุญมี', 'บุ'],
    ['', ''],
  ])('%s -> %s', (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });
});

describe('AccountMenuComponent', () => {
  function menu(profile: Profile | null) {
    const popovers = { dismiss: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { profile: signal(profile) } },
        { provide: PopoverController, useValue: popovers },
        { provide: MeService, useValue: { setLocale: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    const fixture = TestBed.createComponent(AccountMenuComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))!;
    return { root, popovers, button, fixture };
  }

  it('shows the name, switch and sign out, and no admin tag for a user', () => {
    const { root, button } = menu({ id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    expect(root.textContent).toContain('พี่ปลา');
    expect(root.textContent).not.toContain('ผู้ดูแล');
    expect(button('สลับผู้ใช้')).toBeDefined();
    expect(button('ออกจากระบบ')).toBeDefined();
  });

  it('puts the member\'s face before their name', () => {
    const { root } = menu({ id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th', avatar_path: 'u1/a.webp', onboarded_at: '2026-10-01T00:00:00Z' });
    expect(root.querySelector('.account-menu-who app-avatar img')?.getAttribute('src')).toContain('/avatars/u1/a.webp');
  });

  it('tags an admin with "ผู้ดูแล"', () => {
    const { root } = menu({ id: 'u1', display_name: 'แอดมิน', role: 'admin', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    expect(root.querySelector('.tag')?.textContent?.trim()).toBe('ผู้ดูแล');
  });

  it('lists "เรื่องของฉัน" first among the actions, signed in', () => {
    const { root, button, popovers } = menu({ id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    const rows = [...root.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(rows).toEqual(['เรื่องของฉัน', 'English', 'เกี่ยวกับแจ้ง', 'สลับผู้ใช้', 'ออกจากระบบ']);
    button('เรื่องของฉัน').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'mine');
  });

  it('shows "หน้าผู้ดูแล" between my reports and switch user, for an admin only', () => {
    const { root, button, popovers } = menu({ id: 'u1', display_name: 'แอดมิน', role: 'admin', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    const rows = [...root.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(rows).toEqual(['เรื่องของฉัน', 'หน้าผู้ดูแล', 'English', 'เกี่ยวกับแจ้ง', 'สลับผู้ใช้', 'ออกจากระบบ']);
    button('หน้าผู้ดูแล').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'admin');
  });

  it('switches the language in place, keeps the menu open and saves it to the account', async () => {
    const { root, button, popovers, fixture } = menu({ id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    button('English').click();
    await fixture.whenStable();
    expect(TestBed.inject(I18nService).locale()).toBe('en');
    expect(TestBed.inject(MeService).setLocale).toHaveBeenCalledWith('en');
    expect(popovers.dismiss).not.toHaveBeenCalled();
    expect([...root.querySelectorAll('button')].map((b) => b.textContent?.trim())).toContain('ไทย');
    button('About Jaeng').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'about');
  });

  it('dismisses with the chosen action', () => {
    const { button, popovers } = menu({ id: 'u1', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    button('สลับผู้ใช้').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'switch');
    button('ออกจากระบบ').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'signout');
  });
});
