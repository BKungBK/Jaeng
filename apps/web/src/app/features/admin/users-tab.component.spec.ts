import { TestBed } from '@angular/core/testing';
import type { AdminUser } from '@jaeng/shared/admin';
import { ApiError } from '../../core/api.service';
import { AdminService } from './admin.service';
import { UsersTabComponent } from './users-tab.component';

function user(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u1',
    display_name: 'สมชาย',
    email: 'som@x.test',
    role: 'user',
    banned_at: null,
    created_at: '2026-10-01T00:00:00Z',
    report_count: 2,
    comment_count: 5,
    ...over,
  };
}

async function setup(list: AdminUser[] = [user(), user({ id: 'a1', display_name: 'แอดมิน', role: 'admin' })], over: Record<string, unknown> = {}) {
  const admin = { users: vi.fn().mockResolvedValue(list), setBan: vi.fn().mockResolvedValue(undefined), ...over };
  TestBed.configureTestingModule({ providers: [{ provide: AdminService, useValue: admin }] });
  const fixture = TestBed.createComponent(UsersTabComponent);
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const rows = () => [...root.querySelectorAll<HTMLElement>('.user')];
  const btn = (scope: ParentNode, text: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(text));
  return { root, admin, settle, rows, btn };
}

describe('UsersTabComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('lists everyone at first and searches 300 ms after typing, once', async () => {
    const { root, admin, settle } = await setup();
    expect(admin.users).toHaveBeenCalledWith('');
    vi.useFakeTimers();
    const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'ส';
    input.dispatchEvent(new Event('input'));
    input.value = 'สม';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(299);
    expect(admin.users).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
    await settle();
    expect(admin.users).toHaveBeenCalledTimes(2);
    expect(admin.users).toHaveBeenLastCalledWith('สม');
  });

  it('shows status in words, the admin tag, and no ban button for admins', async () => {
    const { rows, btn } = await setup();
    expect(rows()[0].textContent).toContain('ใช้งานได้');
    expect(rows()[0].textContent).toContain('som@x.test');
    expect(rows()[1].textContent).toContain('ผู้ดูแล');
    expect(btn(rows()[1], 'แบน')).toBeUndefined();
  });

  it('ban needs a second press, then the row says banned', async () => {
    const { rows, btn, admin, settle } = await setup();
    btn(rows()[0], 'แบน')!.click();
    await settle();
    expect(admin.setBan).not.toHaveBeenCalled();
    btn(rows()[0], 'แน่ใจ แบนเลย')!.click();
    await settle();
    expect(admin.setBan).toHaveBeenCalledWith('u1', true);
    expect(rows()[0].textContent).toContain('ถูกแบน');
    btn(rows()[0], 'ยกเลิกแบน')!.click();
    await settle();
    expect(admin.setBan).toHaveBeenLastCalledWith('u1', false);
    expect(rows()[0].textContent).toContain('ใช้งานได้');
  });

  it('shows the API words for cannot_ban_admin', async () => {
    const err = new ApiError(409, 'cannot_ban_admin', 'แบนบัญชีผู้ดูแลไม่ได้');
    const { rows, btn, settle, root } = await setup(undefined, { setBan: vi.fn().mockRejectedValue(err) });
    btn(rows()[0], 'แบน')!.click();
    await settle();
    btn(rows()[0], 'แน่ใจ แบนเลย')!.click();
    await settle();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('แบนบัญชีผู้ดูแลไม่ได้');
  });

  it('says when nothing matched', async () => {
    const { root } = await setup([]);
    expect(root.textContent).toContain('ไม่เจอผู้ใช้ที่ตรงกับคำค้น');
  });
});
