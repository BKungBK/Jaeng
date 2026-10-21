import { expectAccessiblePage } from '../../a11y.testing';
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
import { NavigationEnd, NavigationStart } from '@angular/router';
import { Subject } from 'rxjs';
import { MAP_FACTORY } from './map-factory';
import { centerFor, MapPage, PANEL_EXIT } from './map.page';
import { EMPTY_COLLECTION } from './report';
import { ReportsService } from './reports.service';
import { StatsService } from './stats.service';
import { BackButtonService } from '../../core/back-button.service';
import { DeviceService } from '../../core/device.service';
import { th } from '../../i18n/th';
import { MapViewService } from '../../core/map-view.service';
import { I18nService } from '../../core/i18n.service';
import { THAILAND_BOUNDS } from './map-factory';
import { FilterState } from '../../core/filter-state.service';
import { FIT, FLY } from '../../core/motion';

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
    fitBounds: vi.fn(),
    getCenter: () => ({ lng: 101.5, lat: 13 }),
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
  { provide: AuthService, useValue: { session: signal(null), signedIn: signal(false), profile: signal(null) } },
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

/** one report on the map, as reports_in_bbox returns it */
function feature(id: string, o: Record<string, unknown>) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [100.5, 13.7] },
    properties: {
      id,
      title: `เรื่อง ${id}`,
      category: 'road',
      icon: 'construction',
      danger_level: 0,
      status: 'open',
      confirm_count: 0,
      comment_count: 0,
      days_open: 0,
      cover_photo_path: null,
      ...o,
    },
  };
}

function fakeDetailService(detail: unknown = DETAIL) {
  return {
    get: vi.fn().mockResolvedValue(detail),
    comments: vi.fn().mockResolvedValue([]),
    myConfirmation: vi.fn().mockResolvedValue(false),
    toggleConfirm: vi.fn(),
    addComment: vi.fn(),
  };
}

