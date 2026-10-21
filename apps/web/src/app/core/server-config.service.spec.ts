import { TestBed } from '@angular/core/testing';
import { platform } from './platform';
import {
  normalizeServerUrl,
  publicPhotoUrl,
  ServerCheckError,
  ServerConfigService,
  serverOrigin,
  serverUrl,
  setServerOrigin,
} from './server-config.service';

const health = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

let setPreference: ReturnType<typeof vi.spyOn>;

function native(fetchMock: ReturnType<typeof vi.fn>, saved: string | null = null) {
  vi.spyOn(platform, 'isNative').mockReturnValue(true);
  vi.spyOn(platform, 'getPreference').mockResolvedValue(saved);
  setPreference = vi.spyOn(platform, 'setPreference').mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetchMock);
  return TestBed.inject(ServerConfigService);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setServerOrigin(null);
});

describe('normalizeServerUrl', () => {
  it('turns what people type into scheme://host[:port]', () => {
    expect(normalizeServerUrl('192.168.1.5:8000')).toBe('http://192.168.1.5:8000');
    expect(normalizeServerUrl(' http://192.168.1.5:8000/ ')).toBe('http://192.168.1.5:8000');
    expect(normalizeServerUrl('https://jaeng.example/x?y#z')).toBe('https://jaeng.example');
  });

  it('refuses what cannot be a server', () => {
    for (const bad of ['', '   ', 'ftp://x', 'http://', 'a b']) expect(normalizeServerUrl(bad)).toBeNull();
  });
});

describe('ServerConfigService in the app', () => {
  it('init: the saved address wins over server.json', async () => {
    const fetchMock = vi.fn();
    const service = native(fetchMock, '192.168.1.9:8000');
    await service.init();
    expect(service.address()).toBe('http://192.168.1.9:8000');
    expect(serverOrigin()).toBe('http://192.168.1.9:8000');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('init: falls back to the address the APK was built with', async () => {
    const service = native(vi.fn().mockResolvedValue(health({ server: 'http://192.168.1.5:8000' })));
    await service.init();
    expect(service.address()).toBe('http://192.168.1.5:8000');
  });

  it('init: with no address anywhere stays empty and does not throw', async () => {
    const service = native(vi.fn().mockRejectedValue(new Error('404')));
    await expect(service.init()).resolves.toBeUndefined();
    expect(service.address()).toBe('');
    expect(await service.startupProblem()).toBe('unset');
  });

  it('check tells the three failures apart', async () => {
    const service = native(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await service.check('nonsense url')).toEqual({ ok: false, reason: 'invalid' });
    expect(await service.check('192.168.1.5:8000')).toEqual({ ok: false, reason: 'unreachable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(health('<html>router login</html>')));
    expect(await service.check('192.168.1.5:8000')).toEqual({ ok: false, reason: 'notJaeng' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(health({ ok: true, db: true })));
    expect(await service.check('192.168.1.5:8000')).toEqual({ ok: true, address: 'http://192.168.1.5:8000' });
  });

  it('check: a server whose database is down is still the right server', async () => {
    const service = native(vi.fn().mockResolvedValue(health({ ok: false, db: false }, 503)));
    expect(await service.check('192.168.1.5:8000')).toEqual({ ok: true, address: 'http://192.168.1.5:8000' });
  });

  it('check: gives up when nothing answers in time', async () => {
    const hang = vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    const service = native(hang);
    expect(await service.check('192.168.1.5:8000', 20)).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('save stores the address and reloads, but only for a server that answers', async () => {
    const reload = vi.spyOn(platform, 'reload').mockImplementation(() => undefined);
    const service = native(vi.fn().mockRejectedValue(new Error('down')));
    await expect(service.save('192.168.1.5:8000')).rejects.toBeInstanceOf(ServerCheckError);
    expect(setPreference).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(health({ ok: true, db: true })));
    await service.save('192.168.1.5:8000/');
    expect(setPreference).toHaveBeenCalledWith('server', 'http://192.168.1.5:8000');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('startupProblem is null on the web', async () => {
    expect(await TestBed.inject(ServerConfigService).startupProblem()).toBeNull();
  });
});

describe('server address', () => {
  afterEach(() => setServerOrigin(null));

  it('is the page origin on the web', () => {
    expect(serverOrigin()).toBe(location.origin);
    expect(serverUrl('/sb/storage/x.webp')).toBe(`${location.origin}/sb/storage/x.webp`);
  });

  it('is the saved address in the app', () => {
    setServerOrigin('http://192.168.1.5:8000');
    expect(serverOrigin()).toBe('http://192.168.1.5:8000');
    expect(serverUrl('/sb/storage/x.webp')).toBe('http://192.168.1.5:8000/sb/storage/x.webp');
    const service = TestBed.inject(ServerConfigService);
    expect(service.apiUrl('/reports')).toBe('http://192.168.1.5:8000/api/reports');
    expect(service.sbUrl()).toBe('http://192.168.1.5:8000/sb');
  });

  it('puts the server in front of a public photo path', () => {
    setServerOrigin('http://192.168.1.5:8000/');
    expect(publicPhotoUrl('r1/p1.webp')).toBe('http://192.168.1.5:8000/sb/storage/v1/object/public/photos-public/r1/p1.webp');
  });

  it('leaves full URLs alone', () => {
    setServerOrigin('http://192.168.1.5:8000');
    expect(serverUrl('https://a.b/c.png')).toBe('https://a.b/c.png');
    expect(serverUrl('blob:xyz')).toBe('blob:xyz');
    expect(serverUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
  });
});
