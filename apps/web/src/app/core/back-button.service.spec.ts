import { TestBed } from '@angular/core/testing';
import { Platform } from '@ionic/angular';
import { BACK_PRIORITY, BackButtonService, EXIT_APP, type BackHandler } from './back-button.service';
import { platform } from './platform';

function setup() {
  const unsubscribe = vi.fn();
  const subscribed: { priority: number; handler: BackHandler }[] = [];
  const ionic = {
    backButton: {
      subscribeWithPriority: vi.fn((priority: number, handler: BackHandler) => {
        subscribed.push({ priority, handler });
        return { unsubscribe };
      }),
    },
  };
  const exit = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: Platform, useValue: ionic },
      { provide: EXIT_APP, useValue: exit },
    ],
  });
  return { service: TestBed.inject(BackButtonService), subscribed, unsubscribe, exit };
}

describe('BackButtonService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('hands a handler to Ionic at its priority, and takes it back', () => {
    const { service, subscribed, unsubscribe } = setup();
    const stop = service.on(BACK_PRIORITY.page, vi.fn());
    expect(subscribed.map((s) => s.priority)).toEqual([50]);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('sits between Ionic\'s overlays (100) and its router (0): pages above the router, the exit below it', () => {
    expect(BACK_PRIORITY.page).toBeLessThan(100);
    expect(BACK_PRIORITY.page).toBeGreaterThan(0);
    expect(BACK_PRIORITY.panel).toBeGreaterThan(0);
    expect(BACK_PRIORITY.exit).toBeLessThan(0);
  });

  it('exits the app when the router has nothing to go back to', () => {
    vi.spyOn(platform, 'isNative').mockReturnValue(true);
    const { service, subscribed, exit } = setup();
    let canGoBack = false;
    service.startExitOnRoot({ canGoBack: () => canGoBack });
    expect(subscribed[0].priority).toBe(-1);
    subscribed[0].handler(() => undefined);
    expect(exit).toHaveBeenCalledTimes(1);
    canGoBack = true;
    subscribed[0].handler(() => undefined);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('does nothing on the web', () => {
    const { service, subscribed } = setup();
    service.startExitOnRoot({ canGoBack: () => false });
    expect(subscribed).toEqual([]);
  });
});
