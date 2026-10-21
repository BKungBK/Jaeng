import { TestBed } from '@angular/core/testing';
import type { Place, PlacesAnswer } from '@jaeng/shared/places';
import { I18nService } from '../../core/i18n.service';
import { PlacesService } from './places.service';
import type { ReportProps } from './report';
import { ReportsService } from './reports.service';
import { SearchBoxComponent } from './search-box.component';

const place = (name: string, bbox: Place['bbox'] = null): Place => ({ name, detail: 'เชียงใหม่', lng: 99, lat: 18.8, bbox, source: 'local' });
const report = (id: string, title = `เรื่อง ${id}`): ReportProps => ({
  id,
  title,
  category: 'road',
  icon: 'construction',
  danger_level: 2,
  status: 'open',
  confirm_count: 0,
  comment_count: 0,
  days_open: 1,
  cover_photo_path: null,
});

type Answer<T> = T | Error | Promise<T>;

async function setup(opts: { collapsed?: boolean; places?: Answer<PlacesAnswer>; reports?: Answer<ReportProps[]> } = {}) {
  vi.useFakeTimers();
  const answer = <T,>(a: Answer<T> | undefined, fallback: T) =>
    vi.fn(() => (a instanceof Error ? Promise.reject(a) : Promise.resolve(a ?? fallback)));
  const places = { search: answer(opts.places, { places: [place('เชียงใหม่')], online: true }) };
  const reports = { search: answer(opts.reports, [report('r1'), report('r2')]) };
  TestBed.configureTestingModule({
    providers: [
      { provide: PlacesService, useValue: places },
      { provide: ReportsService, useValue: reports },
    ],
  });
  const fixture = TestBed.createComponent(SearchBoxComponent);
  fixture.componentRef.setInput('collapsed', opts.collapsed ?? false);
  const out = { place: vi.fn(), report: vi.fn(), opened: vi.fn() };
  fixture.componentInstance.place.subscribe(out.place);
  fixture.componentInstance.report.subscribe(out.report);
  fixture.componentInstance.opened.subscribe(out.opened);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const input = () => root.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const type = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await settle();
  };
  const key = async (k: string) => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    await settle();
  };
  const options = () => [...root.querySelectorAll<HTMLElement>('[role="option"]')];
  return { fixture, root, input, type, key, settle, options, places, reports, out };
}

