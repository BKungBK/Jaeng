import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

function setup(isEnabled: boolean) {
  const versionUpdates = new Subject<VersionEvent>();
  const subscribe = vi.spyOn(versionUpdates, 'subscribe');
  TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: { isEnabled, versionUpdates } }] });
  return { svc: TestBed.inject(AppUpdateService), versionUpdates, subscribe };
}

describe('AppUpdateService', () => {
  it('offers a reload once a new version is ready', () => {
    const { svc, versionUpdates } = setup(true);
    expect(svc.ready()).toBe(false);
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(svc.ready()).toBe(false);
    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    expect(svc.ready()).toBe(true);
    svc.dismiss();
    expect(svc.ready()).toBe(false);
  });

  it('does nothing while the service worker is off (the dev server)', () => {
    const { svc, subscribe } = setup(false);
    expect(subscribe).not.toHaveBeenCalled();
    expect(svc.ready()).toBe(false);
  });
});
