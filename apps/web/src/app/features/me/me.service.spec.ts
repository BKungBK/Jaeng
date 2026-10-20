import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../core/api.service';
import { MeService } from './me.service';

function setup() {
  const api = { get: vi.fn(), patch: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  return { api, svc: TestBed.inject(MeService) };
}

describe('MeService', () => {
  it('reads the own reports from GET /me/reports', async () => {
    const { api, svc } = setup();
    api.get.mockResolvedValue({ reports: [{ id: 'a' }, { id: 'b' }] });
    expect(await svc.reports()).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(api.get).toHaveBeenCalledWith('/me/reports');
  });

  it('renames through PATCH /me and returns the stored name', async () => {
    const { api, svc } = setup();
    api.patch.mockResolvedValue({ display_name: 'พี่ปลา' });
    expect(await svc.rename('พี่ปลา')).toBe('พี่ปลา');
    expect(api.patch).toHaveBeenCalledWith('/me', { display_name: 'พี่ปลา' });
  });

  it('stores the language through PATCH /me', async () => {
    const { api, svc } = setup();
    api.patch.mockResolvedValue({ display_name: 'x', locale: 'en' });
    await svc.setLocale('en');
    expect(api.patch).toHaveBeenCalledWith('/me', { locale: 'en' });
  });

  it('lets an API error through for the page to show', async () => {
    const { api, svc } = setup();
    api.patch.mockRejectedValue(new Error('422'));
    await expect(svc.rename('x')).rejects.toThrow('422');
  });
});
