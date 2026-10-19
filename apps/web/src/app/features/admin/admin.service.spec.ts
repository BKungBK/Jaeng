import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../core/api.service';
import { AdminService } from './admin.service';

function setup() {
  const api = {
    get: vi.fn().mockResolvedValue({ items: [], users: [], entries: [], reports: 1, claims: 2, flags: 3 }),
    post: vi.fn().mockResolvedValue({ ok: true }),
  };
  TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  return { api, svc: TestBed.inject(AdminService) };
}

describe('AdminService', () => {
  it('reads counts and each queue', async () => {
    const { api, svc } = setup();
    expect(await svc.counts()).toEqual(expect.objectContaining({ reports: 1, claims: 2, flags: 3 }));
    expect(api.get).toHaveBeenCalledWith('/admin/counts');
    for (const type of ['reports', 'claims', 'flags', 'hidden'] as const) {
      expect(await svc.queue(type as 'reports')).toEqual([]);
      expect(api.get).toHaveBeenCalledWith(`/admin/queue?type=${type}`);
    }
  });

  it('posts each action to its path', async () => {
    const { api, svc } = setup();
    await svc.approve('r1', { location: 'keep' });
    expect(api.post).toHaveBeenCalledWith('/admin/reports/r1/approve', { location: 'keep' });
    await svc.reject('r1', { reason: 'other', note: 'x' });
    expect(api.post).toHaveBeenCalledWith('/admin/reports/r1/reject', { reason: 'other', note: 'x' });
    await svc.reviewClaim('c1', true);
    expect(api.post).toHaveBeenCalledWith('/admin/fix-claims/c1/approve', {});
    await svc.reviewClaim('c1', false);
    expect(api.post).toHaveBeenCalledWith('/admin/fix-claims/c1/reject', {});
    await svc.resolveFlags('f1', 'ban');
    expect(api.post).toHaveBeenCalledWith('/admin/flags/f1/resolve', { action: 'ban' });
    await svc.hide('comment', 'm1');
    expect(api.post).toHaveBeenCalledWith('/admin/hide', { target_type: 'comment', target_id: 'm1' });
    await svc.restore('report', 'r1');
    expect(api.post).toHaveBeenCalledWith('/admin/restore', { target_type: 'report', target_id: 'r1' });
    await svc.setBan('u1', true);
    expect(api.post).toHaveBeenCalledWith('/admin/users/u1/ban', {});
    await svc.setBan('u1', false);
    expect(api.post).toHaveBeenCalledWith('/admin/users/u1/unban', {});
  });

  it('encodes the user search and pages the log', async () => {
    const { api, svc } = setup();
    await svc.users('ก ข');
    expect(api.get).toHaveBeenCalledWith('/admin/users?q=%E0%B8%81%20%E0%B8%82');
    await svc.log(null);
    expect(api.get).toHaveBeenCalledWith('/admin/log');
    await svc.log(20);
    expect(api.get).toHaveBeenCalledWith('/admin/log?before=20');
  });

  it('encodes ids in paths', async () => {
    const { api, svc } = setup();
    await svc.approve('a/b', { location: 'keep' });
    expect(api.post).toHaveBeenCalledWith('/admin/reports/a%2Fb/approve', { location: 'keep' });
  });
});
