import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { LoginPage } from './login.page';

async function setup(next: string | null, signedIn = false) {
  const nav = { navigateRoot: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: NavController, useValue: nav },
      {
        provide: AuthService,
        useValue: {
          ready: Promise.resolve(),
          signedIn: signal(signedIn),
          sendCode: vi.fn(),
          verifyCode: vi.fn(),
          quickLogin: vi.fn(),
        },
      },
      { provide: SupabaseService, useValue: { config: async () => ({ supabaseAnonKey: 'k', quickLogin: [] }) } },
    ],
  });
  const fixture = TestBed.createComponent(LoginPage);
  fixture.componentRef.setInput('next', next);
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  return { fixture, nav, root: fixture.nativeElement as HTMLElement };
}

describe('LoginPage', () => {
  it('sits on the shared backdrop', async () => {
    const { root } = await setup(null);
    expect(root.querySelector('app-backdrop')).not.toBeNull();
    expect(root.querySelector('.wrap .card')?.classList).toContain('glass');
  });

  it('shows the login form', async () => {
    const { root } = await setup(null);
    expect(root.querySelector('app-login-form')).not.toBeNull();
  });

  it('goes to a safe next after login, clearing the stack', async () => {
    const { fixture, nav } = await setup('/r/abc');
    fixture.componentInstance.finish();
    expect(nav.navigateRoot).toHaveBeenCalledWith('/r/abc');
  });

  it.each(['//evil.example', 'https://evil.example', '/\\evil'])('never leaves the app for next=%s', async (next) => {
    const { fixture, nav } = await setup(next);
    fixture.componentInstance.finish();
    expect(nav.navigateRoot).toHaveBeenCalledWith('/');
  });

  it('moves on straight away when already signed in', async () => {
    const { nav } = await setup('/r/abc', true);
    expect(nav.navigateRoot).toHaveBeenCalledWith('/r/abc');
  });
});
