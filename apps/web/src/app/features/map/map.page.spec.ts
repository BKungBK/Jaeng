import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PopoverController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { LoginPromptService } from '../auth/login-prompt.service';
import { MAP_FACTORY } from './map-factory';
import { MapPage } from './map.page';
import { EMPTY_COLLECTION } from './report';
import { ReportsService } from './reports.service';

// Stand-in for maplibregl.Map: records handlers and lets a test fire events.
function fakeMap() {
  const handlers: Record<string, (() => void)[]> = {};
  const sources: Record<string, unknown> = {};
  return {
    sources,
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
const authStubs = [
  { provide: AuthService, useValue: { signedIn: signal(false), profile: signal(null) } },
  { provide: LoginPromptService, useValue: { ask: vi.fn() } },
  { provide: PopoverController, useValue: { create: vi.fn() } },
];

async function setup(inBbox = vi.fn().mockResolvedValue(EMPTY_COLLECTION)) {
  const map = fakeMap();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAP_FACTORY, useValue: () => map },
      { provide: ReportsService, useValue: { inBbox } },
      ...authStubs,
    ],
  });
  const fixture = TestBed.createComponent(MapPage);
  fixture.detectChanges();
  await Promise.resolve(); // the factory result is awaited
  await Promise.resolve();
  const root = fixture.nativeElement as HTMLElement;
  return { map, fixture, root, inBbox };
}

describe('MapPage', () => {
  afterEach(() => vi.useRealTimers());

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

  it('opens the peek as a labelled dialog and closes it with Escape', async () => {
    const { fixture, root } = await setup();
    fixture.componentInstance.selected.set({
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
    });
    fixture.detectChanges();
    const peek = root.querySelector('.peek')!;
    expect(peek.getAttribute('role')).toBe('dialog');
    expect(peek.querySelector(`#${peek.getAttribute('aria-labelledby')}`)?.textContent).toBe('หลุมลึก');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(root.querySelector('.peek')).toBeNull();
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
