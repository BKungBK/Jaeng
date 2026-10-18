import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, RouteReuseStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { input } from '@angular/core';
import { AppRouteStrategy } from './route-strategy';
import { mapMatcher } from '../app.routes';

const snap = (routeConfig: Route | null) => ({ routeConfig }) as unknown as ActivatedRouteSnapshot;

describe('AppRouteStrategy', () => {
  const strategy = new AppRouteStrategy();
  const mapRoute: Route = { matcher: mapMatcher, data: { reuse: 'map' } };
  const login: Route = { path: 'login' };

  it('reuses the map route even when the params differ', () => {
    expect(strategy.shouldReuseRoute(snap(mapRoute), snap(mapRoute))).toBe(true);
  });

  it('does not reuse between the map and another route', () => {
    expect(strategy.shouldReuseRoute(snap(mapRoute), snap(login))).toBe(false);
    expect(strategy.shouldReuseRoute(snap(login), snap(mapRoute))).toBe(false);
  });
});

describe('the map route with AppRouteStrategy', () => {
  const created: object[] = [];

  @Component({ selector: 'app-fake-map', template: '' })
  class FakeMap {
    id = input<string>();
    constructor() {
      created.push(this);
    }
  }

  it('keeps the same page from / to /r/abc', async () => {
    created.length = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: RouteReuseStrategy, useClass: AppRouteStrategy },
        provideRouter(
          [
            { matcher: mapMatcher, data: { reuse: 'map' }, component: FakeMap },
            { path: '**', redirectTo: '' },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();
    const first = await harness.navigateByUrl('/', FakeMap);
    expect(first.id()).toBeUndefined();
    const second = await harness.navigateByUrl('/r/abc', FakeMap);
    expect(second).toBe(first);
    expect(second.id()).toBe('abc');
    expect(created).toHaveLength(1);
  });
});
