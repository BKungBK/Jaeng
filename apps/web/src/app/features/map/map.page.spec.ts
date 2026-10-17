import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouteReuseStrategy, Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PopoverController } from '@ionic/angular';
import { mapMatcher } from '../../app.routes';
import { AppRouteStrategy } from '../../core/route-strategy';
import type { ReportSignal } from '@jaeng/shared/api';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { LoginPromptService } from '../auth/login-prompt.service';
import { ReportDetailComponent } from '../report-detail/report-detail.component';
import { ReportDetailService } from '../report-detail/report-detail.service';
import { By } from '@angular/platform-browser';
import { MAP_FACTORY } from './map-factory';
import { centerFor, MapPage } from './map.page';
import { EMPTY_COLLECTION } from './report';
import { ReportsService } from './reports.service';

// Stand-in for maplibregl.Map: records handlers and lets a test fire events.
function fakeMap() {
  const handlers: Record<string, (() => void)[]> = {};
  const sources: Record<string, unknown> = {};
  const canvas = { focus: vi.fn() };
  return {
    sources,
    canvas,
    getCanvas: () => canvas,
    addSource: (id: string, spec: unknown) => void (sources[id] = spec),
    addLayer: vi.fn(),
    getStyle: () => ({ layers: [] }),
    setPaintProperty: vi.fn(),
    getContainer: () => document.createElement('div'),
    on: (type: string, fn: () => void) => void (handlers[type] ??= []).push(fn),
    off: () => undefined,
    fire: (type: string) => handlers[type]?.forEach((fn) => fn()),
    getZoom: () => 5,
    getBounds: () => ({ getWest: () => 97, getSouth: () => 5, getEast: () => 106, getNorth: () => 21 }),
    getSource: () => undefined,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    flyTo: vi.fn(),
    remove: vi.fn(),
  };
}

// the account button's services, signed out (Ionic's overlay controllers come from provideIonicAngular)
const rt = {
  listeners: [] as ((s: ReportSignal) => void)[],
  unlisten: vi.fn(),
  listen: vi.fn((fn: (s: ReportSignal) => void) => {
    rt.listeners.push(fn);
    return rt.unlisten;
  }),
  emit: (s: ReportSignal) => rt.listeners.forEach((fn) => fn(s)),
};

const authStubs = [
  { provide: RealtimeService, useValue: { listen: rt.listen } },
  { provide: AuthService, useValue: { signedIn: signal(false), profile: signal(null) } },
  { provide: LoginPromptService, useValue: { ask: vi.fn() } },
  { provide: PopoverController, useValue: { create: vi.fn() } },
];

// a deep-linkable report as the detail service returns it
const DETAIL = {
  id: '7b0c5a3e-1f7d-4c49-9a52-2b8f3d0c6e11',
  title: 'หลุมลึกหน้าตลาด',
  category: 'road',
  icon: 'construction',
  danger_level: 2,
  status: 'open',
  confirm_count: 3,
  comment_count: 0,
  days_open: 4,
  cover_photo_path: null,
  description: null,
  lng: 100.5,
  lat: 13.7,
  place_name: null,
  author_name: null,
  tags: [],
  photos: [],
  created_at: '2026-10-13T08:00:00Z',
  approved_at: '2026-10-13T09:00:00Z',
  resolved_at: null,
} as const;

function fakeDetailService(detail: unknown = DETAIL) {
  return {
    get: vi.fn().mockResolvedValue(detail),
    comments: vi.fn().mockResolvedValue([]),
    myConfirmation: vi.fn().mockResolvedValue(false),
    toggleConfirm: vi.fn(),
    addComment: vi.fn(),
  };
}

/** jsdom has no layout: answer the one breakpoint query as asked. */
function mockWide(wide: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) =>
      ({
        matches: q.includes('min-width: 820px') ? wide : false,
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

async function setup(
  inBbox = vi.fn().mockResolvedValue(EMPTY_COLLECTION),
  opts: { wide?: boolean; detail?: unknown } = {},
) {
  mockWide(opts.wide ?? true);
  const map = fakeMap();
  const navigate = vi.fn().mockResolvedValue(true);
  const detailSvc = fakeDetailService(opts.detail === undefined ? DETAIL : opts.detail);
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: { navigate } },
      { provide: MAP_FACTORY, useValue: () => map },
      { provide: ReportsService, useValue: { inBbox } },
      { provide: ReportDetailService, useValue: detailSvc },
      ...authStubs,
    ],
  });
  const fixture = TestBed.createComponent(MapPage);
  fixture.detectChanges();
  await Promise.resolve(); // the factory result is awaited
  await Promise.resolve();
  const root = fixture.nativeElement as HTMLElement;
  return { map, fixture, root, inBbox, navigate, detailSvc };
}

