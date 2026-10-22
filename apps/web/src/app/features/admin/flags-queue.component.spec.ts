import { TestBed } from '@angular/core/testing';
import type { HiddenItem, Person, QueueFlag } from '@jaeng/shared/admin';
import { AdminService } from './admin.service';
import { FlagsQueueComponent } from './flags-queue.component';

const owner: Person = { id: 'a', display_name: 'เจ้าของ', email: 'a@x.test', role: 'user', banned: false, avatar_path: null };
const f = (reason: QueueFlag['flags'][number]['reason'], name: string) => ({ reason, note: null, reporter_name: name, created_at: '2026-10-19T08:00:00Z' });

function target(over: Partial<QueueFlag> = {}): QueueFlag {
  return {
    flag_id: 'f1',
    target_type: 'report',
    target_id: 'r1',
    hidden: false,
    flags: [f('spam', 'บี'), f('false', 'ซี'), f('privacy', 'ดี')],
    report: { id: 'r1', title: 'ถนนพัง', status: 'open', category: 'road', danger_level: 1, photo: null },
    comment: null,
    author: owner,
    ...over,
  };
}

const hiddenItem: HiddenItem = { target_type: 'comment', target_id: 'c9', report: { id: 'r9', title: 'ไฟดับ', category: 'light', danger_level: 0, photo: null }, comment: { id: 'c9', body: 'ข้อความ' } };

async function setup(flags: QueueFlag[] = [target()], hidden: HiddenItem[] = [hiddenItem]) {
  const admin = {
    queue: vi.fn((type: string) => Promise.resolve(type === 'flags' ? flags : hidden)),
    resolveFlags: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({ providers: [{ provide: AdminService, useValue: admin }] });
  const fixture = TestBed.createComponent(FlagsQueueComponent);
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
  const btn = (text: string, scope: ParentNode = root) =>
    [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(text));
  return { root, admin, changed, settle, btn };
}

describe('FlagsQueueComponent', () => {
  it('lists the reasons in Thai with the reporters', async () => {
    const { root } = await setup();
    const rows = root.querySelectorAll('.reasons-list li');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('สแปมหรือโฆษณา');
    expect(rows[2].textContent).toContain('เปิดเผยข้อมูลส่วนตัว');
    expect(root.textContent).toContain('3 รายงาน');
  });

  it('a hidden target says so, has no hide button, and its dismiss also restores', async () => {
    const { root, btn } = await setup([target({ hidden: true })]);
    const card = root.querySelector('.item')!;
    expect(card.textContent).toContain('ซ่อนอยู่');
    expect(btn('ซ่อน', card)?.textContent?.trim().startsWith('ซ่อนและแบน')).toBe(true); // only the ban button starts with ซ่อน
    expect(btn('ยกเลิกรายงานและคืน', card)).toBeDefined();
  });

  it('hide sends hide', async () => {
    const { btn, admin, settle, changed, root } = await setup();
    btn('ซ่อน', root.querySelector('.item .actions')!)!.click();
    await settle();
    expect(admin.resolveFlags).toHaveBeenCalledWith('f1', 'hide');
    expect(changed).toHaveBeenCalled();
  });

  it('ban asks again before sending', async () => {
    const { btn, admin, settle } = await setup();
    btn('ซ่อนและแบนเจ้าของ')!.click();
    await settle();
    expect(admin.resolveFlags).not.toHaveBeenCalled();
    btn('แน่ใจ แบนเลย')!.click();
    await settle();
    expect(admin.resolveFlags).toHaveBeenCalledWith('f1', 'ban');
  });

  it('no ban button when the owner is an admin', async () => {
    const { btn } = await setup([target({ author: { ...owner, role: 'admin' } })]);
    expect(btn('ซ่อนและแบนเจ้าของ')).toBeUndefined();
  });

  it('restores a hidden item from the hidden list', async () => {
    const { root, admin, settle } = await setup([]);
    root.querySelector<HTMLButtonElement>('.hidden-list button')!.click();
    await settle();
    expect(admin.restore).toHaveBeenCalledWith('comment', 'c9');
  });

  it('shows a comment body as text, never as markup', async () => {
    const { root } = await setup([
      target({ target_type: 'comment', target_id: 'c1', comment: { id: 'c1', body: '<b>x</b>', photo: null } }),
    ]);
    expect(root.querySelector('.item b')).toBeNull();
    expect(root.querySelector('.item')?.textContent).toContain('<b>x</b>');
  });

  it('an empty queue says so', async () => {
    const { root } = await setup([], []);
    expect(root.textContent).toContain('ไม่มีรายงานค้าง');
  });
});
