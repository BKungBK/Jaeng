import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { DangerLevel, LEVELS } from '@jaeng/shared/levels';
import type maplibregl from 'maplibre-gl';
import { categoryIconUrl } from './beacon';
import type { BeaconLayer } from './beacon-layer';
import { emojiUrl } from './emoji';
import { FilterBarComponent } from './filter-bar.component';
import { MAP_FACTORY } from './map-factory';
import { REPORT_SOURCE, setupMapLayers, tintBaseMap } from './map-style';
import { coverPhotoUrl, ReportProps, STATUS_TH, toBbox } from './report';
import { ReportsLoader } from './reports-loader';
import { ReportsService } from './reports.service';
import { toyOpacity, zoomHint } from './toy';
import type { ToyOverlay } from './toy-overlay';

const LOAD_DEBOUNCE_MS = 300;

// The home map (spec 3.2–3.4). Plan 3 replaces the peek card with the full detail panel.
@Component({
  selector: 'app-map',
  templateUrl: 'map.page.html',
  styleUrls: ['map.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterBarComponent, NgTemplateOutlet],
  host: { class: 'ion-page', '(document:keydown.escape)': 'selected.set(null)' },
})
export class MapPage {
  private createMap = inject(MAP_FACTORY);
  private reports = inject(ReportsService);
  private loader = new ReportsLoader((bbox, levels) => this.reports.inBbox(bbox, levels));
  private container = viewChild.required<ElementRef<HTMLElement>>('map');

  private map?: maplibregl.Map;
  private beacons?: BeaconLayer;
  private toy?: ToyOverlay;
  private loadTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly levels = signal<readonly DangerLevel[]>([0, 1, 2, 3]);
  readonly zoom = signal(5);
  readonly shown = signal<number | null>(null);
  readonly hover = signal<{ p: ReportProps; x: number; y: number } | null>(null);
  readonly selected = signal<ReportProps | null>(null);
  readonly toast = signal<string | null>(null);

  readonly hint = computed(() => zoomHint(this.zoom(), this.shown() ?? 1, this.levels().length));
  readonly compassOpacity = computed(() => toyOpacity(this.zoom()));
  protected readonly compassUrl = emojiUrl('compass');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => this.start());
    destroyRef.onDestroy(() => {
      clearTimeout(this.loadTimer);
      clearTimeout(this.toastTimer);
      this.beacons?.destroy();
      this.toy?.destroy();
      this.map?.remove();
    });
  }

  private async start() {
    const map = await this.createMap(this.container().nativeElement);
    this.map = map;
    // dev builds expose the map for manual checks and E2E (window.__map)
    if (isDevMode()) (window as unknown as { __map: maplibregl.Map }).__map = map;
    map.on('load', () => void this.onLoad(map));
    map.on('moveend', () => this.scheduleLoad());
    map.on('zoom', () => this.zoom.set(map.getZoom()));
    map.on('movestart', () => this.hover.set(null));
    this.zoom.set(map.getZoom());
  }

  private async onLoad(map: maplibregl.Map) {
    tintBaseMap(map);
    const [provinces, land, mask] = await Promise.all(
      ['provinces', 'land', 'mask'].map((n) => fetch(`assets/geo/${n}.json`).then((r) => r.json())),
    );
    const sea = getComputedStyle(document.documentElement).getPropertyValue('--sea').trim() || undefined;
    await setupMapLayers(map, { provinces, land, mask }, sea);
    // these two construct maplibregl.Marker, so they load with MapLibre, not with the page
    const [{ ToyOverlay }, { BeaconLayer }] = await Promise.all([import('./toy-overlay'), import('./beacon-layer')]);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.toy = new ToyOverlay(map, reduced);
    this.beacons = new BeaconLayer(map, {
      hover: (p, el) => {
        const r = el.getBoundingClientRect();
        this.hover.set({ p, x: Math.min(innerWidth - 256, r.right + 10), y: Math.max(76, r.top) });
      },
      leave: () => this.hover.set(null),
      select: (p) => {
        this.hover.set(null);
        this.selected.set(p);
      },
    });
    this.scheduleLoad(0);
  }

  scheduleLoad(delay = LOAD_DEBOUNCE_MS) {
    clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => void this.load(), delay);
  }

  private async load() {
    const map = this.map;
    if (!map) return;
    const b = map.getBounds();
    const bbox = toBbox({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    const result = await this.loader.load(bbox, this.levels());
    if (!result) return;
    if ('error' in result) {
      this.showToast('โหลดข้อมูลไม่สำเร็จ ลองเลื่อนแผนที่อีกครั้งนะ');
      return;
    }
    this.shown.set(result.data.features.length);
    map.getSource<maplibregl.GeoJSONSource>(REPORT_SOURCE)?.setData(result.data);
  }

  private showToast(message: string) {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
  }

  zoomIn() {
    this.map?.zoomIn();
  }

  zoomOut() {
    this.map?.zoomOut();
  }

  locate() {
    if (!('geolocation' in navigator)) {
      this.showToast('เครื่องนี้ยังหาตำแหน่งไม่ได้ ลองซูมไปเองก่อนนะ');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this.map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 }),
      () => this.showToast('เปิดสิทธิ์ตำแหน่งก่อนนะ แล้วลองใหม่อีกครั้ง'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // template helpers
  protected level = (p: ReportProps) => LEVELS[p.danger_level];
  protected status = (p: ReportProps) => STATUS_TH[p.status];
  protected icon = (p: ReportProps) => categoryIconUrl(p.category);
  protected photo = (p: ReportProps) => (p.cover_photo_path ? coverPhotoUrl(p.cover_photo_path) : null);
}