describe('SearchBoxComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('is an ARIA combobox with a label', async () => {
    const { input } = await setup();
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().getAttribute('aria-autocomplete')).toBe('list');
    expect(input().getAttribute('aria-label')).toBe('ค้นหาเรื่องหรือสถานที่');
  });

  it('on a wide screen the answers are a line of the side panel itself (the host steps out of the layout), not a floating card', async () => {
    const { fixture, root, type, settle } = await setup();
    await type('เชียงใหม่');
    await settle(400);
    expect((fixture.nativeElement as HTMLElement).classList).toContain('wide');
    const results = root.querySelector('.results')!;
    expect(results.classList).toContain('float');
    expect(results.classList).not.toContain('glass'); // the panel is the glass; no second one inside it
  });

  it('on a phone the card is glass like the bar it replaces, denser once answers hang from it', async () => {
    const { fixture, root, type, settle } = await setup({ collapsed: true });
    root.querySelector<HTMLButtonElement>('.search-pill')!.click();
    await settle(10);
    const box = root.querySelector('.box.phone')!;
    expect(box.classList).toContain('glass');
    expect(box.classList).not.toContain('dense');
    await type('เชียงใหม่');
    await settle(400);
    expect(box.classList).toContain('dense');
    expect(fixture.nativeElement.classList).not.toContain('wide');
  });

  it('on a phone the card goes back to the pill when focus leaves it, with no tap on the x', async () => {
    const { fixture, root, input, type, settle, out } = await setup({ collapsed: true });
    root.querySelector<HTMLButtonElement>('.search-pill')!.click();
    await settle(10);
    await type('เชียงใหม่');
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null })); // a tap on the map
    await settle();
    fixture.detectChanges();
    expect(root.querySelector('.box.phone')).toBeNull();
    expect(root.querySelector('.search-pill')).not.toBeNull();
    expect(out.opened).toHaveBeenLastCalledWith(false);
  });

  it('moving focus to the x inside the card does not close it first', async () => {
    const { root, input, settle } = await setup({ collapsed: true });
    root.querySelector<HTMLButtonElement>('.search-pill')!.click();
    await settle(10);
    const x = root.querySelector<HTMLButtonElement>('.close')!;
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: x }));
    await settle();
    expect(root.querySelector('.box.phone')).not.toBeNull();
  });

  it('empties the field from the x on a wide screen and keeps the caret in it', async () => {
    const { root, input, type, settle } = await setup();
    expect(root.querySelector('.clear')).toBeNull();
    await type('เชียงใหม่');
    root.querySelector<HTMLButtonElement>('.clear')!.click();
    await settle();
    expect(input().value).toBe('');
    expect(root.querySelector('.clear')).toBeNull();
  });

  it('does not search one letter', async () => {
    const { type, settle, places, reports } = await setup();
    await type('ถ');
    await settle(400);
    expect(places.search).not.toHaveBeenCalled();
    expect(reports.search).not.toHaveBeenCalled();
  });

  it('searches places and reports once each, 300 ms after typing stops', async () => {
    const { type, settle, places, reports, options, input } = await setup();
    await type('ถน');
    await settle(100);
    await type('ถนน');
    await settle(299);
    expect(places.search).not.toHaveBeenCalled();
    await settle(1);
    expect(places.search).toHaveBeenCalledExactlyOnceWith('ถนน', 'th', false);
    expect(reports.search).toHaveBeenCalledExactlyOnceWith('ถนน');
    expect(options().map((o) => o.querySelector('.name')?.textContent)).toEqual([
      'เชียงใหม่',
      'ค้นสถานที่อื่นใน OpenStreetMap',
      'เรื่อง r1',
      'เรื่อง r2',
    ]);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('drops the answer of an older query', async () => {
    let first!: (a: PlacesAnswer) => void;
    const { type, settle, places, options } = await setup();
    places.search.mockImplementationOnce(() => new Promise((r) => (first = r)));
    await type('ถนน');
    await settle(300);
    await type('ถนนพัง');
    await settle(300);
    first({ places: [place('เก่า')], online: true });
    await settle();
    expect(options().some((o) => o.textContent?.includes('เก่า'))).toBe(false);
    expect(options()[0].textContent).toContain('เชียงใหม่');
  });

  it('moves with the arrow keys and chooses with Enter', async () => {
    const { type, settle, key, input, options, out } = await setup();
    await type('ถนน');
    await settle(300);
    await key('ArrowDown');
    await key('ArrowDown');
    await key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[2].id);
    expect(options()[2].getAttribute('aria-selected')).toBe('true');
    await key('Enter');
    expect(out.report).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().value).toBe('ถนน');
  });

  it('chooses a place by click', async () => {
    const { type, settle, options, out } = await setup({ places: { places: [place('อ.เมือง', [98, 18, 99, 19])], online: true } });
    await type('เมือง');
    await settle(300);
    options()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(out.place).toHaveBeenCalledWith(expect.objectContaining({ name: 'อ.เมือง', bbox: [98, 18, 99, 19] }));
  });

  it('Escape closes the results, then clears, then (on a phone) closes the card and returns focus', async () => {
    const { type, settle, key, input, root, fixture, out } = await setup({ collapsed: true });
    const icon = root.querySelector<HTMLButtonElement>('button[aria-label="ค้นหา"]')!;
    icon.click();
    await settle();
    expect(out.opened).toHaveBeenLastCalledWith(true);
    await type('ถนน');
    await settle(300);
    await key('Escape');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().value).toBe('ถนน');
    await key('Escape');
    expect(input().value).toBe('');
    await key('Escape');
    fixture.detectChanges();
    expect(root.querySelector('input')).toBeNull();
    expect(out.opened).toHaveBeenLastCalledWith(false);
    await settle();
    expect(document.activeElement).toBe(root.querySelector('button[aria-label="ค้นหา"]'));
  });

  it('shows the field text inside the phone pill', async () => {
    const { root } = await setup({ collapsed: true });
    const pill = root.querySelector<HTMLButtonElement>('button.search-pill[aria-label="ค้นหา"]');
    expect(pill).not.toBeNull();
    expect(pill!.querySelector('.ph')?.textContent?.trim()).toBe('ค้นหาเรื่องหรือสถานที่');
  });

  it('asks OpenStreetMap only from the "more places" row, keeping the reports on screen', async () => {
    let more!: (a: PlacesAnswer) => void;
    const { type, settle, root, options, places } = await setup();
    await type('ท่าแพ');
    await settle(300);
    places.search.mockImplementationOnce(() => new Promise((r) => (more = r)));
    options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(places.search).toHaveBeenLastCalledWith('ท่าแพ', 'th', true);
    expect(root.textContent).toContain('กำลังค้นหา…');
    expect(root.textContent).toContain('เรื่อง r1');
    more({ places: [place('เชียงใหม่'), { ...place('ประตูท่าแพ'), source: 'osm' }], online: true });
    await settle();
    expect(options().map((o) => o.querySelector('.name')?.textContent)).toEqual(['เชียงใหม่', 'ประตูท่าแพ', 'เรื่อง r1', 'เรื่อง r2']);
  });

  it('Enter with no row chosen asks for more places', async () => {
    const { type, settle, key, places } = await setup();
    await type('ท่าแพ');
    await settle(300);
    await key('Enter');
    expect(places.search).toHaveBeenLastCalledWith('ท่าแพ', 'th', true);
  });

  it('says when online places are down, and still lists local ones', async () => {
    const { type, settle, root, options, places } = await setup();
    await type('เชียง');
    await settle(300);
    places.search.mockResolvedValueOnce({ places: [place('เชียงใหม่')], online: false });
    options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.textContent).toContain('ค้นสถานที่ออนไลน์ไม่ได้ตอนนี้');
    expect(options()[0].textContent).toContain('เชียงใหม่');
    expect(options().some((o) => o.textContent?.includes('ค้นสถานที่อื่น'))).toBe(false);
  });

  it('offers to try again when both searches fail', async () => {
    const { type, settle, root, places } = await setup({ places: new Error('x'), reports: new Error('y') });
    await type('ถนน');
    await settle(300);
    expect(root.textContent).toContain('ค้นหาไม่สำเร็จ');
    places.search.mockResolvedValue({ places: [place('เชียงใหม่')], online: true });
    root.querySelector<HTMLButtonElement>('.retry')!.click();
    await settle();
    expect(places.search).toHaveBeenCalledTimes(2);
  });

  it('words "nothing found" with the query as text', async () => {
    const { type, settle, root } = await setup({ places: { places: [], online: true }, reports: [] });
    await type('<b>x</b>');
    await settle(300);
    expect(root.querySelector('.results b')).toBeNull();
    expect(root.textContent).toContain('ไม่เจอเรื่องหรือสถานที่ที่ตรงกับ “<b>x</b>”');
  });

  it('asks for places in English after a switch', async () => {
    const { type, settle, places } = await setup();
    TestBed.inject(I18nService).setLocale('en');
    await type('Chiang');
    await settle(300);
    expect(places.search).toHaveBeenCalledWith('Chiang', 'en', false);
  });
});
