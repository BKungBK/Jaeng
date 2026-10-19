import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService, Profile } from './auth.service';

@Component({ template: '' })
class Dummy {}

function setup(signedIn: boolean, loadedProfile: () => Promise<Profile | null>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { ready: Promise.resolve(), signedIn: () => signedIn, loadedProfile } },
      provideRouter([
        { path: '', component: Dummy },
        { path: 'admin', component: Dummy, canActivate: [adminGuard] },
        { path: 'login', component: Dummy },
      ]),
    ],
  });
  return TestBed.inject(Router);
}

const admin: Profile = { id: 'a', display_name: 'แอดมิน', role: 'admin' };
const user: Profile = { id: 'u', display_name: 'พี่ปลา', role: 'user' };
const run = () => TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/admin' } as never));

describe('adminGuard', () => {
  it('sends a signed-out visitor to /login with next', async () => {
    const router = setup(false, async () => null);
    await router.navigateByUrl('/admin');
    expect(router.url).toBe('/login?next=%2Fadmin');
  });

  it('sends a member who is not an admin home', async () => {
    setup(true, async () => user);
    const result = await run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  it('lets an admin in', async () => {
    const router = setup(true, async () => admin);
    expect(await router.navigateByUrl('/admin')).toBe(true);
    expect(router.url).toBe('/admin');
  });

  it('waits for a slow profile instead of sending a real admin away on refresh', async () => {
    setup(true, () => new Promise((r) => setTimeout(() => r(admin), 50)));
    expect(await run()).toBe(true);
  });

  it('sends home when the profile could not be read', async () => {
    setup(true, async () => null);
    expect(TestBed.inject(Router).serializeUrl((await run()) as UrlTree)).toBe('/');
  });
});