/** jsdom has no layout: answer the breakpoint queries as asked (820 px: wide; 1180 px: room for both panels). */
function mockWide(wide: boolean, roomy = true) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) =>
      ({
        matches: q.includes('min-width: 820px') ? wide : q.includes('min-width: 1180px') ? wide && roomy : false,
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

async function setup(
  inBbox = vi.fn().mockResolvedValue(EMPTY_COLLECTION),
  opts: { wide?: boolean; roomy?: boolean; detail?: unknown; stats?: ReturnType<typeof vi.fn>; device?: unknown; exit?: () => Promise<void> } = {},
) {
  const stats = opts.stats ?? vi.fn().mockResolvedValue({ resolved_this_month: 3, open_count: 12 });
  mockWide(opts.wide ?? true, opts.roomy ?? true);
  const map = fakeMap();
  const navigate = vi.fn().mockResolvedValue(true);
  const events = new Subject<unknown>();
  const detailSvc = fakeDetailService(opts.detail === undefined ? DETAIL : opts.detail);
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: { navigate, events } },
      { provide: MAP_FACTORY, useValue: () => map },
      { provide: ReportsService, useValue: { inBbox } },
      { provide: StatsService, useValue: { inBbox: stats } },
      { provide: ReportDetailService, useValue: detailSvc },
      ...(opts.device ? [{ provide: DeviceService, useValue: opts.device }] : []),
      // the wide panel's exit is over at once, unless a test holds it open
      { provide: PANEL_EXIT, useValue: opts.exit ?? (async () => undefined) },
      ...authStubs,
    ],
  });
  const fixture = TestBed.createComponent(MapPage);
  fixture.detectChanges();
  await Promise.resolve(); // the factory result is awaited
  await Promise.resolve();
  const root = fixture.nativeElement as HTMLElement;
  return { map, fixture, root, inBbox, navigate, detailSvc, events, stats };
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
    expect(root.querySelectorAll('app-filter-bar button.chip')).toHaveLength(4);
    for (const label of ['ซูมเข้า', 'ซูมออก', 'ไปที่ตำแหน่งของฉัน']) {
      expect(root.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
    }
  });

  it('wide: the control column is zoom, locate, home', async () => {
    const { root } = await setup();
    const labels = [...root.querySelectorAll('.controls button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['ซูมเข้า', 'ซูมออก', 'ไปที่ตำแหน่งของฉัน', 'กลับไปดูทั้งประเทศ']);
    expect(root.querySelector('.dock')).toBeNull();
  });

  it('locate flies to the device position, asked through DeviceService (10 s)', async () => {
    const device = { currentPosition: vi.fn().mockResolvedValue({ lng: 100.9, lat: 14.1 }) };
    const { map, root, fixture } = await setup(undefined, { device });
    root.querySelector<HTMLButtonElement>('button[aria-label="ไปที่ตำแหน่งของฉัน"]')!.click();
    await vi.waitFor(() => expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [100.9, 14.1], zoom: 14 })));
    expect(device.currentPosition).toHaveBeenCalledWith(10000);
    fixture.destroy();
  });

  it('locate says so, and stays put, when the position is not available', async () => {
    const device = { currentPosition: vi.fn().mockResolvedValue(null) };
    const { map, root, fixture } = await setup(undefined, { device });
    root.querySelector<HTMLButtonElement>('button[aria-label="ไปที่ตำแหน่งของฉัน"]')!.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain(th.map.toast.geoDenied);
    });
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it('phone: only locate floats; the dock has map, list, report and me', async () => {
    const { root } = await setup(undefined, { wide: false });
    const labels = [...root.querySelectorAll('.controls button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['ไปที่ตำแหน่งของฉัน']);
    const dock = root.querySelector('nav.dock')!;
    expect(dock.querySelector('button[aria-current="page"]')?.textContent?.trim()).toBe('แผนที่');
    expect(dock.querySelector('button[aria-label="ดูเป็นรายการ"]')).not.toBeNull();
    expect(dock.querySelector('app-report-fab button[aria-label="แจ้งเรื่องใหม่"]')).not.toBeNull();
    expect(dock.querySelector('app-account-button button[aria-label="ของฉัน: เข้าสู่ระบบ"]')).not.toBeNull();
    expect(root.querySelector('button[aria-label="ซูมเข้า"]')).toBeNull();
  });

  it('loads reports for the view 300 ms after the map stops moving', async () => {
    vi.useFakeTimers();
    const { map, inBbox } = await setup();
    map.fire('moveend');
    map.fire('moveend');
    expect(inBbox).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(inBbox).toHaveBeenCalledTimes(1);
    expect(inBbox).toHaveBeenCalledWith([97, 5, 106, 21], { levels: [0, 1, 2, 3], categories: [], statuses: ['open', 'fix_claimed', 'resolved'] });
  });

  it('says so when every level chip is off', async () => {
    vi.useFakeTimers();
    const inBbox = vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [feature('r1', {})] });
    const { fixture, root } = await setup(inBbox);
    const chips = [...root.querySelectorAll<HTMLButtonElement>('app-filter-bar button.chip')];
    for (const b of chips) b.click();
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    const line = () => root.querySelector('.summary .hint-line')!;
    expect(root.querySelector('.summary')?.textContent).toContain('ปิดตัวกรองครบทุกระดับแล้ว');
    expect(line().classList).not.toContain('sr-only');
    // a zoom tip is not a state: it stays for screen readers only
    for (const b of chips) b.click();
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(line().textContent).toContain('ภาพรวมประเทศ');
    expect(line().classList).toContain('sr-only');
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
    const order = [...root.querySelectorAll('app-filter-bar, .controls, .map')].map((e) => e.classList[0] ?? e.tagName);
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

  /** a panel on screen for r1 whose exit (`leave`) stays pending until `finish()` */
  async function leavingPanel() {
    let finish!: () => void;
    const s = await setup(undefined, { wide: true, exit: () => new Promise<void>((r) => (finish = r)) });
    s.fixture.componentRef.setInput('id', 'r1');
    await settle(s.fixture);
    s.fixture.componentInstance.close();
    return { ...s, finish: () => finish() };
  }

  it('wide: the panel plays its exit; it stays on screen until the exit is over (plan 8)', async () => {
    const { fixture, root, finish, navigate } = await leavingPanel();
    const page = fixture.componentInstance;
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(page.panelLeaving()).toBe('r1');
    fixture.componentRef.setInput('id', undefined); // the URL is back at /
    await settle(fixture);
    expect(root.querySelector('aside.panel.leaving')).not.toBeNull();
    finish();
    await settle(fixture);
    expect(page.panelLeaving()).toBeNull();
    expect(root.querySelector('aside.panel')).toBeNull();
  });

  it('wide: opening another report while the panel leaves shows it at once, on one panel', async () => {
    const { fixture, root } = await leavingPanel();
    fixture.componentRef.setInput('id', undefined);
    await settle(fixture);
    fixture.componentRef.setInput('id', 'r2');
    await settle(fixture);
    expect(fixture.componentInstance.panelLeaving()).toBeNull();
    expect(root.querySelectorAll('aside.panel')).toHaveLength(1);
    expect(root.querySelector('aside.panel.leaving')).toBeNull();
  });

  it('can close again when the navigation to / did not happen', async () => {
    const { fixture, navigate } = await setup(undefined, { wide: true });
    fixture.componentRef.setInput('id', 'r1');
    await settle(fixture);
    navigate.mockResolvedValue(false);
    const page = fixture.componentInstance;
    page.close();
    await Promise.resolve();
    await Promise.resolve();
    page.close();
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('Android back closes the wide detail panel, and passes the button on when nothing is open (plan 7)', async () => {
    const { fixture, navigate } = await setup(undefined, { wide: true });
    const page = fixture.componentInstance;
    const next = vi.fn();
    page.onHardwareBack(next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    page.onHardwareBack(next);
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('on a phone the sheet, an Ionic overlay, takes the back button first: the page passes it on', async () => {
    const { fixture } = await setup(undefined, { wide: false });
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    const next = vi.fn();
    fixture.componentInstance.onHardwareBack(next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('holds the Android back button only while the page shows (plan 7)', async () => {
    const release = vi.fn();
    const on = vi.fn(() => release);
    TestBed.configureTestingModule({ providers: [{ provide: BackButtonService, useValue: { on } }] });
    const { fixture } = await setup(undefined, { wide: true });
    fixture.componentInstance.ionViewDidEnter();
    expect(on).toHaveBeenCalledWith(10, expect.any(Function));
    fixture.componentInstance.ionViewWillLeave();
    expect(release).toHaveBeenCalledTimes(1);
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
    expect(center).toEqual(centerFor([100.5, 13.7], 15, [-210, 0])); // half the 420 px panel space
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

  it('uses the panel\'s own words when it closes itself (an admin hid the report)', async () => {
    const { fixture, root } = await setup(undefined, { wide: true });
    (fixture.componentInstance as unknown as { onMissing(m?: string): void }).onMissing('ซ่อนเรื่องนี้แล้ว');
    await settle(fixture);
    expect(root.querySelector('.toast')?.textContent).toContain('ซ่อนเรื่องนี้แล้ว');
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
    // the real beacon layer would lazy-load the whole MapLibre bundle, which can finish evaluating after
    // this file's jsdom is gone and fail another file ("reading '_buffer'"); it has its own spec
    vi.spyOn(MapPage.prototype as unknown as { startBeacons: () => Promise<void> }, 'startBeacons').mockResolvedValue();
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

  it('has the floating "แจ้ง" button after the controls', async () => {
    const { root } = await setup();
    const fab = root.querySelector('app-report-fab button');
    expect(fab?.getAttribute('aria-label')).toBe('แจ้งเรื่องใหม่');
    const order = [...root.querySelectorAll('.controls, app-report-fab')].map((e) => e.tagName);
    expect(order).toEqual(['DIV', 'APP-REPORT-FAB']);
  });

  it('hides the floating button while the report sheet is open on a phone', async () => {
    const { fixture, root } = await setup(undefined, { wide: false });
    expect(root.querySelector('app-report-fab')).not.toBeNull();
    expect(root.querySelector('.dock')).not.toBeNull();
    fixture.componentRef.setInput('id', DETAIL.id);
    fixture.detectChanges();
    expect(root.querySelector('app-report-fab')).toBeNull();
    expect(root.querySelector('.dock')).toBeNull();
    fixture.componentRef.setInput('id', undefined);
    fixture.detectChanges();
    expect(root.querySelector('app-report-fab')).not.toBeNull();
    expect(root.querySelector('.dock')).not.toBeNull();
  });

  it('marks the page while the phone sheet is open, so beams stay short enough to show their head', async () => {
    const { fixture } = await setup(undefined, { wide: false });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).not.toContain('sheet-open');
    fixture.componentRef.setInput('id', DETAIL.id);
    fixture.detectChanges();
    expect(host.classList).toContain('sheet-open');
    fixture.componentRef.setInput('id', undefined);
    fixture.detectChanges();
    expect(host.classList).not.toContain('sheet-open');
  });

  it('lists the top three reports in view and links to all', async () => {
    vi.useFakeTimers();
    const inBbox = vi.fn().mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        feature('low', { danger_level: 0 }),
        feature('crit', { danger_level: 3, confirm_count: 18 }),
        feature('done', { danger_level: 3, status: 'resolved' }),
        feature('mid', { danger_level: 2 }),
      ],
    });
    const { map, fixture, root, navigate } = await setup(inBbox);
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    const rows = [...root.querySelectorAll<HTMLButtonElement>('.side .in-view button')];
    expect(rows.map((b) => b.querySelector('.name')?.textContent?.trim())).toEqual(['เรื่อง crit', 'เรื่อง mid', 'เรื่อง low']);
    expect(rows[0].querySelector('app-level-shape')).not.toBeNull();
    expect(rows[0].textContent).toContain('18 คน');
    rows[0].click();
    expect(navigate).toHaveBeenCalledWith(['/r', 'crit']);
    const all = root.querySelector<HTMLAnchorElement>('.side a.all')!;
    expect(all.textContent?.trim()).toBe('ดูทั้งหมด 4 เรื่อง');
    expect(all.getAttribute('href')).toBe('/list');
  });

  it('folds the side panel to the search row when the detail panel opens below 1180 px', async () => {
    const narrow = await setup(undefined, { wide: true, roomy: false });
    expect(narrow.root.querySelector('.side')?.classList).not.toContain('compact');
    narrow.fixture.componentRef.setInput('id', DETAIL.id);
    await settle(narrow.fixture);
    expect(narrow.root.querySelector('.side')?.classList).toContain('compact');
    TestBed.resetTestingModule();
    const roomy = await setup(undefined, { wide: true, roomy: true });
    roomy.fixture.componentRef.setInput('id', DETAIL.id);
    await settle(roomy.fixture);
    expect(roomy.root.querySelector('.side')?.classList).not.toContain('compact');
  });

  it('keeps English labels inside the dock', async () => {
    const { root, fixture } = await setup(undefined, { wide: false });
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    fixture.detectChanges();
    const words = [...root.querySelectorAll('.dock button')].map((b) => b.textContent?.trim()).filter(Boolean);
    expect(words).toEqual(['Map', 'List', 'Me']);
  });

  it('keeps the floating button beside the open panel on a wide screen', async () => {
    const { fixture, root } = await setup(undefined, { wide: true });
    fixture.componentRef.setInput('id', DETAIL.id);
    await settle(fixture);
    expect(root.querySelector('app-report-fab')?.classList).toContain('beside');
  });

  it('shows the toast a page sent along with its navigation', async () => {
    const { fixture, root, events } = await setup();
    history.replaceState({ toast: 'ขอบคุณนะ นับให้แล้ว' }, '');
    events.next(new NavigationStart(1, '/r/d1', 'imperative'));
    events.next(new NavigationEnd(1, '/r/d1', '/r/d1'));
    fixture.detectChanges();
    expect(root.querySelector('.toast')?.textContent).toContain('ขอบคุณนะ นับให้แล้ว');
    history.replaceState(null, '');
  });

  it('does not repeat that toast when the reader comes back with Back', async () => {
    const { fixture, root, events } = await setup();
    history.replaceState({ toast: 'ขอบคุณนะ นับให้แล้ว' }, '');
    events.next(new NavigationStart(2, '/r/d1', 'popstate'));
    events.next(new NavigationEnd(2, '/r/d1', '/r/d1'));
    fixture.detectChanges();
    expect(root.querySelector('.toast')).toBeNull();
    history.replaceState(null, '');
  });

  it('the hover tooltip shows the small thumb of the cover photo, not the full picture', async () => {
    const { fixture, root } = await setup(undefined, { wide: true });
    fixture.componentInstance.hover.set({ p: { ...report, cover_photo_path: 'r1/a.webp' } as never, x: 10, y: 10 });
    fixture.detectChanges();
    const src = root.querySelector('.tip img')?.getAttribute('src') ?? '';
    expect(src).toContain('r1/a_thumb.webp');
    expect(src).not.toMatch(/r1\/a\.webp/);
  });

  it('zooms with the buttons', async () => {
    const { map, root } = await setup();
    root.querySelector<HTMLButtonElement>('button[aria-label="ซูมเข้า"]')!.click();
    root.querySelector<HTMLButtonElement>('button[aria-label="ซูมออก"]')!.click();
    expect(map.zoomIn).toHaveBeenCalled();
    expect(map.zoomOut).toHaveBeenCalled();
  });
});

describe('MapPage plan 6: numbers, home, list, retry toasts, language', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const loaded = async () => {
    vi.useFakeTimers();
    const t = await setup();
    t.map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    t.fixture.detectChanges();
    return t;
  };

  it('shows the month numbers for the view next to the hint, from the same load', async () => {
    const { root, stats } = await loaded();
    expect(stats).toHaveBeenCalledWith([97, 5, 106, 21]);
    const numbers = root.querySelector('.summary app-stats-line')?.textContent?.replace(/\s+/g, ' ');
    expect(numbers).toContain('12 ค้างอยู่');
    expect(numbers).toContain('แก้แล้ว 3');
    expect(root.querySelector('.summary .hint-line')?.textContent).toContain('ยังไม่มีเรื่อง');
    expect(root.querySelector('.summary .hint-line')?.getAttribute('aria-live')).toBe('polite');
    expect(root.querySelector('app-stats-line')?.hasAttribute('aria-live')).toBe(false);
  });

  it('drops the numbers line when the numbers fail, keeping the hint', async () => {
    vi.useFakeTimers();
    const { map, fixture, root } = await setup(undefined, { stats: vi.fn().mockRejectedValue(new Error('x')) });
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(root.querySelector('app-stats-line')?.textContent?.trim()).toBe('');
    expect(root.querySelector('.summary .hint-line')?.textContent).toContain('ยังไม่มีเรื่อง');
  });

  it('keeps newer numbers when an older answer arrives late', async () => {
    vi.useFakeTimers();
    let first!: (v: unknown) => void;
    const stats = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (first = r)))
      .mockResolvedValueOnce({ resolved_this_month: 9, open_count: 9 });
    const { map, fixture, root } = await setup(undefined, { stats });
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    first({ resolved_this_month: 1, open_count: 1 });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(root.querySelector('app-stats-line')?.textContent).toContain('9');
  });

  it('remembers the loaded view for /list', async () => {
    await loaded();
    expect(TestBed.inject(MapViewService).bbox()).toEqual([97, 5, 106, 21]);
    expect(TestBed.inject(MapViewService).center()).toEqual([101.5, 13]);
  });

  it('flies back to the whole country and opens the list', async () => {
    const { root, map, navigate } = await setup();
    root.querySelector<HTMLButtonElement>('button[aria-label="กลับไปดูทั้งประเทศ"]')!.click();
    expect(map.fitBounds).toHaveBeenCalledWith(THAILAND_BOUNDS, expect.objectContaining({ padding: expect.anything(), duration: 1200 }));
    root.querySelector<HTMLButtonElement>('button[aria-label="ดูเป็นรายการ"]')!.click();
    expect(navigate).toHaveBeenCalledWith(['/list']);
    TestBed.resetTestingModule();
    // phones: the map tab you are on flies home; the summary pill opens the list
    const phone = await setup(undefined, { wide: false });
    phone.root.querySelector<HTMLButtonElement>('.dock button[aria-current="page"]')!.click();
    expect(phone.map.fitBounds).toHaveBeenCalledWith(THAILAND_BOUNDS, expect.objectContaining({ padding: expect.anything(), duration: 1200 }));
    phone.root.querySelector<HTMLButtonElement>('.summary button.open-list')!.click();
    expect(phone.navigate).toHaveBeenCalledWith(['/list']);
  });

  it('starts with a skip link to the list, and the menu carries language and about', async () => {
    const { root } = await setup();
    const first = root.querySelector('a, button')!;
    expect(first.textContent?.trim()).toBe('ข้ามไปที่รายการเรื่อง');
    expect(first.getAttribute('href')).toBe('/list');
    expect(root.querySelector('.menu app-language-toggle button')).not.toBeNull();
    expect(root.querySelector('.menu button[aria-label="เกี่ยวกับแจ้ง"]')).not.toBeNull();
  });

  it('a failed load offers "ลองใหม่", which loads again and hides the toast', async () => {
    vi.useFakeTimers();
    const inBbox = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(EMPTY_COLLECTION);
    const { map, fixture, root } = await setup(inBbox);
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    const retry = root.querySelector<HTMLButtonElement>('.toast button')!;
    expect(retry.textContent?.trim()).toBe('ลองใหม่');
    retry.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(inBbox).toHaveBeenCalledTimes(2);
    expect(root.querySelector('.toast')).toBeNull();
  });

  it('keeps an action toast 8 s and a plain one 3.2 s', async () => {
    vi.useFakeTimers();
    const { map, fixture, root } = await setup(vi.fn().mockRejectedValue(new Error('offline')));
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(7900);
    fixture.detectChanges();
    expect(root.querySelector('.toast')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    fixture.detectChanges();
    expect(root.querySelector('.toast')).toBeNull();
    root.querySelector<HTMLButtonElement>('button[aria-label="ไปที่ตำแหน่งของฉัน"]')!.click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(3300);
    fixture.detectChanges();
    expect(root.querySelector('.toast')).toBeNull();
  });

  /** the 8 s toast of a failed load, up to the moment its time is over and it starts to leave */
  async function leavingToast() {
    vi.useFakeTimers();
    let finish!: () => void;
    const s = await setup(vi.fn().mockRejectedValue(new Error('offline')), { exit: () => new Promise<void>((r) => (finish = r)) });
    s.map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    s.fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(8000);
    s.fixture.detectChanges();
    return { ...s, finish: () => finish() };
  }

  it('the toast fades out for 180 ms when its time is up, and goes once it has faded (plan 8)', async () => {
    const { fixture, root, finish } = await leavingToast();
    expect(fixture.componentInstance.toastLeaving()).toBe(true);
    expect(root.querySelector('.toast.leaving')).not.toBeNull(); // still there, not clickable
    finish();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(root.querySelector('.toast')).toBeNull();
    expect(fixture.componentInstance.toastLeaving()).toBe(false);
  });

  it('a new toast replaces one that is leaving, at once and without stacking', async () => {
    const { fixture, root, finish } = await leavingToast();
    (fixture.componentInstance as unknown as { showToast(k: string): void }).showToast('map.toast.geoDenied');
    fixture.detectChanges();
    expect(fixture.componentInstance.toastLeaving()).toBe(false);
    expect(root.querySelectorAll('.toast')).toHaveLength(1);
    expect(root.querySelector('.toast')?.textContent).toContain(th.map.toast.geoDenied);
    finish(); // the old exit ends: it must not remove the new toast
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(root.querySelector('.toast')).not.toBeNull();
  });

  it('runs the toast button once even when pressed again while the toast leaves', async () => {
    const { fixture, root } = await leavingToast();
    const retry = root.querySelector<HTMLButtonElement>('.toast button')!;
    const inBbox = fixture.componentInstance as unknown as { runToast(t: unknown): void };
    const t = fixture.componentInstance.toast()!;
    const run = vi.fn();
    t.action = { label: 'common.retry', run };
    retry.click(); // the real button, while it is leaving
    inBbox.runToast(t); // a second press of the same toast
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('labels the new controls in English too', async () => {
    const { root, fixture } = await setup();
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    fixture.detectChanges();
    for (const label of ['Back to the whole country', 'Show as a list', 'About Jaeng']) {
      expect(root.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
    }
  });
});
describe('MapPage plan 6: filters and search', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reloads with the chosen categories and without fixed reports, after the debounce', async () => {
    vi.useFakeTimers();
    const { inBbox } = await setup();
    const f = TestBed.inject(FilterState);
    f.toggleCategory('flood');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(300);
    expect(inBbox).toHaveBeenLastCalledWith([97, 5, 106, 21], expect.objectContaining({ categories: ['flood'] }));
    f.showResolved.set(false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(300);
    expect(inBbox).toHaveBeenLastCalledWith([97, 5, 106, 21], expect.objectContaining({ statuses: ['open', 'fix_claimed'] }));
  });

  it('fits a place with a box, flies to one without, and opens a report like a link', async () => {
    const { fixture, map, navigate } = await setup();
    const page = fixture.componentInstance;
    page.flyToPlace({ name: 'อ.เมือง', detail: null, lng: 99, lat: 18.8, bbox: [98.9, 18.7, 99.1, 18.9], source: 'local' });
    expect(map.fitBounds).toHaveBeenCalledWith([98.9, 18.7, 99.1, 18.9], { padding: 48, maxZoom: 14, ...FIT });
    page.flyToPlace({ name: 'ท่าแพ', detail: null, lng: 98.99, lat: 18.79, bbox: null, source: 'osm' });
    expect(map.flyTo).toHaveBeenCalledWith({ center: [98.99, 18.79], zoom: 13, ...FLY });
    page.openReport({ id: 'r9' } as never);
    expect(navigate).toHaveBeenCalledWith(['/r', 'r9']);
  });

  it('puts the search field in the side panel before the chips on a wide screen, a pill in the top bar on a phone', async () => {
    const wide = await setup();
    const order = [...wide.root.querySelectorAll('.side .search-row app-search-box, .side app-filter-bar')].map((e) =>
      e.tagName.toLowerCase(),
    );
    expect(order).toEqual(['app-search-box', 'app-filter-bar']);
    TestBed.resetTestingModule();
    const phone = await setup(undefined, { wide: false });
    expect(phone.root.querySelector('.bar app-search-box button.search-pill[aria-label="ค้นหา"]')).not.toBeNull();
  });
});

describe('MapPage accessibility (plan 6)', () => {
  afterEach(() => vi.restoreAllMocks());
  it('has one h1 and no unnamed button, wide and narrow', async () => {
    expectAccessiblePage((await setup()).root);
    TestBed.resetTestingModule();
    expectAccessiblePage((await setup(undefined, { wide: false })).root);
  });

  it('keeps the phone summary pill named when the numbers fail', async () => {
    vi.useFakeTimers();
    const { map, fixture, root } = await setup(undefined, { wide: false, stats: vi.fn().mockRejectedValue(new Error('x')) });
    map.fire('moveend');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(root.querySelector('.summary button.open-list')?.textContent?.trim()).toBe('ดูเป็นรายการ');
    expectAccessiblePage(root);
    vi.useRealTimers();
  });
});
