import { TestBed } from '@angular/core/testing';
import type { Person, QueueReport } from '@jaeng/shared/admin';
import { ApiError } from '../../core/api.service';
import { CategoriesService } from '../../core/categories.service';
import { MAP_FACTORY } from '../map/map-factory';
import { CATEGORIES } from '../report-new/categories.testing';
import { fakeMap } from '../report-new/fake-map.testing';
import { AdminService } from './admin.service';
import { ReviewQueueComponent } from './review-queue.component';

const author: Person = { id: 'u1', display_name: 'สมหญิง', email: 'som@x.test', role: 'user', banned: false };

function item(over: Partial<QueueReport> = {}): QueueReport {
  return {
    id: 'r1',
    title: 'หลุมลึกหน้าตลาด',
    description: 'ลึกมาก',
    category: 'road',
    danger_level: 1,
    created_at: '2026-10-18T08:00:00Z',
    place_name: 'ลาดพร้าว',
    hide_author: false,
    profanity_flag: false,
    tags: ['กลางคืน'],
    lng: 100.5,
    lat: 13.7,
    public_lng: 100.5,
    public_lat: 13.7,
    author,
    photos: [{ path: 'u1/p.webp', width: 800, height: 600, url: '/sb/sign/u1/p.webp', thumb_url: '/sb/sign/u1/p_thumb.webp' }],
    ...over,
  };
}

async function setup(items: QueueReport[] = [item(), item({ id: 'r2', title: 'ไฟดับ' })], over: Record<string, unknown> = {}) {
  const admin = {
    queue: vi.fn().mockResolvedValue(items),
    approve: vi.fn().mockResolvedValue(undefined),
    reject: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const map = { ...fakeMap(16), project: (ll: [number, number]) => ({ x: ll[0], y: ll[1] }) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminService, useValue: admin },
      { provide: CategoriesService, useValue: { list: async () => CATEGORIES } },
      { provide: MAP_FACTORY, useValue: async () => map },
    ],
  });
  const fixture = TestBed.createComponent(ReviewQueueComponent);
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
  const btn = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));
  const click = async (text: string) => {
    btn(text)!.click();
    await settle();
  };
  return { fixture, root, admin, map, changed, settle, btn, click };
}

