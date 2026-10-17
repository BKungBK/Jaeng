import { TestBed } from '@angular/core/testing';
import { ApiError, ApiService } from './api.service';
import { AuthService } from './auth.service';

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setup(tokens: { access: string | null; refreshed?: string | null }, ...responses: Response[]) {
  const accessToken = vi.fn().mockResolvedValue(tokens.access);
  const refresh = vi.fn().mockResolvedValue(tokens.refreshed ?? null);
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { accessToken, refresh } }] });
  return { accessToken, refresh, fetchMock, service: TestBed.inject(ApiService) };
}

describe('ApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects with 401 unauthorized without calling fetch when there is no token', async () => {
    const { service, fetchMock } = setup({ access: null });
    await expect(service.post('/reports/1/confirm')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts JSON with the bearer token under /api', async () => {
    const { service, fetchMock } = setup({ access: 'tok' }, jsonRes(200, { ok: 1 }));
    expect(await service.post('/x', { a: 1 })).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/x');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.body).toBe('{"a":1}');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const { service, fetchMock, refresh } = setup(
      { access: 'old', refreshed: 'new' },
      jsonRes(401, { error: { code: 'unauthorized', message_th: 'x', message_en: 'x' } }),
      jsonRes(200, { done: true }),
    );
    expect(await service.post('/x')).toEqual({ done: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new');
  });

  it('throws when the retry is still 401, without looping', async () => {
    const body = { error: { code: 'unauthorized', message_th: 'เข้าสู่ระบบใหม่นะ', message_en: 'x' } };
    const { service, fetchMock, refresh } = setup(
      { access: 'old', refreshed: 'new' },
      jsonRes(401, body),
      jsonRes(401, body),
    );
    await expect(service.post('/x')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws 401 when refresh yields no token', async () => {
    const { service, fetchMock } = setup(
      { access: 'old', refreshed: null },
      jsonRes(401, { error: { code: 'unauthorized', message_th: 'x', message_en: 'x' } }),
    );
    await expect(service.post('/x')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps the error body to ApiError with message_th', async () => {
    const { service } = setup(
      { access: 't' },
      jsonRes(404, { error: { code: 'report_not_found', message_th: 'ไม่พบเรื่องนี้', message_en: 'nf' } }),
    );
    const err = await service.post('/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'report_not_found', messageTh: 'ไม่พบเรื่องนี้' });
  });

  it('uses code internal when the body is not JSON', async () => {
    const { service } = setup({ access: 't' }, new Response('<html>oops</html>', { status: 502 }));
    await expect(service.post('/x')).rejects.toMatchObject({ status: 502, code: 'internal' });
  });
});