describe('MapPage', () => {
  beforeEach(() => {
    rt.listeners.length = 0;
    rt.listen.mockClear();
    rt.unlisten.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('turns a burst of realtime signals into one reload, and stops listening when destroyed', async () => {
    vi.useFakeTimers();
    const { fixture, inBbox } = await setup();
    expect(rt.listen).toHaveBeenCalledTimes(1);
    const s = (n: number): ReportSignal => ({ id: `r${n}`, status: 'open', confirm_count: n, comment_count: 0 });
    rt.emit(s(1));
    await vi.advanceTimersByTimeAsync(100);
    rt.emit(s(2));
    await vi.advanceTimersByTimeAsync(100);
    rt.emit(s(3));
    await vi.advanceTimersByTimeAsync(299);
    expect(inBbox).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(inBbox).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(rt.unlisten).toHaveBeenCalledTimes(1);
  });

  it('shows the brand, the level chips and the map controls', async () => {
    const { root } = await setup();
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('แจ้ง');
    expect(root.querySelectorAll('app-filter-bar button')).toHaveLength(4);
    for (const label of ['ซูมเข้า', 'ซูมออก', 'ไปที่ตำแหน่งของฉัน']) {
      expect(root.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
    }
  });

  it('puts the account button after the locate button', async () => {
    const { root } = await setup();
    const labels = [...root.querySelectorAll('.controls button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['ซูมเข้า', 'ซูมออก', 'ไปที่ตำแหน่งของฉัน', 'เข้าสู่ระบบ']);
  });

  it('loads reports for the view 300 ms after the map stops moving', async () => {
    vi.useFakeTimers();
    const { map, inBbox } = await setup();
    map.fire('moveend');
    map.fire('moveend');
    expect(inBbox).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(inBbox).toHaveBeenCalledTimes(1);
    expect(inBbox).toHaveBeenCalledWith([97, 5, 106, 21], [0, 1, 2, 3]);
  });

  it('says so when every level chip is off', async () => {
    vi.useFakeTimers();
    const { fixture, root } = await setup();
    for (const b of [...root.querySelectorAll<HTMLButtonElement>('app-filter-bar button')]) b.click();
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(root.querySelector('.hint')?.textContent).toContain('ปิดตัวกรองครบทุกระดับแล้ว');
  });

  it('shows a toast when loading fails', async () => {
    vi.useFakeTimers();
    const { map, fixture, root } = await setup(vi.fn().mockRejectedValue(new Error('offline')));
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('โหลดข้อมูลไม่สำเร็จ');
  });

  it('puts the chips and controls before the map in tab order', async () => {
    const { root } = await setup();
    const order = [...root.querySelectorAll('app-filter-bar, .controls, .map')].map((e) => e.className || e.tagName);
    expect(order).toEqual(['APP-FILTER-BAR', 'controls', 'map']);
  });

  const report = {
    id: 'r1',
    title: 'หลุมลึก',
    category: 'road',
    icon: 'construction',
    danger_level: 2,
    status: 'open',
    confirm_count: 3,
    comment_count: 0,
    days_open: 4,
    cover_photo_path: null,
  } as const;

  const settle = async (fixture: { detectChanges: () => void }) => {
    for (let i = 0; i < 8; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
    fixture.detectChanges();
  };

  it('opens the detail panel for the clicked report and closes it with Escape', async () => {
    const { fixture, root, navigate } = await setup(undefined, { wide: true });
    const page = fixture.componentInstance;
    page.select({ ...report });
    expect(navigate).toHaveBeenCalledWith(['/r', 'r1']);
    fixture.componentRef.setInput('id', 'r1'); // what the router does after the navigation
    await settle(fixture);
    const panel = root.querySelector('aside.panel')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.querySelector(`#${panel.getAttribute('aria-labelledby')}`)?.textContent?.trim()).toBe('หลุมลึกหน้าตลาด');
    expect(root.querySelector('.peek')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('moves the map controls beside the open panel', async () => {
    const { fixture, root } = await setup(undefined, { wide: true });
    expect(root.querySelector('.controls')?.classList).not.toContain('beside');
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    expect(root.querySelector('.controls')?.classList).toContain('beside');
  });

  it('uses a bottom sheet instead of the panel on narrow screens', async () => {
    const { fixture, root } = await setup(undefined, { wide: false });
    fixture.componentRef.setInput('id', DETAIL.id);
    fixture.detectChanges();
    expect(root.querySelector('aside.panel')).toBeNull();
    const sheet = root.querySelector('ion-modal')!;
    expect(sheet).not.toBeNull();
    expect(sheet.getAttribute('aria-labelledby')).toBe('report-detail-title');
  });

  // Ionic can dismiss the sheet on its own (role undefined) while another overlay opens over it; only the
  // reader's own close (drag to 0, the backdrop at full height, Escape, the close button) may end the report
  type Sheet = HTMLElement & { canDismiss: (data?: unknown, role?: string) => Promise<boolean> | boolean };
  const openSheet = async () => {
    const s = await setup(undefined, { wide: false });
    s.fixture.componentRef.setInput('id', DETAIL.id);
    s.fixture.detectChanges();
    const sheet = s.root.querySelector('ion-modal.detail-sheet') as Sheet; // Ionic moves it out once presented
    await settle(s.fixture);
    return { ...s, sheet };
  };
  const dismissed = (sheet: HTMLElement, role?: string) =>
    sheet.dispatchEvent(new CustomEvent('didDismiss', { detail: { data: undefined, role } }));

  it('keeps the report sheet open when something other than the reader dismisses it', async () => {
    const { sheet, navigate } = await openSheet();
    expect(await sheet.canDismiss(undefined, undefined)).toBe(false);
    expect(await sheet.canDismiss(undefined, 'cancel')).toBe(false);
    dismissed(sheet, undefined);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('lets the reader close the report sheet by dragging, the backdrop or Escape', async () => {
    const { sheet, navigate } = await openSheet();
    for (const role of ['gesture', 'backdrop']) expect(await sheet.canDismiss(undefined, role)).toBe(true);
    dismissed(sheet, 'handler'); // Ionic's role once canDismiss allowed a drag to 0
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/']);
    dismissed(sheet, 'backdrop');
    expect(navigate).toHaveBeenCalledTimes(1); // no second navigation for the same report
  });

  it('lets the sheet go once the page closes the report itself', async () => {
    const { fixture, sheet, navigate } = await openSheet();
    fixture.componentInstance.close(); // the close button
    expect(await sheet.canDismiss(undefined, undefined)).toBe(true);
    fixture.componentRef.setInput('id', undefined); // the router landed on '/'
    await settle(fixture);
    dismissed(sheet, undefined); // [isOpen] went false
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the report’s disc after closing', async () => {
    const { fixture, map, navigate } = await setup(undefined, { wide: true });
    const beacons = { focus: vi.fn(() => true), setSelected: vi.fn(), destroy: vi.fn() };
    (fixture.componentInstance as unknown as { beacons: typeof beacons }).beacons = beacons;
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    let landed!: (v: boolean) => void;
    navigate.mockReturnValueOnce(new Promise((r) => (landed = r)));
    fixture.componentInstance.close();
    expect(beacons.setSelected).toHaveBeenLastCalledWith(null);
    expect(beacons.focus).not.toHaveBeenCalled(); // not before the navigation settles
    landed(true);
    await settle(fixture);
    expect(beacons.focus).toHaveBeenCalledWith(DETAIL.id);
    expect(map.canvas.focus).not.toHaveBeenCalled();
  });

  it('focuses the map canvas when the closed report has no marker', async () => {
    const { fixture, map } = await setup(undefined, { wide: true });
    fixture.componentRef.setInput('id', 'r9');
    fixture.detectChanges();
    fixture.componentInstance.close();
    await settle(fixture);
    expect(map.canvas.focus).toHaveBeenCalled();
  });

  it('flies to a deep-linked report at street zoom', async () => {
    const { fixture, map } = await setup(undefined, { wide: true });
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    // left of the 380 px panel: the view's centre sits east of the report, at the same latitude
    const [{ center, zoom }] = map.flyTo.mock.calls[0] as [{ center: [number, number]; zoom: number }];
    expect(zoom).toBe(15);
    expect(center).toEqual(centerFor([100.5, 13.7], 15, [-202, 0]));
    expect(center[0]).toBeGreaterThan(100.5);
    expect(center[1]).toBeCloseTo(13.7, 6);
  });

  it('turns a pixel offset into the map centre that puts the target there', () => {
    expect(centerFor([100.5, 13.7], 15, [0, 0])).toEqual([100.5, expect.closeTo(13.7, 9)]);
    // 512 * 2^15 px per 360 degrees: 202 px is about 0.00434 degrees of longitude
    expect(centerFor([100.5, 13.7], 15, [-202, 0])[0]).toBeCloseTo(100.5 + (202 * 360) / (512 * 2 ** 15), 9);
    // a target pushed up (negative y) means the centre moves south
    expect(centerFor([100.5, 13.7], 15, [0, -260])[1]).toBeLessThan(13.7);
  });

  it('does not fly when the report was clicked on the map, but does after Back reopens it', async () => {
    const { fixture, map } = await setup(undefined, { wide: true });
    fixture.componentInstance.select({ ...report, id: DETAIL.id });
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    expect(map.flyTo).not.toHaveBeenCalled();
    fixture.componentInstance.close();
    fixture.componentRef.setInput('id', undefined);
    await settle(fixture);
    fixture.componentRef.setInput('id', DETAIL.id); // browser Back to /r/:id: no stale click
    await settle(fixture);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('says so and goes home when the linked report cannot be shown', async () => {
    const { fixture, root, navigate } = await setup(undefined, { wide: true, detail: null });
    fixture.componentRef.setInput('id', 'not-a-uuid');
    await settle(fixture);
    expect(root.querySelector('.toast')?.textContent).toContain('ไม่พบเรื่องนี้ หรือเรื่องนี้ยังไม่เปิดให้เห็นนะ');
    expect(navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
  });

  it('reloads the beams at once when the panel changes a count', async () => {
    vi.useFakeTimers();
    const { fixture, inBbox } = await setup(undefined, { wide: true });
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    const panel = fixture.debugElement.query(By.directive(ReportDetailComponent)).componentInstance as ReportDetailComponent;
    expect(inBbox).not.toHaveBeenCalled();
    panel.changed.emit({ id: DETAIL.id, status: 'open', confirm_count: 9, comment_count: 0 });
    await vi.advanceTimersByTimeAsync(0);
    expect(inBbox).toHaveBeenCalledTimes(1);
  });

  it('keeps one page and one map from / to /r/x', async () => {
    const map = fakeMap();
    const factory = vi.fn(() => map);
    TestBed.configureTestingModule({
      providers: [
        { provide: RouteReuseStrategy, useClass: AppRouteStrategy },
        provideRouter([{ matcher: mapMatcher, data: { reuse: 'map' }, component: MapPage }], withComponentInputBinding()),
        { provide: MAP_FACTORY, useValue: factory },
        { provide: ReportsService, useValue: { inBbox: vi.fn().mockResolvedValue(EMPTY_COLLECTION) } },
        { provide: ReportDetailService, useValue: fakeDetailService() },
        ...authStubs,
      ],
    });
    const harness = await RouterTestingHarness.create();
    const first = await harness.navigateByUrl('/', MapPage);
    await Promise.resolve();
    await Promise.resolve();
    const second = await harness.navigateByUrl('/r/x', MapPage);
    expect(second).toBe(first);
    expect(second.id()).toBe('x');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('still loads reports when the toy decoration fails to load', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { map, inBbox } = await setup();
    map.fire('load');
    await vi.advanceTimersByTimeAsync(10);
    expect(map.sources['reports']).toBeDefined();
    expect(inBbox).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('removes a map that arrives after the page is gone', async () => {
    let resolveMap!: (m: unknown) => void;
    const map = fakeMap();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAP_FACTORY, useValue: () => new Promise((r) => (resolveMap = r)) },
        { provide: ReportsService, useValue: { inBbox: vi.fn() } },
        ...authStubs,
      ],
    });
    const fixture = TestBed.createComponent(MapPage);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.destroy();
    resolveMap(map);
    await Promise.resolve();
    await Promise.resolve();
    expect(map.remove).toHaveBeenCalled();
  });

  it('zooms with the buttons', async () => {
    const { map, root } = await setup();
    root.querySelector<HTMLButtonElement>('button[aria-label="ซูมเข้า"]')!.click();
    root.querySelector<HTMLButtonElement>('button[aria-label="ซูมออก"]')!.click();
    expect(map.zoomIn).toHaveBeenCalled();
    expect(map.zoomOut).toHaveBeenCalled();
  });
});
