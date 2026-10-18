import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PopoverController } from '@ionic/angular';
import { AuthService, Profile } from '../../core/auth.service';
import { AccountButtonComponent, AccountMenuComponent, initialOf } from './account-button.component';
import { LoginPromptService } from './login-prompt.service';

async function setup(opts: { signedIn?: boolean; profile?: Profile | null; dismissRole?: string } = {}) {
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
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: LoginPromptService, useValue: prompt },
      { provide: PopoverController, useValue: popovers },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(AccountButtonComponent);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const button = root.querySelector<HTMLButtonElement>('button')!;
  return { fixture, root, button, auth, prompt, popovers, popover, router };
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

  it('names the account when signed in and follows sign-in changes', async () => {
    const { fixture, button, auth } = await setup();
    auth.signedIn.set(true);
    auth.profile.set({ id: 'u1', display_name: 'พี่ปลา', role: 'user' });
    await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('บัญชี: พี่ปลา');
  });

  it('shows the name initial when signed in, so the state is not told by colour alone', async () => {
    const { fixture, root, auth } = await setup();
    const signedOut = root.querySelector('button')!.innerHTML;
    expect(root.querySelector('.initial')).toBeNull();
    auth.signedIn.set(true);
    auth.profile.set({ id: 'u1', display_name: 'พี่ปลา', role: 'user' });
    await fixture.whenStable();
    expect(root.querySelector('.initial')?.textContent?.trim()).toBe('พี่');
    expect(root.querySelector('button app-icon')).toBeNull();
    expect(root.querySelector('button')!.innerHTML).not.toBe(signedOut);
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
      profile: { id: 'u1', display_name: 'พี่ปลา', role: 'user' },
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
      profile: { id: 'u1', display_name: 'a', role: 'user' },
      dismissRole: 'switch',
    });
    button.click();
    await flush();
    expect(prompt.ask).toHaveBeenCalled();
  });

  it('opens /me when the menu asks for "เรื่องของฉัน"', async () => {
    const { button, router, prompt } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'user' },
      dismissRole: 'mine',
    });
    button.click();
    await flush();
    expect(router.navigate).toHaveBeenCalledWith(['/me']);
    expect(prompt.ask).not.toHaveBeenCalled();
  });

  it('signs out when the menu asks to', async () => {
    const { button, auth } = await setup({
      signedIn: true,
      profile: { id: 'u1', display_name: 'a', role: 'user' },
      dismissRole: 'signout',
    });
    button.click();
    await flush();
    expect(auth.signOut).toHaveBeenCalled();
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
      ],
    });
    const fixture = TestBed.createComponent(AccountMenuComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))!;
    return { root, popovers, button };
  }

  it('shows the name, switch and sign out, and no admin tag for a user', () => {
    const { root, button } = menu({ id: 'u1', display_name: 'พี่ปลา', role: 'user' });
    expect(root.textContent).toContain('พี่ปลา');
    expect(root.textContent).not.toContain('ผู้ดูแล');
    expect(button('สลับผู้ใช้')).toBeDefined();
    expect(button('ออกจากระบบ')).toBeDefined();
  });

  it('tags an admin with "ผู้ดูแล"', () => {
    const { root } = menu({ id: 'u1', display_name: 'แอดมิน', role: 'admin' });
    expect(root.querySelector('.tag')?.textContent?.trim()).toBe('ผู้ดูแล');
  });

  it('lists "เรื่องของฉัน" first among the actions, signed in', () => {
    const { root, button, popovers } = menu({ id: 'u1', display_name: 'a', role: 'user' });
    const rows = [...root.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(rows).toEqual(['เรื่องของฉัน', 'สลับผู้ใช้', 'ออกจากระบบ']);
    button('เรื่องของฉัน').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'mine');
  });

  it('dismisses with the chosen action', () => {
    const { button, popovers } = menu({ id: 'u1', display_name: 'a', role: 'user' });
    button('สลับผู้ใช้').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'switch');
    button('ออกจากระบบ').click();
    expect(popovers.dismiss).toHaveBeenCalledWith(undefined, 'signout');
  });
});
