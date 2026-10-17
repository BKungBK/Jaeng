import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
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
