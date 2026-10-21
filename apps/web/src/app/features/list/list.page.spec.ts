import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ReportSignal } from '@jaeng/shared/api';
import { THAILAND_BBOX } from '@jaeng/shared/report';
import { DeviceService } from '../../core/device.service';
import { FilterState } from '../../core/filter-state.service';
import { I18nService } from '../../core/i18n.service';
import { MapViewService } from '../../core/map-view.service';
import { RealtimeService } from '../../core/realtime.service';
import { MapReturnService } from '../report-new/map-return.service';
import { formatDistance, type ListRow } from './list.service';
import { ListService } from './list.service';
import { ListPage } from './list.page';

const row = (id: string, over: Partial<ListRow> = {}): ListRow => ({
  id,
  title: `เรื่อง ${id}`,
  category: 'road',
  icon: 'construction',
  danger_level: 2,
  status: 'open',
  confirm_count: 3,
  comment_count: 0,
  days_open: 4,
  cover_photo_path: null,
  place_name: 'ลาดพร้าว',
  approved_at: '2026-10-16T00:00:00Z',
  resolved_at: null,
  distance_m: null,
  ...over,
});
const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => row(`r${from + i}`));

async function setup(opts: { bbox?: [number, number, number, number]; pages?: ListRow[][]; position?: { lng: number; lat: number } | null } = {}) {
  const page = vi.fn();
  for (const p of opts.pages ?? [rows(3)]) page.mockResolvedValueOnce(p);
  page.mockResolvedValue([]);
  const listeners: ((s: ReportSignal) => void)[] = [];
  const back = { go: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ListService, useValue: { page } },
      { provide: DeviceService, useValue: { currentPosition: vi.fn().mockResolvedValue(opts.position ?? null) } },
      { provide: RealtimeService, useValue: { listen: (fn: (s: ReportSignal) => void) => (listeners.push(fn), () => undefined) } },
      { provide: MapReturnService, useValue: back },
    ],
  });
  if (opts.bbox) TestBed.inject(MapViewService).set(opts.bbox, [100.5, 13.75]);
  const fixture = TestBed.createComponent(ListPage);
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
    }
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const radio = (label: string) => [...root.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent?.includes(label))!;
  const button = (label: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(label));
  return { fixture, root, page, settle, radio, button, back, emit: (s: ReportSignal) => listeners.forEach((fn) => fn(s)) };
}

