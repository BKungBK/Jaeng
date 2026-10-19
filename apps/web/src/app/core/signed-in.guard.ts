import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Waits for the stored session to load, then sends a signed-out visitor to /login?next=<where they were going>. */
export const signedInGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.signedIn() ? true : router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};
