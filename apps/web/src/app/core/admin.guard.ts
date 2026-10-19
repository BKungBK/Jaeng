import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * /admin: signed out -> /login?next=…, signed in but not an admin -> home. Waits for the profile to
 * load first, so refreshing the page never sends a real admin away. The API checks the role again.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  if (!auth.signedIn()) return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
  const profile = await auth.loadedProfile();
  return profile?.role === 'admin' ? true : router.createUrlTree(['/']);
};
