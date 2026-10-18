import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shares one /api/config fetch between config() and client(), and retries after a failure', async () => {
    const ok = () =>
      new Response(JSON.stringify({ supabaseAnonKey: 'anon', quickLogin: [{ who: 'admin', label_th: 'แอดมิน' }] }), {
        status: 200,
      });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockImplementation(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(SupabaseService);

    await expect(service.config()).rejects.toThrow('config 503');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [cfg, client] = await Promise.all([service.config(), service.client()]);
    await service.config();
    expect(fetchMock).toHaveBeenCalledTimes(2); // one retry fetch shared by config() and client()
    expect(cfg.quickLogin).toHaveLength(1);
    expect(client).toBeTruthy();
    expect(await service.client()).toBe(client);
  });
});
