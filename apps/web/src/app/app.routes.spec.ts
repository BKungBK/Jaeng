import { UrlSegment } from '@angular/router';
import { mapMatcher, routes } from './app.routes';
import { adminGuard } from './core/admin.guard';
import { signedInGuard } from './core/signed-in.guard';

describe('routes', () => {
  it('puts /report behind the signed-in guard', () => {
    const report = routes.find((r) => r.path === 'report');
    expect(report?.canActivate).toEqual([signedInGuard]);
    expect(report?.loadComponent).toBeDefined();
  });

  it('puts /admin behind the admin guard, before the catch-all', () => {
    const admin = routes.find((r) => r.path === 'admin');
    expect(admin?.canActivate).toEqual([adminGuard]);
    expect(admin?.loadComponent).toBeDefined();
    expect(routes.indexOf(admin!)).toBeLessThan(routes.findIndex((r) => r.path === '**'));
  });

  it('puts /me behind the signed-in guard, before the catch-all', () => {
    const me = routes.find((r) => r.path === 'me');
    expect(me?.canActivate).toEqual([signedInGuard]);
    expect(me?.loadComponent).toBeDefined();
    expect(routes.indexOf(me!)).toBeLessThan(routes.findIndex((r) => r.path === '**'));
  });
});

const segs = (...paths: string[]) => paths.map((p) => new UrlSegment(p, {}));

describe('mapMatcher', () => {
  it('matches the root with no params', () => {
    const r = mapMatcher([]);
    expect(r?.consumed).toEqual([]);
    expect(r?.posParams).toBeUndefined();
  });

  it('matches /r/:id and exposes the id', () => {
    const s = segs('r', 'x');
    const r = mapMatcher(s);
    expect(r?.consumed).toEqual(s);
    expect(r?.posParams?.['id'].path).toBe('x');
  });

  it('rejects everything else', () => {
    expect(mapMatcher(segs('r'))).toBeNull();
    expect(mapMatcher(segs('r', 'x', 'y'))).toBeNull();
    expect(mapMatcher(segs('login'))).toBeNull();
  });
});
