import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { PHOTO_PIPELINE } from '../report-new/photo-tools';
import { ReportDetailService } from './report-detail.service';

const ID = '7b0c5a3e-1f7d-4c49-9a52-2b8f3d0c6e11';

// A chainable stand-in for supabase-js' query builder that resolves to `result`.
function query(result: { data: unknown; error: unknown }) {
  const calls: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit']) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return q;
    };
  }
  q['maybeSingle'] = async () => result;
  q['then'] = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
  return { q, calls };
}

function setup(result: { data: unknown; error: unknown } = { data: null, error: null }, userId: string | null = null) {
  const { q, calls } = query(result);
  const from = vi.fn(() => q);
  const client = vi.fn(async () => ({ from }));
  const post = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: { client } },
      { provide: ApiService, useValue: { post } },
      {
        provide: AuthService,
        useValue: { signedIn: signal(userId !== null), session: signal(userId ? { user: { id: userId } } : null) },
      },
    ],
  });
  return { service: TestBed.inject(ReportDetailService), client, from, calls, post };
}

describe('ReportDetailService', () => {
  it('returns null for an id that is not a uuid without asking the database', async () => {
    const { service, client, from } = setup();
    expect(await service.get('not-a-uuid')).toBeNull();
    expect(await service.get("x' or 1=1")).toBeNull();
    expect(client).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('reads one public report by id', async () => {
    const row = { id: ID, title: 'หลุม', photos: [], tags: [] };
    const { service, from, calls } = setup({ data: row, error: null });
    expect(await service.get(ID)).toEqual(row);
    expect(from).toHaveBeenCalledWith('public_reports');
    expect(calls).toContainEqual(['eq', ['id', ID]]);
  });

  it('returns null when the report is not public', async () => {
    const { service } = setup({ data: null, error: null });
    expect(await service.get(ID)).toBeNull();
  });

  it('rejects when the read fails', async () => {
    const { service } = setup({ data: null, error: { message: 'offline' } });
    await expect(service.get(ID)).rejects.toThrow('offline');
  });

  it('lists comments oldest first, at most 200', async () => {
    const { service, from, calls } = setup({ data: [{ id: 'c1' }], error: null });
    expect(await service.comments(ID)).toEqual([{ id: 'c1' }]);
    expect(from).toHaveBeenCalledWith('public_comments');
    expect(calls).toContainEqual(['eq', ['report_id', ID]]);
    expect(calls).toContainEqual(['order', ['created_at', { ascending: true }]]);
    expect(calls).toContainEqual(['limit', [200]]);
  });

  it('asks for the photo path of each comment', async () => {
    const { service, calls } = setup({ data: [], error: null });
    await service.comments(ID);
    const select = calls.find(([m]) => m === 'select');
    expect(String(select?.[1][0])).toContain('photo_path');
  });

  it('says not confirmed when signed out, without a request', async () => {
    const { service, client } = setup();
    expect(await service.myConfirmation(ID)).toBe(false);
    expect(client).not.toHaveBeenCalled();
  });

  it('finds the signed-in user’s own confirmation', async () => {
    const { service, from, calls } = setup({ data: { report_id: ID }, error: null }, 'u1');
    expect(await service.myConfirmation(ID)).toBe(true);
    expect(from).toHaveBeenCalledWith('confirmations');
    expect(calls).toContainEqual(['eq', ['user_id', 'u1']]);
  });

  it('posts me-too and comments to the API', async () => {
    const { service, post } = setup();
    post.mockResolvedValue({ ok: 1 });
    await service.toggleConfirm(ID);
    await service.addComment(ID, 'สวัสดี');
    expect(post).toHaveBeenCalledWith(`/reports/${ID}/confirm`);
    expect(post).toHaveBeenCalledWith(`/reports/${ID}/comments`, { body: 'สวัสดี' });
  });
});

describe('ReportDetailService (plan 5)', () => {
  function writeSetup() {
    const post = vi.fn().mockResolvedValue({ ok: true });
    const upload = vi.fn().mockResolvedValue({ photo_id: 'p1', width: 10, height: 10 });
    const compress = vi.fn().mockResolvedValue({ blob: new Blob(['x'], { type: 'image/webp' }), width: 10, height: 10, type: 'image/webp' });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: vi.fn() } },
        { provide: ApiService, useValue: { post, upload } },
        { provide: AuthService, useValue: { signedIn: signal(true), session: signal(null) } },
        { provide: PHOTO_PIPELINE, useValue: { compress, readGps: vi.fn() } },
      ],
    });
    return { service: TestBed.inject(ReportDetailService), post, upload, compress };
  }

  it('claims a fix and reports content through the API', async () => {
    const { service, post } = writeSetup();
    await service.claimFix(ID, { note: 'ซ่อมแล้ว' });
    expect(post).toHaveBeenCalledWith(`/reports/${ID}/fix-claims`, { note: 'ซ่อมแล้ว' });
    await service.flag({ target_type: 'comment', target_id: 'c1', reason: 'spam' });
    expect(post).toHaveBeenCalledWith('/flags', { target_type: 'comment', target_id: 'c1', reason: 'spam' });
  });

  it('compresses, then uploads one photo and returns its id', async () => {
    const { service, upload, compress } = writeSetup();
    const file = new File(['raw'], 'a.jpg', { type: 'image/jpeg' });
    expect(await service.uploadPhoto(file)).toBe('p1');
    expect(compress).toHaveBeenCalledWith(file);
    expect(upload).toHaveBeenCalledWith('/photos', expect.any(FormData));
  });
});