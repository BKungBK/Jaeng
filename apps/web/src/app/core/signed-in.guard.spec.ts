import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { signedInGuard } from './signed-in.guard';

@Component({ template: '' })
class Dummy {}

function setup(auth: { signedIn: () => boolean; ready: Promise<void> }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      provideRouter([
        { path: 'report', component: Dummy, canActivate: [signedInGuard] },
        { path: 'login', component: Dummy },
      ]),
    ],
  });
  return TestBed.inject(Router);
}

describe('signedInGuard', () => {
  it('lets a signed-in visitor through', async () => {
    const router = setup({ signedIn: () => true, ready: Promise.resolve() });
    expect(await router.navigateByUrl('/report')).toBe(true);
    expect(router.url).toBe('/report');
  });

  it('sends a signed-out visitor to /login with next', async () => {
    const router = setup({ signedIn: () => false, ready: Promise.resolve() });
    await router.navigateByUrl('/report');
    expect(router.url).toBe('/login?next=%2Freport');
  });

  it('returns a UrlTree when signed out', async () => {
    setup({ signedIn: () => false, ready: Promise.resolve() });
    const route = {} as never;
    const result = await TestBed.runInInjectionContext(() => signedInGuard(route, { url: '/report?a=1' } as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?next=%2Freport%3Fa%3D1');
  });

  it('waits for auth.ready before deciding', async () => {
    let release!: () => void;
    let signed = false;
    const ready = new Promise<void>((r) => (release = r));
    setup({ signedIn: () => signed, ready });
    let settled = false;
    const p = Promise.resolve(
      TestBed.runInInjectionContext(() => signedInGuard({} as never, { url: '/report' } as never)),
    ).then((v) => {
      settled = true;
      return v;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
    signed = true; // the session finishes loading
    release();
    expect(await p).toBe(true);
  });
});
