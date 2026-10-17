import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const session = (token = 'at') => ({ access_token: token, refresh_token: 'rt', user: { id: 'u1' } });
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { session?: unknown; profile?: unknown } = {}) {
  let authCb: (event: string, s: unknown) => void = () => {};
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.profile ?? null, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: opts.session ?? null } }),
    onAuthStateChange: vi.fn((cb: typeof authCb) => {
      authCb = cb;
      return { data: { subscription: { unsubscribe() {} } } };
    }),
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: session('fresh') }, error: null }),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: { client: async () => ({ auth, from }) } }],
  });
  return { auth, from, eq, emit: (e: string, s: unknown) => authCb(e, s), service: TestBed.inject(AuthService) };
}

describe('AuthService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the own profile when a session appears and clears it on sign out', async () => {
    const profile = { id: 'u1', display_name: 'พี่ปลา', role: 'user' };
    const { service, emit, from, eq } = setup({ profile });
    await service.ready;
    expect(service.signedIn()).toBe(false);
    emit('SIGNED_IN', session());
    await flush();
    expect(service.signedIn()).toBe(true);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', 'u1');
    expect(service.profile()).toEqual(profile);
    emit('SIGNED_OUT', null);
    await flush();
    expect(service.profile()).toBeNull();
    expect(service.signedIn()).toBe(false);
  });

  it('picks up an existing session on start', async () => {
    const profile = { id: 'u1', display_name: 'a', role: 'admin' };
    const { service } = setup({ session: session(), profile });
    await service.ready;
    await flush();
    expect(service.session()?.access_token).toBe('at');
    expect(service.profile()).toEqual(profile);
  });

  it('quickLogin posts to the API and sets the session with the returned tokens', async () => {
    const { service, auth } = setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'A', refresh_token: 'R' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await service.quickLogin('admin');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dev/quick-login');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ who: 'admin' });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'A', refresh_token: 'R' });
  });

  it('quickLogin rejects when the API says no', async () => {
    const { service, auth } = setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    await expect(service.quickLogin('admin')).rejects.toThrow();
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('sendCode asks for an email OTP and may create the user', async () => {
    const { service, auth } = setup();
    await service.sendCode('a@b.co');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co', options: { shouldCreateUser: true } });
  });

  it('sendCode turns a 429 into Thai text', async () => {
    const { service, auth } = setup();
    auth.signInWithOtp.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'rate' } });
    await expect(service.sendCode('a@b.co')).rejects.toThrow('ขอรหัสถี่ไปหน่อย รอสักครู่แล้วลองใหม่นะ');
  });

  it('verifyCode verifies an email OTP', async () => {
    const { service, auth } = setup();
    await service.verifyCode('a@b.co', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' });
  });

  it('verifyCode turns otp_expired into Thai text', async () => {
    const { service, auth } = setup();
    auth.verifyOtp.mockResolvedValue({ error: { status: 403, code: 'otp_expired', message: 'expired' } });
    await expect(service.verifyCode('a@b.co', '1')).rejects.toThrow('รหัสไม่ถูก หรือหมดอายุแล้ว ลองขอรหัสใหม่นะ');
  });

  it('accessToken reads the latest session each time; refresh uses refreshSession', async () => {
    const { service, auth } = setup();
    await service.ready;
    auth.getSession.mockResolvedValueOnce({ data: { session: session('t1') } });
    expect(await service.accessToken()).toBe('t1');
    auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await service.accessToken()).toBeNull();
    expect(await service.refresh()).toBe('fresh');
    expect(auth.refreshSession).toHaveBeenCalled();
  });

  it('signOut calls the client', async () => {
    const { service, auth } = setup();
    await service.signOut();
    expect(auth.signOut).toHaveBeenCalled();
  });
});
