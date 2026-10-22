import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../core/api.service';
import { PHOTO_PIPELINE } from '../report-new/photo-tools';
import { MeService } from './me.service';

function setup() {
  const api = { get: vi.fn(), patch: vi.fn(), putForm: vi.fn(), delete: vi.fn() };
  const pipeline = { readGps: vi.fn(), compress: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiService, useValue: api },
      { provide: PHOTO_PIPELINE, useValue: pipeline },
    ],
  });
  return { api, pipeline, svc: TestBed.inject(MeService) };
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

  it('finishes the sign-up profile with the nickname through PATCH /me', async () => {
    const { api, svc } = setup();
    const stored = { display_name: 'น้องเมย์', locale: 'th', avatar_path: null, onboarded: true };
    api.patch.mockResolvedValue(stored);
    expect(await svc.completeProfile('น้องเมย์')).toEqual(stored);
    expect(api.patch).toHaveBeenCalledWith('/me', { display_name: 'น้องเมย์', complete_profile: true });
  });

  it('shrinks a picture like a report photo, then sends it with PUT /me/avatar and answers its path', async () => {
    const { api, pipeline, svc } = setup();
    const file = new File(['big'], 'me.jpg', { type: 'image/jpeg' });
    pipeline.compress.mockResolvedValue({ blob: new Blob(['small'], { type: 'image/webp' }), width: 10, height: 10, type: 'image/webp' });
    api.putForm.mockResolvedValue({ avatar_path: 'u1/a.webp' });
    expect(await svc.uploadAvatar(file)).toBe('u1/a.webp');
    expect(pipeline.compress).toHaveBeenCalledWith(file);
    const [path, form] = api.putForm.mock.calls[0] as [string, FormData];
    expect(path).toBe('/me/avatar');
    expect((form.get('file') as File).name).toBe('avatar.webp');
    expect((form.get('file') as File).size).toBe(5);
  });

  it('a picture that is too large even after shrinking never reaches the API', async () => {
    const { api, pipeline, svc } = setup();
    pipeline.compress.mockRejectedValue(new Error('photo too large'));
    await expect(svc.uploadAvatar(new File(['x'], 'm.jpg'))).rejects.toThrow('photo too large');
    expect(api.putForm).not.toHaveBeenCalled();
  });

  it('takes the picture off with DELETE /me/avatar', async () => {
    const { api, svc } = setup();
    api.delete.mockResolvedValue({ avatar_path: null });
    await svc.removeAvatar();
    expect(api.delete).toHaveBeenCalledWith('/me/avatar');
  });
});
