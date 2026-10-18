import { TestBed } from '@angular/core/testing';
import { DeviceService } from './device.service';

function stubGeo(impl: ((ok: PositionCallback, err: PositionErrorCallback) => void) | undefined) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: impl ? { getCurrentPosition: impl } : undefined,
  });
}

describe('DeviceService', () => {
  afterEach(() => {
    vi.useRealTimers();
    // jsdom has no geolocation by default: remove our stub
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  it('resolves { lng, lat } on success', async () => {
    stubGeo((ok) => ok({ coords: { longitude: 100.5, latitude: 13.75 } } as GeolocationPosition));
    expect(await TestBed.inject(DeviceService).currentPosition()).toEqual({ lng: 100.5, lat: 13.75 });
  });

  it('passes the timeout to the browser', async () => {
    let seen: PositionOptions | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback, _e: PositionErrorCallback, o?: PositionOptions) => {
          seen = o;
          ok({ coords: { longitude: 1, latitude: 2 } } as GeolocationPosition);
        },
      },
    });
    await TestBed.inject(DeviceService).currentPosition(5000);
    expect(seen?.timeout).toBe(5000);
  });

  it('resolves null when permission is denied', async () => {
    stubGeo((_ok, err) => err({ code: 1, message: 'denied' } as GeolocationPositionError));
    expect(await TestBed.inject(DeviceService).currentPosition()).toBeNull();
  });

  it('resolves null when there is no navigator.geolocation', async () => {
    stubGeo(undefined);
    expect(await TestBed.inject(DeviceService).currentPosition()).toBeNull();
  });

  it('resolves null when getCurrentPosition throws', async () => {
    stubGeo(() => {
      throw new Error('boom');
    });
    expect(await TestBed.inject(DeviceService).currentPosition()).toBeNull();
  });

  it('resolves null on timeout even if the browser never answers', async () => {
    vi.useFakeTimers();
    stubGeo(() => {});
    const p = TestBed.inject(DeviceService).currentPosition(8000);
    await vi.advanceTimersByTimeAsync(9000);
    expect(await p).toBeNull();
  });
});
