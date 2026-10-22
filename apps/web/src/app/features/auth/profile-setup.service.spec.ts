import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { LoginPromptService } from './login-prompt.service';
import { ProfileSetupService, ProfileSheetComponent } from './profile-setup.service';

type P = { id: string; onboarded_at: string | null };

function setup(opts: { profile?: P | null; signedIn?: boolean; url?: string; loginBusy?: Promise<void> } = {}) {
  const profile = signal<P | null>(opts.profile === undefined ? { id: 'u1', onboarded_at: null } : opts.profile);
  const signedIn = signal(opts.signedIn ?? true);
  let resolve!: (v: { role?: string }) => void;
  const modal = {
    present: vi.fn().mockResolvedValue(undefined),
    onDidDismiss: vi.fn(() => new Promise<{ role?: string }>((r) => (resolve = r))),
  };
  const modals = { create: vi.fn().mockResolvedValue(modal), dismiss: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: ModalController, useValue: modals },
      { provide: AuthService, useValue: { profile, signedIn } },
      { provide: LoginPromptService, useValue: { whenIdle: () => opts.loginBusy ?? Promise.resolve() } },
      { provide: Router, useValue: { url: opts.url ?? '/' } },
    ],
  });
  const service = TestBed.inject(ProfileSetupService);
  const flush = async () => {
    TestBed.tick();
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  return { service, modals, modal, profile, signedIn, flush, close: (role: string) => resolve({ role }) };
}

describe('ProfileSetupService', () => {
  it('opens the profile sheet for a signed-in member who has not set up their profile', async () => {
    const { modals, modal, flush } = setup();
    await flush();
    expect(modals.create).toHaveBeenCalledTimes(1);
    expect(modals.create).toHaveBeenCalledWith(expect.objectContaining({ component: ProfileSheetComponent, cssClass: 'login-sheet', backdropDismiss: false }));
    expect(modal.present).toHaveBeenCalled();
  });

  it('cannot be dismissed by a swipe or the backdrop, only by finishing or signing out', async () => {
    const { modals, flush } = setup();
    await flush();
    const { canDismiss } = modals.create.mock.calls[0][0];
    expect(await canDismiss(undefined, 'done')).toBe(true);
    expect(await canDismiss(undefined, 'signout')).toBe(true);
    expect(await canDismiss(undefined, 'backdrop')).toBe(false);
    expect(await canDismiss(undefined, 'gesture')).toBe(false);
  });

  it('does not open for a member whose profile is set up, nor while signed out, nor before the profile is read', async () => {
    for (const opts of [
      { profile: { id: 'u1', onboarded_at: '2026-10-01T00:00:00Z' } },
      { signedIn: false },
      { profile: null },
    ]) {
      TestBed.resetTestingModule();
      const { modals, flush } = setup(opts);
      await flush();
      expect(modals.create).not.toHaveBeenCalled();
    }
  });

  it('does not stack a second sheet on the first', async () => {
    const { service, modals, flush } = setup();
    await flush();
    await service.ensure();
    expect(modals.create).toHaveBeenCalledTimes(1);
  });

  it('waits for the login sheet, and stays closed if the login sheet already set the profile up', async () => {
    let finishLogin!: () => void;
    const { modals, profile, flush } = setup({ loginBusy: new Promise<void>((r) => (finishLogin = r)) });
    await flush();
    expect(modals.create).not.toHaveBeenCalled();
    profile.set({ id: 'u1', onboarded_at: '2026-10-22T00:00:00Z' });
    finishLogin();
    await flush();
    expect(modals.create).not.toHaveBeenCalled();
  });

  it('leaves the /login page to its own profile step', async () => {
    const { modals, flush } = setup({ url: '/login?next=%2F' });
    await flush();
    expect(modals.create).not.toHaveBeenCalled();
  });

  it('can open again once it has been closed and the member still has no profile', async () => {
    const { service, modals, close, flush } = setup();
    await flush();
    close('signout');
    await flush();
    void service.ensure(); // the second sheet stays open in this test, so it is not awaited
    await flush();
    expect(modals.create).toHaveBeenCalledTimes(2);
  });
});
