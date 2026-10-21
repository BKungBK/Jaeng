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
    expect(url).toBe(`${location.origin}/api/x`);
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
    expect(err).toMatchObject({ status: 404, code: 'report_not_found', messageTh: 'ไม่พบเรื่องนี้', messageEn: 'nf' });
  });

  it('words its own errors in both languages', async () => {
    const none = await setup({ access: null }).service.post('/x').catch((e) => e);
    expect(none).toMatchObject({ messageTh: 'เข้าสู่ระบบก่อนนะ', messageEn: 'Please sign in first.' });
    TestBed.resetTestingModule();
    const big = await setup({ access: 't' }, new Response('x', { status: 413 }))
      .service.upload('/photos', new FormData())
      .catch((e) => e);
    expect(big).toMatchObject({ code: 'photo_too_large', messageEn: 'The photo is too large (3 MB max).' });
    TestBed.resetTestingModule();
    const s = setup({ access: 't' });
    s.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const net = await s.service.post('/x').catch((e) => e);
    expect(net).toMatchObject({ code: 'network', messageEn: "Can't connect right now. Please try again." });
  });

  it('wraps a failed fetch as a network ApiError', async () => {
    const { service, fetchMock } = setup({ access: 't' });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = await service.post('/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'network', messageTh: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้งนะ' });
  });

  it('wraps a non-JSON 2xx body as internal', async () => {
    const { service } = setup({ access: 't' }, new Response('ok', { status: 200 }));
    await expect(service.post('/x')).rejects.toMatchObject({ code: 'internal' });
  });

  it('throws a fresh ApiError each time', async () => {
    const { service } = setup({ access: null });
    const a = await service.post('/x').catch((e) => e);
    const b = await service.post('/x').catch((e) => e);
    expect(a).not.toBe(b);
  });

  it('uses code internal when the body is not JSON', async () => {
    const { service } = setup({ access: 't' }, new Response('<html>oops</html>', { status: 502 }));
    await expect(service.post('/x')).rejects.toMatchObject({ status: 502, code: 'internal' });
  });

  it('get sends GET with the bearer token and no body or content type', async () => {
    const { service, fetchMock } = setup({ access: 'tok' }, jsonRes(200, { a: 1 }));
    expect(await service.get('/me/reports')).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${location.origin}/api/me/reports`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('patch sends PATCH with a JSON body', async () => {
    const { service, fetchMock } = setup({ access: 'tok' }, jsonRes(200, { ok: true }));
    expect(await service.patch('/me', { display_name: 'x' })).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${location.origin}/api/me`);
    expect(init.method).toBe('PATCH');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"display_name":"x"}');
  });

  it('upload posts the FormData as is and sets no Content-Type', async () => {
    const { service, fetchMock } = setup({ access: 'tok' }, jsonRes(201, { photo_id: 'p' }));
    const form = new FormData();
    form.set('file', new Blob(['x']), 'a.webp');
    expect(await service.upload('/photos', form)).toEqual({ photo_id: 'p' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${location.origin}/api/photos`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(Object.keys(init.headers).map((k) => k.toLowerCase())).not.toContain('content-type');
  });

  it.each([
    ['get', (s: ApiService) => s.get('/x')],
    ['patch', (s: ApiService) => s.patch('/x', {})],
    ['upload', (s: ApiService) => s.upload('/x', new FormData())],
  ])('%s refreshes once on 401 and retries once', async (_name, call) => {
    const body = { error: { code: 'unauthorized', message_th: 'x', message_en: 'x' } };
    const { service, fetchMock, refresh } = setup(
      { access: 'old', refreshed: 'new' },
      jsonRes(401, body),
      jsonRes(401, body),
    );
    await expect(call(service)).rejects.toMatchObject({ status: 401 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new');
  });

  it('get rejects with 401 and no fetch when there is no token', async () => {
    const { service, fetchMock } = setup({ access: null });
    await expect(service.get('/x')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a bare non-JSON 413 (body size limit) to photo_too_large', async () => {
    const { service } = setup({ access: 't' }, new Response('Request Entity Too Large', { status: 413 }));
    const err = await service.upload('/photos', new FormData()).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 413, code: 'photo_too_large', messageTh: 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)' });
  });

  it("words its own internal error exactly like the API's internal message", async () => {
    const { service } = setup({ access: 't' }, new Response('<html>oops</html>', { status: 502 }));
    await expect(service.post('/x')).rejects.toMatchObject({ messageTh: 'ระบบขัดข้อง ลองใหม่อีกครั้งนะ' });
  });
});