describe('ReviewQueueComponent', () => {
  it('shows the oldest report first with its counter', async () => {
    const { root } = await setup();
    expect(root.querySelector('h2')?.textContent).toContain('หลุมลึกหน้าตลาด');
    expect(root.textContent).toContain('เรื่องที่ 1 จาก 2');
  });

  it('shows the real name and e-mail even when the name is hidden publicly, with a tag', async () => {
    const { root } = await setup([item({ hide_author: true })]);
    expect(root.textContent).toContain('สมหญิง');
    expect(root.textContent).toContain('som@x.test');
    expect(root.textContent).toContain('ขอปิดชื่อ');
  });

  it('tags possible profanity and a banned reporter in words', async () => {
    const { root } = await setup([item({ profanity_flag: true, author: { ...author, banned: true } })]);
    expect(root.textContent).toContain('มีคำที่อาจไม่เหมาะสม');
    expect(root.textContent).toContain('ถูกแบน');
  });

  it('approving without edits sends keep only', async () => {
    const { admin, click } = await setup();
    await click('อนุมัติ…');
    await click('อนุมัติ ขึ้นแผนที่');
    expect(admin.approve).toHaveBeenCalledWith('r1', { location: 'keep' });
  });

  it('sends only the fields that changed', async () => {
    const { admin, click, root, settle } = await setup();
    await click('อนุมัติ…');
    [...root.querySelectorAll<HTMLButtonElement>('.levels button')][3].click();
    const title = root.querySelector<HTMLInputElement>('input.title')!;
    title.value = 'หลุมใหญ่มาก';
    title.dispatchEvent(new Event('input'));
    await settle();
    await click('อนุมัติ ขึ้นแผนที่');
    expect(admin.approve).toHaveBeenCalledWith('r1', { location: 'keep', danger_level: 3, title: 'หลุมใหญ่มาก' });
  });

  it('a pinned point sends point with the picked coordinates', async () => {
    const { admin, click, root, settle, map } = await setup();
    await click('อนุมัติ…');
    root.querySelector<HTMLInputElement>('input[value="point"]')!.click();
    await settle();
    map.cam.center = { lng: 100.502, lat: 13.701 };
    map.fire('moveend');
    await settle();
    await click('อนุมัติ ขึ้นแผนที่');
    expect(admin.approve).toHaveBeenCalledWith('r1', { location: 'point', lng: 100.502, lat: 13.701 });
  });

  it('choosing point without moving sends the shown point, never the true one', async () => {
    const { admin, click, root, settle } = await setup([item({ category: 'hazard', public_lng: 100.501, public_lat: 13.701 })]);
    await click('อนุมัติ…');
    root.querySelector<HTMLInputElement>('input[value="point"]')!.click();
    await settle();
    await click('อนุมัติ ขึ้นแผนที่');
    expect(admin.approve).toHaveBeenCalledWith('r1', { location: 'point', lng: 100.501, lat: 13.701 });
  });

  it('a hazard says it will be moved unless exact is chosen', async () => {
    const { click, root } = await setup([item({ category: 'hazard' })]);
    await click('อนุมัติ…');
    expect(root.textContent).toContain('เรื่องจุดเสี่ยงจะถูกเลื่อนให้อัตโนมัติ เว้นแต่เลือกตำแหน่งจริง');
  });

  it('rejecting needs a reason; other sends its note', async () => {
    const { admin, click, root, settle, btn } = await setup();
    await click('ปฏิเสธ…');
    expect(btn('ยืนยันปฏิเสธ')!.disabled).toBe(true);
    [...root.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent?.includes('อื่นๆ'))!.click();
    await settle();
    const note = root.querySelector<HTMLTextAreaElement>('textarea')!;
    note.value = ' พิกัดไม่ชัด ';
    note.dispatchEvent(new Event('input'));
    await settle();
    await click('ยืนยันปฏิเสธ');
    expect(admin.reject).toHaveBeenCalledWith('r1', { reason: 'other', note: 'พิกัดไม่ชัด' });
  });

  it('after success the next report shows, the status says so, and changed fires', async () => {
    const { click, root, changed } = await setup();
    await click('อนุมัติ…');
    await click('อนุมัติ ขึ้นแผนที่');
    expect(root.querySelector('h2')?.textContent).toContain('ไฟดับ');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('อนุมัติแล้ว ลำแสงขึ้นแผนที่แล้ว');
    expect(changed).toHaveBeenCalled();
  });

  it('a 409 shows the API words and loads the queue again', async () => {
    const err = new ApiError(409, 'invalid_state', 'รายการนี้ถูกจัดการไปแล้ว ลองโหลดใหม่นะ', 'en');
    const { click, root, admin } = await setup(undefined, { approve: vi.fn().mockRejectedValue(err) });
    await click('อนุมัติ…');
    await click('อนุมัติ ขึ้นแผนที่');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('รายการนี้ถูกจัดการไปแล้ว');
    expect(admin.queue).toHaveBeenCalledTimes(2);
  });

  it('a double click approves once', async () => {
    let release!: () => void;
    const { click, btn, admin, settle } = await setup(undefined, {
      approve: vi.fn(() => new Promise<void>((r) => (release = r))),
    });
    await click('อนุมัติ…');
    btn('อนุมัติ ขึ้นแผนที่')!.click();
    btn('อนุมัติ ขึ้นแผนที่')!.click();
    release();
    await settle();
    expect(admin.approve).toHaveBeenCalledTimes(1);
  });

  it('an empty queue says so', async () => {
    const { root } = await setup([]);
    expect(root.textContent).toContain('ไม่มีเรื่องรอตรวจ เยี่ยมเลย');
  });
});