describe('ListPage', () => {
  it('closes back to the map with an x', async () => {
    const { root } = await setup();
    const close = root.querySelector('.head button.ctl')!;
    expect(close.getAttribute('aria-label')).toBe('กลับไปแผนที่');
    expect(close.querySelector('svg.icon-x')).not.toBeNull();
  });

  it('sits on the shared backdrop', async () => {
    const { root } = await setup();
    expect(root.querySelector('app-backdrop')).not.toBeNull();
    expect(root.querySelector('main.card')?.classList).toContain('glass');
  });

  it('uses the whole country when there was no map view, and says so', async () => {
    const { page, root } = await setup();
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ bbox: [...THAILAND_BBOX], sort: 'new', offset: 0 }));
    expect(root.querySelector('h1')?.textContent).toBe('รายการเรื่อง');
    expect(root.querySelector('.caption-count')?.textContent).toContain('ทั้งประเทศ · 3 เรื่อง');
  });

  it("uses the map's last view", async () => {
    const { page, root } = await setup({ bbox: [100, 13, 101, 14] });
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ bbox: [100, 13, 101, 14] }));
    expect(root.querySelector('.caption-count')?.textContent).toContain('ในกรอบแผนที่ตอนนี้ · 3 เรื่อง');
  });

  it('starts again at offset 0 when the sort changes, dropping a late answer', async () => {
    let late!: (r: ListRow[]) => void;
    const { page, radio, settle, root } = await setup({ pages: [] });
    page.mockReset();
    page.mockImplementationOnce(() => new Promise((r) => (late = r)));
    page.mockResolvedValueOnce([row('fresh')]);
    radio('เจอเหมือนกันมากสุด').click();
    await settle();
    radio('ค้างนานสุด').click();
    await settle();
    late([row('stale')]);
    await settle();
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'oldest', offset: 0 }));
    expect(root.textContent).toContain('เรื่อง fresh');
    expect(root.textContent).not.toContain('เรื่อง stale');
    expect(radio('ค้างนานสุด').getAttribute('aria-checked')).toBe('true');
  });

  it('falls back to newest with a reason when the position is not available', async () => {
    const { radio, settle, root, page } = await setup({ position: null });
    radio('ใกล้ฉัน').click();
    await settle();
    expect(radio('ใหม่สุด').getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('.status')?.textContent).toContain('เปิดสิทธิ์ตำแหน่งก่อนนะ');
    expect(page).not.toHaveBeenCalledWith(expect.objectContaining({ sort: 'near' }));
  });

  it('sorts near the position and shows distances only then', async () => {
    const { radio, settle, root, page } = await setup({
      position: { lng: 100.5, lat: 13.7 },
      pages: [rows(2), [row('a', { distance_m: 350 }), row('b', { distance_m: 1234 })]],
    });
    expect(root.querySelector('.distance')).toBeNull();
    radio('ใกล้ฉัน').click();
    await settle();
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'near', near: { lng: 100.5, lat: 13.7 } }));
    expect([...root.querySelectorAll('.distance')].map((d) => d.textContent?.trim())).toEqual(['350 ม.', '1.2 กม.']);
  });

  it('pages by 50 with "ดูเพิ่มอีก" and stops on a short page', async () => {
    const { button, settle, page, root } = await setup({ pages: [rows(50), rows(10, 50)] });
    expect(button('ดูเพิ่มอีก')).toBeDefined();
    button('ดูเพิ่มอีก')!.click();
    await settle();
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50 }));
    expect(root.querySelectorAll('a.row')).toHaveLength(60);
    expect(new Set([...root.querySelectorAll('a.row')].map((a) => a.getAttribute('href'))).size).toBe(60);
    expect(button('ดูเพิ่มอีก')).toBeUndefined();
  });

  it('does not show a report twice when the next page overlaps the one before (a report arrived meanwhile)', async () => {
    const { button, settle, root } = await setup({ pages: [rows(50), [...rows(5, 48), ...rows(3, 60)]] });
    button('ดูเพิ่มอีก')!.click();
    await settle();
    const hrefs = [...root.querySelectorAll('a.row')].map((a) => a.getAttribute('href'));
    expect(hrefs).toHaveLength(56); // the 50 + r50..r52 + r60..r62; r48 and r49 came again and are skipped
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('keeps the rows on screen when the next page fails to load, and says so', async () => {
    const { button, settle, root, page } = await setup({ pages: [rows(50)] });
    page.mockRejectedValueOnce(new Error('offline'));
    button('ดูเพิ่มอีก')!.click();
    await settle();
    expect(root.querySelectorAll('a.row')).toHaveLength(50);
    expect(root.querySelector('.status')?.textContent).toContain('โหลดรายการไม่สำเร็จ');
    expect(button('ดูเพิ่มอีก')).toBeDefined(); // and it can be tried again
  });

  it('says "50+" in the heading while there is another page, and the exact number when there is not', async () => {
    const { button, settle, root } = await setup({ pages: [rows(50), rows(10, 50)] });
    expect(root.querySelector('.caption-count')?.textContent).toContain('50+ เรื่อง');
    button('ดูเพิ่มอีก')!.click();
    await settle();
    expect(root.querySelector('.caption-count')?.textContent).toContain('60 เรื่อง');
    expect(root.querySelector('.caption-count')?.textContent).not.toContain('+');
  });

  it('offers old fixed reports only while fixed reports are shown', async () => {
    const { root, settle, page } = await setup();
    const box = () => root.querySelector<HTMLInputElement>('input.old');
    expect(box()).not.toBeNull();
    expect(root.querySelector('label.check .box app-tick')).toBeNull(); // unticked: an empty box
    box()!.click();
    await settle();
    expect(root.querySelector('label.check .box app-tick svg.play')).not.toBeNull(); // a drawn tick, not the browser's
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ includeOld: true }));
    TestBed.inject(FilterState).showResolved.set(false);
    await settle();
    expect(box()).toBeNull();
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ includeOld: false, statuses: ['open', 'fix_claimed'] }));
  });

  it('links each row to its report with the status in words and a shape', async () => {
    const { root, back } = await setup();
    const a = root.querySelector<HTMLAnchorElement>('a.row')!;
    expect(a.getAttribute('href')).toBe('/r/r0');
    expect(a.querySelector('.state')?.textContent).toContain('ยังไม่ได้แก้');
    expect(a.querySelector('.state svg.icon-eye')).not.toBeNull();
    a.click();
    expect(back.go).toHaveBeenCalledWith(['/r', 'r0']);
  });

  it('says so when the area is empty and can switch to the whole country', async () => {
    const { root, button, settle, page } = await setup({ bbox: [100, 13, 101, 14], pages: [[]] });
    expect(root.textContent).toContain('ไม่มีเรื่องในกรอบนี้');
    button('ดูทั้งประเทศ')!.click();
    await settle();
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ bbox: [...THAILAND_BBOX] }));
  });

  it('shows the error and tries again', async () => {
    const { root, page, button, settle } = await setup({ pages: [] });
    page.mockReset();
    page.mockRejectedValueOnce(new Error('x')).mockResolvedValue(rows(1));
    TestBed.inject(FilterState).levels.set([3]);
    await settle();
    expect(root.textContent).toContain('โหลดรายการไม่สำเร็จ');
    button('ลองอีกครั้ง')!.click();
    await settle();
    expect(root.querySelectorAll('a.row')).toHaveLength(1);
  });

  it('rewords in English without loading again', async () => {
    const { root, page, settle } = await setup();
    const calls = page.mock.calls.length;
    TestBed.inject(I18nService).setLocale('en');
    await settle();
    expect(root.querySelector('h1')?.textContent).toBe('Report list');
    expect(root.querySelector('a.row .state')?.textContent).toContain('Not fixed yet');
    expect(page.mock.calls.length).toBe(calls);
  });

  it('reloads the first page quietly on a live signal, unless the reader paged on', async () => {
    const { page, emit } = await setup();
    vi.useFakeTimers();
    try {
      const calls = page.mock.calls.length;
      emit({ id: 'r1', status: 'open', confirm_count: 1, comment_count: 0 });
      await vi.advanceTimersByTimeAsync(999);
      expect(page.mock.calls.length).toBe(calls);
      await vi.advanceTimersByTimeAsync(1);
      expect(page.mock.calls.length).toBe(calls + 1);
      expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('formatDistance', () => {
  it('metres under a kilometre, one decimal above', () => {
    expect(formatDistance(350, 'th')).toBe('350 ม.');
    expect(formatDistance(350, 'en')).toBe('350 m');
    expect(formatDistance(1234, 'th')).toBe('1.2 กม.');
    expect(formatDistance(1234, 'en')).toBe('1.2 km');
  });
});
