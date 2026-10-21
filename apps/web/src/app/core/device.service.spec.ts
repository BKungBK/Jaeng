import { TestBed } from '@angular/core/testing';
import { CAMERA, DeviceService, GEOLOCATION } from './device.service';
import { platform } from './platform';

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

type Perm = { location: string; coarseLocation?: string };

/** The service in the APK, with fake plugins. */
function inApp(opts: { perm?: Perm; asked?: Perm; position?: () => Promise<unknown>; photo?: () => Promise<unknown>; photos?: () => Promise<unknown> } = {}) {
  vi.spyOn(platform, 'isNative').mockReturnValue(true);
  const geo = {
    checkPermissions: vi.fn().mockResolvedValue(opts.perm ?? { location: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue(opts.asked ?? { location: 'granted' }),
    getCurrentPosition: vi.fn(opts.position ?? (async () => ({ coords: { longitude: 100.5, latitude: 13.75 } }))),
  };
  const camera = {
    getPhoto: vi.fn(opts.photo ?? (async () => ({ webPath: 'blob:photo' }))),
    pickImages: vi.fn(opts.photos ?? (async () => ({ photos: [{ webPath: 'blob:a' }, { webPath: 'blob:b' }] }))),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: GEOLOCATION, useValue: geo },
      { provide: CAMERA, useValue: camera },
    ],
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })));
  return { device: TestBed.inject(DeviceService), geo, camera };
}

describe('DeviceService in the app', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads the position through the plugin and asks nothing when already allowed', async () => {
    const { device, geo } = inApp();
    expect(device.native).toBe(true);
    expect(await device.currentPosition(5000)).toEqual({ lng: 100.5, lat: 13.75 });
    expect(geo.requestPermissions).not.toHaveBeenCalled();
    expect(geo.getCurrentPosition).toHaveBeenCalledWith({ enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 });
  });

  it('asks for the permission once, and goes on when it is given (approximate counts)', async () => {
    const { device, geo } = inApp({ perm: { location: 'prompt' }, asked: { location: 'denied', coarseLocation: 'granted' } });
    expect(await device.currentPosition()).toEqual({ lng: 100.5, lat: 13.75 });
    expect(geo.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('is null without reading when the permission is refused', async () => {
    const { device, geo } = inApp({ perm: { location: 'prompt' }, asked: { location: 'denied' } });
    expect(await device.currentPosition()).toBeNull();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('is null, not an error, when the plugin fails (GPS switched off)', async () => {
    const { device } = inApp({
      position: async () => {
        throw new Error('Location services are not enabled');
      },
    });
    expect(await device.currentPosition()).toBeNull();
  });

  it('is null when the plugin never answers', async () => {
    vi.useFakeTimers();
    const { device } = inApp({ position: () => new Promise(() => {}) });
    const p = device.currentPosition(8000);
    await vi.advanceTimersByTimeAsync(9000);
    expect(await p).toBeNull();
  });

  it('takePhoto turns the plugin\'s photo into a File of its own type', async () => {
    const { device, camera } = inApp();
    const file = await device.takePhoto();
    expect(file?.type).toBe('image/jpeg');
    expect(file?.name).toMatch(/^jaeng-\d+\.jpg$/);
    expect(camera.getPhoto).toHaveBeenCalledWith(expect.objectContaining({ source: 'CAMERA', resultType: 'uri' }));
  });

  it('takePhoto is null when the reader cancels the camera', async () => {
    const { device } = inApp({
      photo: async () => {
        throw new Error('User cancelled photos app');
      },
    });
    expect(await device.takePhoto()).toBeNull();
  });

  it('pickPhotos asks for at most `limit` and returns Files; [] when cancelled', async () => {
    const { device, camera } = inApp();
    const files = await device.pickPhotos(4);
    expect(files).toHaveLength(2);
    expect(camera.pickImages).toHaveBeenCalledWith(expect.objectContaining({ limit: 4 }));

    TestBed.resetTestingModule();
    const cancelled = inApp({
      photos: async () => {
        throw new Error('User cancelled photos app');
      },
    });
    expect(await cancelled.device.pickPhotos(4)).toEqual([]);
  });
});
