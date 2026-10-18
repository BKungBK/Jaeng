import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DuplicateCandidate } from '@jaeng/shared/report';
import { ApiError, ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DeviceService } from '../../core/device.service';
import { photoFile } from './gps-jpeg.testing';
import { PHOTO_PIPELINE, readGps, type CompressedPhoto } from './photo-tools';
import { ReportDraftService } from './report-draft.service';

const BANGKOK = { lat: 13.75, latRef: 'N', lng: 100.5, lngRef: 'E' } as const;
const SYDNEY = { lat: 33.8, latRef: 'S', lng: 151.2, lngRef: 'E' } as const;

const CANDIDATE: DuplicateCandidate = {
  id: 'd1',
  title: 'หลุมลึกหน้าตลาด',
  category: 'road',
  status: 'open',
  danger_level: 2,
  confirm_count: 3,
  cover_photo_path: null,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

type Opts = {
  failUpload?: (n: number) => boolean;
  position?: { lng: number; lat: number } | null;
  readGps?: (file: Blob) => Promise<{ lng: number; lat: number } | null>;
};

function setup(opts: Opts = {}) {
  let uploads = 0;
  // the signed-in user, as AuthService exposes it
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-a' } });
  const api = {
    upload: vi.fn(async () => {
      const n = ++uploads;
      if (opts.failUpload?.(n)) throw new ApiError(500, 'internal', 'ระบบขัดข้อง ลองใหม่อีกครั้งนะ');
      return { photo_id: `p${n}`, width: 1600, height: 1200 };
    }),
    post: vi.fn(async (path: string, _body?: unknown): Promise<unknown> => {
      if (path === '/reports/check-duplicate') return { duplicates: [] };
      if (path === '/reports') return { report: { id: 'new1', status: 'pending_review' } };
      return { confirmed: true };
    }),
  };
  const device = { currentPosition: vi.fn().mockResolvedValue(opts.position === undefined ? { lng: 100.6, lat: 13.8 } : opts.position) };
  const compress = vi.fn(
    async (f: File): Promise<CompressedPhoto> => ({ blob: new Blob([f.name], { type: 'image/webp' }), width: 1600, height: 1200, type: 'image/webp' }),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiService, useValue: api },
      { provide: DeviceService, useValue: device },
      { provide: PHOTO_PIPELINE, useValue: { readGps: opts.readGps ?? readGps, compress } },
      { provide: AuthService, useValue: { session } },
    ],
  });
  const draft = TestBed.inject(ReportDraftService);
  TestBed.tick(); // the draft notes who is signed in
  return { draft, api, device, compress, session };
}

/** A draft with ready photos, a category and a pin: ready to send. */
async function ready(s: ReturnType<typeof setup>, files = [photoFile('a.jpg')]) {
  await s.draft.addFiles(files);
  s.draft.setCategory('road');
  s.draft.setLocation({ lng: 100.5, lat: 13.75 }, 'exif');
}

