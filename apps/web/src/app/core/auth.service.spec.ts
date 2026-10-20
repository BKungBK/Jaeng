import { TestBed } from '@angular/core/testing';
import { AuthError, AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const session = (token = 'at') => ({ access_token: token, refresh_token: 'rt', user: { id: 'u1' } });
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { session?: unknown; profile?: unknown; failClientTimes?: number } = {}) {
  let failures = opts.failClientTimes ?? 0;
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
    providers: [
      {
        provide: SupabaseService,
        useValue: {
          client: async () => {
            if (failures-- > 0) throw new Error('config 503');
            return { auth, from };
          },
        },
      },
    ],
  });
  return { auth, from, select, eq, maybeSingle, emit: (e: string, s: unknown) => authCb(e, s), service: TestBed.inject(AuthService) };
}

describe('AuthService', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('loadedProfile', () => {
    it('waits for the profile that is still loading', async () => {
      const profile = { id: 'u1', display_name: 'แอดมิน', role: 'admin', locale: 'th' };
      const { service, maybeSingle } = setup({ session: session(), profile });
      let release!: (v: unknown) => void;
      maybeSingle.mockReturnValueOnce(new Promise((r) => (release = r)));
      const p = service.loadedProfile();
      await flush();
      await flush();
      expect(service.profile()).toBeNull(); // the read is still in flight
      release({ data: profile, error: null });
      expect(await p).toEqual(profile);
    });

    it('is null when signed out', async () => {
      const { service } = setup();
      expect(await service.loadedProfile()).toBeNull();
    });

    it('is null when the profile read fails', async () => {
      const { service, maybeSingle } = setup({ session: session() });
      maybeSingle.mockRejectedValueOnce(new Error('boom'));
      expect(await service.loadedProfile()).toBeNull();
    });
  });

  it('loads the own profile when a session appears and clears it on sign out', async () => {
    const profile = { id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th' };
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

  it('reads the profile language too', async () => {
    const profile = { id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'en' };
    const { service, select } = setup({ session: session(), profile });
    expect(await service.loadedProfile()).toEqual(profile);
    expect(select).toHaveBeenCalledWith('id, display_name, role, locale');
  });

  it('subscribes later when the API was down at start, so a login still updates the session', async () => {
    const { service, auth, emit } = setup({ failClientTimes: 1 });
    await service.ready; // first start failed
    expect(auth.onAuthStateChange).not.toHaveBeenCalled();
    await service.verifyCode('a@b.co', '123456'); // API is back: retries start
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    emit('SIGNED_IN', session('late'));
    expect(service.session()?.access_token).toBe('late');
    await service.accessToken();
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1); // subscribed once only
  });

  it('drops the previous profile when another user signs in, even if the new load fails', async () => {
    const a = { id: 'u1', display_name: 'A', role: 'admin', locale: 'th' };
    const { service, emit, maybeSingle } = setup({ profile: a });
    await service.ready;
    emit('SIGNED_IN', session());
    await flush();
    expect(service.profile()).toEqual(a);
    maybeSingle.mockRejectedValue(new Error('boom'));
    emit('SIGNED_IN', { access_token: 'b', refresh_token: 'r', user: { id: 'u2' } });
    expect(service.profile()).toBeNull(); // immediately, before B's row loads
    await flush();
    expect(service.profile()).toBeNull(); // and still null after the failed load
  });

  it('keeps the profile when a reload for the same user fails (token refresh)', async () => {
    const a = { id: 'u1', display_name: 'A', role: 'admin', locale: 'th' };
    const { service, emit, maybeSingle } = setup({ profile: a });
    await service.ready;
    emit('SIGNED_IN', session());
    await flush();
    expect(service.profile()).toEqual(a);
    maybeSingle.mockRejectedValueOnce(new Error('offline'));
    emit('TOKEN_REFRESHED', session('at2'));
    await flush();
    expect(service.profile()).toEqual(a);
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    emit('TOKEN_REFRESHED', session('at3'));
    await flush();
    expect(service.profile()).toEqual(a); // an error answer is a failure too, not "no profile"
  });

  it('picks up an existing session on start', async () => {
    const profile = { id: 'u1', display_name: 'a', role: 'admin', locale: 'th' };
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

  it('quickLogin rejects with the Thai message when the API says no', async () => {
    const { service, auth } = setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    const err = await service.quickLogin('admin').catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.message).toBe('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('quickLogin turns a network failure or a non-JSON answer into the Thai message', async () => {
    const { service, auth } = setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const offline = await service.quickLogin('admin').catch((e) => e);
    expect(offline).toBeInstanceOf(AuthError);
    expect(offline.message).toBe('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    const html = await service.quickLogin('admin').catch((e) => e);
    expect(html).toBeInstanceOf(AuthError);
    expect(html.message).toBe('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('quickLogin turns a setSession error into the Thai message', async () => {
    const { service, auth } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'A', refresh_token: 'R' }), { status: 200 })),
    );
    auth.setSession.mockResolvedValue({ error: { message: 'Invalid Refresh Token' } });
    const err = await service.quickLogin('admin').catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.message).toBe('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    expect(err.messageEn).toBe("Couldn't sign in. Please try again.");
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

  it('setDisplayName changes the name on the profile that is shown', async () => {
    const profile = { id: 'u1', display_name: 'พี่ปลา', role: 'user', locale: 'th' };
    const { service, emit } = setup({ profile });
    await service.ready;
    emit('SIGNED_IN', session());
    await flush();
    service.setDisplayName('น้องบี');
    expect(service.profile()).toEqual({ ...profile, display_name: 'น้องบี' });
  });

  it('setDisplayName does nothing while no profile is loaded', async () => {
    const { service } = setup();
    await service.ready;
    service.setDisplayName('น้องบี');
    expect(service.profile()).toBeNull();
  });
});
