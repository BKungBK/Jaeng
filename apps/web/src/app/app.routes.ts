import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { signedInGuard } from './core/signed-in.guard';

/** `/` and `/r/:id` share one route so the map page (and its WebGL context) is never rebuilt. */
export function mapMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 2 && segments[0].path === 'r') return { consumed: segments, posParams: { id: segments[1] } };
  return null;
}

export const routes: Routes = [
  {
    matcher: mapMatcher,
    data: { reuse: 'map' },
    loadComponent: () => import('./features/map/map.page').then((m) => m.MapPage),
  },
  {
    path: 'report',
    canActivate: [signedInGuard],
    loadComponent: () => import('./features/report-new/report-new.page').then((m) => m.ReportNewPage),
  },
  {
    path: 'me',
    canActivate: [signedInGuard],
    loadComponent: () => import('./features/me/me.page').then((m) => m.MePage),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  { path: '**', redirectTo: '' },
];
