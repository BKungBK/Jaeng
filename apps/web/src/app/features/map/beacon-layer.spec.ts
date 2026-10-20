import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n.service';
import type { ReportProps } from './report';

vi.mock('maplibre-gl', () => {
  class Marker {
    constructor(private opts: { element: HTMLElement }) {}
    setLngLat() {
      return this;
    }
    addTo() {
      document.body.appendChild(this.opts.element);
      return this;
    }
    remove() {
      this.opts.element.remove();
    }
  }
  return { default: { Marker }, Marker };
});

import { BeaconLayer } from './beacon-layer';

const props = (id: string, status: ReportProps['status'] = 'open'): ReportProps => ({
  id,
  title: `เรื่อง ${id}`,
  category: 'road',
  icon: 'construction',
  danger_level: 1,
  status,
  confirm_count: 1,
  comment_count: 0,
  days_open: 1,
  cover_photo_path: null,
});

function setup() {
  let features: { geometry: object; properties: ReportProps }[] = [];
  const map = {
    on: vi.fn(),
    off: vi.fn(),
    getSource: () => ({}),
    isSourceLoaded: () => true,
    getZoom: () => 14,
    getBounds: () => ({ contains: () => true }),
    querySourceFeatures: () => features,
    getCenter: () => ({ lng: 0, lat: 0 }),
    getCanvas: () => ({ width: 1, height: 1 }),
  };
  const i18n = TestBed.inject(I18nService);
  const layer = new BeaconLayer(map as never, { hover: vi.fn(), leave: vi.fn(), select: vi.fn() }, i18n);
  const show = (...ps: ReportProps[]) => {
    features = ps.map((p) => ({ geometry: { type: 'Point', coordinates: [100, 13] }, properties: p }));
    layer.sync();
  };
  const disc = (id: string) => document.querySelector<HTMLElement>(`.disc[data-id="${id}"]`);
  return { layer, show, disc, i18n };
}

describe('BeaconLayer language', () => {
  afterEach(() => document.body.replaceChildren());

  it('rewords the disc in place on a switch, and focus stays on it', () => {
    const { show, disc, layer, i18n } = setup();
    show(props('a'));
    const before = disc('a')!;
    layer.focus('a');
    i18n.setLocale('en');
    expect(disc('a')).toBe(before);
    expect(before.getAttribute('aria-label')).toBe('เรื่อง a Caution level, Not fixed yet');
    expect(document.activeElement).toBe(before);
  });

  it('stops listening once destroyed', () => {
    const { show, disc, layer, i18n } = setup();
    show(props('a'));
    const d = disc('a')!;
    layer.destroy();
    i18n.setLocale('en');
    expect(d.getAttribute('aria-label')).toContain('ระดับ');
  });
});

describe('BeaconLayer selection', () => {
  afterEach(() => document.body.replaceChildren());

  it('applies a selection made before the marker exists', () => {
    const { layer, show, disc } = setup();
    layer.setSelected('a');
    show(props('a'), props('b'));
    expect(disc('a')!.classList.contains('selected')).toBe(true);
    expect(disc('b')!.classList.contains('selected')).toBe(false);
  });

  it('keeps the ring when the disc is rebuilt', () => {
    const { layer, show, disc } = setup();
    show(props('a'));
    layer.setSelected('a');
    expect(disc('a')!.classList.contains('selected')).toBe(true);
    show(props('a', 'resolved'));
    expect(disc('a')!.classList.contains('selected')).toBe(true);
  });

  it('clears every ring with null and moves it when another is chosen', () => {
    const { layer, show, disc } = setup();
    show(props('a'), props('b'));
    layer.setSelected('a');
    layer.setSelected('b');
    expect(disc('a')!.classList.contains('selected')).toBe(false);
    expect(disc('b')!.classList.contains('selected')).toBe(true);
    layer.setSelected(null);
    expect(document.querySelectorAll('.selected')).toHaveLength(0);
  });

  it('focuses a disc that has a marker and reports false otherwise', () => {
    const { layer, show, disc } = setup();
    show(props('a'));
    expect(layer.focus('a')).toBe(true);
    expect(document.activeElement).toBe(disc('a'));
    expect(layer.focus('zzz')).toBe(false);
  });
});
