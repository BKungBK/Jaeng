import { TestBed } from '@angular/core/testing';
import type { AdminPhoto, QueueClaim } from '@jaeng/shared/admin';
import { ApiError } from '../../core/api.service';
import { AdminService } from './admin.service';
import { ClaimsQueueComponent } from './claims-queue.component';

const photo = (path: string): AdminPhoto => ({ path, width: 10, height: 10, url: `/sb/${path}`, thumb_url: `/sb/t/${path}` });

function claim(over: Partial<QueueClaim> = {}): QueueClaim {
  return {
    id: 'c1',
    note: 'ซ่อมเสร็จแล้วนะ',
    created_at: '2026-10-19T08:00:00Z',
    claimant: { id: 'n1', display_name: 'เพื่อนบ้าน', email: 'n1@x.test', role: 'user', banned: false },
    photo: photo('n1/after.webp'),
    report: { id: 'r1', title: 'ท่อแตก', category: 'water', danger_level: 2, place_name: 'บางนา', days_open: 12, photos: [photo('r1/before.webp')] },
    ...over,
  };
}

async function setup(items: QueueClaim[] = [claim()], over: Record<string, unknown> = {}) {
  const admin = { queue: vi.fn().mockResolvedValue(items), reviewClaim: vi.fn().mockResolvedValue(undefined), ...over };
  TestBed.configureTestingModule({ providers: [{ provide: AdminService, useValue: admin }] });
  const fixture = TestBed.createComponent(ClaimsQueueComponent);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const btn = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))!;
  return { root, admin, changed, settle, btn };
}

describe('ClaimsQueueComponent', () => {
  it('shows before and after side by side with their words', async () => {
    const { root } = await setup();
    expect(root.querySelectorAll('.compare img').length).toBe(2);
    expect(root.querySelector('.compare')?.textContent).toContain('ก่อนแก้');
    expect(root.querySelector('.compare')?.textContent).toContain('หลังแก้');
    expect(root.textContent).toContain('ค้างมา 12 วัน');
    expect(root.textContent).toContain('n1@x.test');
    expect(root.textContent).toContain('ซ่อมเสร็จแล้วนะ');
  });

  it('says when no after photo was attached', async () => {
    const { root } = await setup([claim({ photo: null })]);
    expect(root.textContent).toContain('ไม่ได้แนบรูปหลังแก้');
  });

  it('confirms and denies', async () => {
    const { admin, btn, settle, changed, root } = await setup([claim(), claim({ id: 'c2' })]);
    btn('ยืนยันว่าแก้แล้ว').click();
    await settle();
    expect(admin.reviewClaim).toHaveBeenCalledWith('c1', true);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('ยืนยันแล้ว ลำแสงดับ เหลือเครื่องหมายถูก');
    btn('ยังไม่แก้').click();
    await settle();
    expect(admin.reviewClaim).toHaveBeenCalledWith('c2', false);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('ส่งกลับเป็นยังไม่แก้แล้ว');
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('a double click sends once', async () => {
    let release!: () => void;
    const { admin, btn, settle } = await setup(undefined, { reviewClaim: vi.fn(() => new Promise<void>((r) => (release = r))) });
    btn('ยืนยันว่าแก้แล้ว').click();
    btn('ยืนยันว่าแก้แล้ว').click();
    release();
    await settle();
    expect(admin.reviewClaim).toHaveBeenCalledTimes(1);
  });

  it('a 409 reloads the queue', async () => {
    const err = new ApiError(409, 'invalid_state', 'รายการนี้ถูกจัดการไปแล้ว ลองโหลดใหม่นะ');
    const { admin, btn, settle, root } = await setup(undefined, { reviewClaim: vi.fn().mockRejectedValue(err) });
    btn('ยืนยันว่าแก้แล้ว').click();
    await settle();
    expect(admin.queue).toHaveBeenCalledTimes(2);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('ถูกจัดการไปแล้ว');
  });

  it('an empty queue says so', async () => {
    const { root } = await setup([]);
    expect(root.textContent).toContain('ไม่มีคำขอรอตรวจ');
  });
});