describe('ReportDraftService', () => {
  let urls: number;
  beforeEach(() => {
    urls = 0;
    URL.createObjectURL = vi.fn(() => `blob:preview-${++urls}`);
    URL.revokeObjectURL = vi.fn();
  });

  it('takes at most 4 photos', async () => {
    const s = setup();
    await s.draft.addFiles([1, 2, 3, 4, 5].map((n) => photoFile(`${n}.jpg`)));
    expect(s.draft.photos()).toHaveLength(4);
    expect(s.api.upload).toHaveBeenCalledTimes(4);
    await s.draft.addFiles([photoFile('6.jpg')]);
    expect(s.draft.photos()).toHaveLength(4);
  });

  it('compresses each photo, uploads it as the multipart `file` and keeps its id', async () => {
    const s = setup();
    await s.draft.addFiles([photoFile('a.jpg')]);
    const form = s.api.upload.mock.calls[0] as unknown as [string, FormData];
    expect(form[0]).toBe('/photos');
    expect(form[1].get('file')).toBeInstanceOf(Blob);
    expect(s.draft.photos()[0]).toMatchObject({ state: 'ready', photoId: 'p1', width: 1600, height: 1200, errorTh: null });
    expect(s.draft.canContinueFromPhotos()).toBe(true);
  });

  it('marks only the failed photo as an error, and blocks going on until it is retried or removed', async () => {
    const s = setup({ failUpload: (n) => n === 2 });
    await s.draft.addFiles(['a', 'b', 'c', 'd'].map((n) => photoFile(`${n}.jpg`)));
    const states = s.draft.photos().map((p) => p.state);
    expect(states.filter((st) => st === 'error')).toHaveLength(1);
    expect(states.filter((st) => st === 'ready')).toHaveLength(3);
    const failed = s.draft.photos().find((p) => p.state === 'error')!;
    expect(failed.errorTh).toBe('ระบบขัดข้อง ลองใหม่อีกครั้งนะ');
    expect(s.draft.canContinueFromPhotos()).toBe(false);
    await s.draft.retry(failed.localId);
    expect(s.draft.photos().every((p) => p.state === 'ready')).toBe(true);
    expect(s.draft.canContinueFromPhotos()).toBe(true);
  });

  it('can go on after removing the failed photo when the rest are ready', async () => {
    const s = setup({ failUpload: (n) => n === 1 });
    await s.draft.addFiles([photoFile('a.jpg'), photoFile('b.jpg')]);
    expect(s.draft.canContinueFromPhotos()).toBe(false);
    const failed = s.draft.photos().find((p) => p.state === 'error')!;
    s.draft.remove(failed.localId);
    expect(s.draft.photos()).toHaveLength(1);
    expect(s.draft.canContinueFromPhotos()).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(failed.previewUrl);
  });

  it('cannot go on without a photo', () => {
    const s = setup();
    expect(s.draft.canContinueFromPhotos()).toBe(false);
  });

  it('shows the 413 message on the photo that was too large', async () => {
    const s = setup();
    s.api.upload.mockRejectedValueOnce(new ApiError(413, 'photo_too_large', 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)'));
    await s.draft.addFiles([photoFile('a.jpg')]);
    expect(s.draft.photos()[0]).toMatchObject({ state: 'error', errorTh: 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)' });
  });

  it('suggests the first photo with GPS without asking the device', async () => {
    const s = setup();
    await s.draft.addFiles([photoFile('plain.jpg'), photoFile('gps.jpg', BANGKOK)]);
    await s.draft.suggestLocation();
    const loc = s.draft.location()!;
    expect(loc.source).toBe('exif');
    expect(loc.lng).toBeCloseTo(100.5, 3);
    expect(loc.lat).toBeCloseTo(13.75, 3);
    expect(s.device.currentPosition).not.toHaveBeenCalled();
  });

  it('falls back to the device position when no photo has GPS', async () => {
    const s = setup();
    await s.draft.addFiles([photoFile('plain.jpg')]);
    await s.draft.suggestLocation();
    expect(s.draft.location()).toEqual({ lng: 100.6, lat: 13.8, source: 'device' });
  });

  it('drops EXIF outside Thailand and asks the device instead', async () => {
    const s = setup();
    await s.draft.addFiles([photoFile('sydney.jpg', SYDNEY)]);
    expect(s.draft.photos()[0].gps).toBeNull();
    await s.draft.suggestLocation();
    expect(s.device.currentPosition).toHaveBeenCalled();
    expect(s.draft.location()?.source).toBe('device');
  });

  it('has no location when neither the photos nor the device know one', async () => {
    const s = setup({ position: null });
    await s.draft.addFiles([photoFile('plain.jpg')]);
    await s.draft.suggestLocation();
    expect(s.draft.location()).toBeNull();
  });

  it('sends one report however often submit is pressed while it runs', async () => {
    const s = setup();
    await ready(s);
    const a = s.draft.submit();
    const b = s.draft.submit();
    expect(b).toBe(a);
    expect(await a).toEqual({ kind: 'created', id: 'new1' });
    expect(s.api.post.mock.calls.filter(([p]) => p === '/reports')).toHaveLength(1);
    // pressed again after it went through: still the same report, no second request
    expect(await s.draft.submit()).toEqual({ kind: 'created', id: 'new1' });
    expect(s.api.post.mock.calls.filter(([p]) => p === '/reports')).toHaveLength(1);
  });

  it('checks for duplicates first and does not create when some are found', async () => {
    const s = setup();
    await ready(s);
    s.api.post.mockImplementation(async (path: string) =>
      path === '/reports/check-duplicate' ? { duplicates: [CANDIDATE] } : { report: { id: 'x' } },
    );
    expect(await s.draft.submit()).toEqual({ kind: 'duplicates', candidates: [CANDIDATE] });
    expect(s.api.post).toHaveBeenCalledWith('/reports/check-duplicate', { lng: 100.5, lat: 13.75, category: 'road' });
    expect(s.api.post.mock.calls.some(([p]) => p === '/reports')).toBe(false);
  });

  it('creates with the right body: no empty title, tags as typed, ready photo ids', async () => {
    const s = setup();
    await ready(s, [photoFile('a.jpg'), photoFile('b.jpg')]);
    s.draft.details.set({ title: '   ', description: ' น้ำขัง ', danger: 1, tags: ['#a', 'หน้าโรงเรียน'], hideAuthor: true });
    await s.draft.submit();
    expect(s.api.post).toHaveBeenLastCalledWith('/reports', {
      category: 'road',
      lng: 100.5,
      lat: 13.75,
      photo_ids: ['p1', 'p2'],
      description: 'น้ำขัง',
      danger_level: 1,
      tags: ['#a', 'หน้าโรงเรียน'],
      hide_author: true,
    });
  });

  it('leaves out every optional field the reporter did not fill', async () => {
    const s = setup();
    await ready(s);
    await s.draft.submit();
    expect(s.api.post).toHaveBeenLastCalledWith('/reports', {
      category: 'road',
      lng: 100.5,
      lat: 13.75,
      photo_ids: ['p1'],
      hide_author: false,
    });
  });

  it('creates without the duplicate check when asked to', async () => {
    const s = setup();
    await ready(s);
    expect(await s.draft.createAnyway()).toEqual({ id: 'new1' });
    expect(s.api.post.mock.calls.map(([p]) => p)).toEqual(['/reports']);
  });

  it('merges with the ready photo ids only', async () => {
    const s = setup({ failUpload: (n) => n === 2 });
    await ready(s, [photoFile('a.jpg'), photoFile('b.jpg'), photoFile('c.jpg')]);
    expect(await s.draft.merge('d1')).toEqual({ id: 'd1' });
    expect(s.api.post).toHaveBeenLastCalledWith('/reports/d1/merge', { photo_ids: ['p1', 'p3'] });
  });

  it('passes the API message on when the photos were already used, and creates nothing more', async () => {
    const s = setup();
    await ready(s);
    s.api.post.mockImplementation(async (path: string) => {
      if (path === '/reports/check-duplicate') return { duplicates: [] };
      throw new ApiError(400, 'invalid_photos', 'รูปนี้ใช้ไม่ได้แล้ว ลองเลือกรูปใหม่นะ');
    });
    const err = await s.draft.submit().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.messageTh).toBe('รูปนี้ใช้ไม่ได้แล้ว ลองเลือกรูปใหม่นะ');
    expect(s.api.post.mock.calls.filter(([p]) => p === '/reports')).toHaveLength(1);
    // the failed send is over: a later press tries again instead of hanging on the old promise
    await s.draft.submit().catch(() => undefined);
    expect(s.api.post.mock.calls.filter(([p]) => p === '/reports')).toHaveLength(2);
  });

  it('revokes every preview URL on reset and starts empty', async () => {
    const s = setup();
    await s.draft.addFiles([photoFile('a.jpg'), photoFile('b.jpg')]);
    const previews = s.draft.photos().map((p) => p.previewUrl);
    s.draft.setCategory('road');
    s.draft.reset();
    for (const url of previews) expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(s.draft.photos()).toEqual([]);
    expect(s.draft.category()).toBeNull();
    expect(s.draft.location()).toBeNull();
    expect(s.draft.details()).toEqual({ title: '', description: '', danger: null, tags: [], hideAuthor: false });
  });

  it('drops the draft when another user signs in, so B never sees or sends A’s photos', async () => {
    const s = setup();
    await ready(s, [photoFile('a.jpg'), photoFile('b.jpg')]);
    const previews = s.draft.photos().map((p) => p.previewUrl);
    s.session.set({ user: { id: 'user-b' } });
    TestBed.tick();
    expect(s.draft.photos()).toEqual([]);
    expect(s.draft.category()).toBeNull();
    expect(s.draft.location()).toBeNull();
    for (const url of previews) expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it('drops the draft on sign-out', async () => {
    const s = setup();
    await ready(s);
    s.session.set(null);
    TestBed.tick();
    expect(s.draft.photos()).toEqual([]);
  });

  it('keeps the draft when the same user’s session is refreshed', async () => {
    const s = setup();
    await ready(s);
    s.session.set({ user: { id: 'user-a' } }); // a new session object: TOKEN_REFRESHED
    TestBed.tick();
    expect(s.draft.photos()).toHaveLength(1);
  });

  it('reads the GPS again on retry when the first read gave nothing', async () => {
    const readGpsOnce = vi
      .fn<(file: Blob) => Promise<{ lng: number; lat: number } | null>>()
      .mockRejectedValueOnce(new Error('exif broke'))
      .mockResolvedValue({ lng: 100.5, lat: 13.75 });
    const s = setup({ readGps: readGpsOnce });
    await s.draft.addFiles([photoFile('a.jpg')]);
    const [p] = s.draft.photos();
    expect(p.state).toBe('error');
    await s.draft.retry(p.localId);
    expect(s.draft.photos()[0]).toMatchObject({ state: 'ready', gps: { lng: 100.5, lat: 13.75 } });
    expect(readGpsOnce).toHaveBeenCalledTimes(2);
  });

  it('forgets the sent report on reset, so the next draft is sent again', async () => {
    const s = setup();
    await ready(s);
    await s.draft.submit();
    s.draft.reset();
    await ready(s);
    await s.draft.submit();
    expect(s.api.post.mock.calls.filter(([p]) => p === '/reports')).toHaveLength(2);
  });
});
