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
import type { FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';
import { IconComponent } from '../../shared/icon.component';
import { categoryIcon } from './beacon';
import type { BeaconLayer } from './beacon-layer';
import { FilterBarComponent } from './filter-bar.component';
import { LevelShapeComponent } from './level-shape';
import { MAP_FACTORY } from './map-factory';
import { holdBaseLabels, REPORT_SOURCE, setupReportLayers, setupToyLayers, tintBaseMap } from './map-style';
import { currentSeaTheme, SEA_HEX, SeaTheme, watchSeaTheme } from './sea/sea-palette';
import { coverPhotoUrl, ReportProps, STATUS_TH, toBbox } from './report';
import { ReportsLoader } from './reports-loader';
import { ReportsService } from './reports.service';
import { toyOpacity, zoomHint } from './toy';

const LOAD_DEBOUNCE_MS = 300;

// The home map (spec 3.2–3.4). Plan 3 replaces the peek card with the full detail panel.
@Component({
  selector: 'app-map',
  templateUrl: 'map.page.html',
  styleUrls: ['map.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterBarComponent, NgTemplateOutlet, LevelShapeComponent, IconComponent],
  host: { class: 'ion-page', '(document:keydown.escape)': 'closePeek()' },
})
export class MapPage {
  private createMap = inject(MAP_FACTORY);
  private reports = inject(ReportsService);
  private loader = new ReportsLoader((bbox, levels) => this.reports.inBbox(bbox, levels));
  private container = viewChild.required<ElementRef<HTMLElement>>('map');
  private closeButton = viewChild<ElementRef<HTMLButtonElement>>('close');

  private map?: maplibregl.Map;
  private beacons?: BeaconLayer;
  private stopSea?: () => void;
  private stopTheme?: () => void;
  private loadTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  readonly levels = signal<readonly DangerLevel[]>([0, 1, 2, 3]);
  readonly zoom = signal(5);
  readonly shown = signal<number | null>(null);
  readonly hover = signal<{ p: ReportProps; x: number; y: number } | null>(null);
  readonly selected = signal<ReportProps | null>(null);
  readonly toast = signal<string | null>(null);

  readonly hint = computed(() => zoomHint(this.zoom(), this.shown() ?? 1, this.levels().length));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => void this.start());
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.loadTimer);
      clearTimeout(this.toastTimer);
      this.beacons?.destroy();
      this.stopSea?.();
      this.stopTheme?.();
      this.map?.remove();
    });
  }

  private async start() {
    const map = await this.createMap(this.container().nativeElement);
    if (this.destroyed) {
      map.remove(); // the page left while MapLibre was still loading
      return;
    }
    this.map = map;
    // dev builds expose the map for manual checks and E2E (window.__map)
    if (isDevMode()) (window as unknown as { __map: maplibregl.Map }).__map = map;
    map.on('load', () => void this.onLoad(map));
    map.on('moveend', () => this.scheduleLoad());
    map.on('zoom', () => this.zoom.set(map.getZoom()));
    map.on('movestart', () => this.hover.set(null));
    this.zoom.set(map.getZoom());
  }

  /** Data first, decoration second: a missing toy asset must never cost the reports. */
  private async onLoad(map: maplibregl.Map) {
    const tint = (theme: SeaTheme) => tintBaseMap(map, theme, SEA_HEX[theme].shallow);
    tint(currentSeaTheme());
    this.stopTheme = watchSeaTheme(tint);
    holdBaseLabels(map);
    setupReportLayers(map);
    // phones: start with the attribution folded to its info button so it does not sit under the hint card
    if (innerWidth < 820) map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    this.scheduleLoad(0);
    await Promise.all([this.startBeacons(map), this.startToy(map)]);
  }

  private async startBeacons(map: maplibregl.Map) {
    try {
      // constructs maplibregl.Marker, so it loads with MapLibre, not with the page
      const { BeaconLayer } = await import('./beacon-layer');
      if (this.destroyed) return;
      this.beacons = new BeaconLayer(map, {
        hover: (p, el) => {
          const r = el.getBoundingClientRect();
          this.hover.set({ p, x: Math.min(innerWidth - 256, r.right + 10), y: Math.max(76, r.top) });
        },
        leave: () => this.hover.set(null),
        select: (p) => this.select(p),
      });
    } catch {
      if (!this.destroyed) this.showToast('แผนที่โหลดไม่ครบ ลองรีเฟรชหน้านี้อีกครั้งนะ');
    }
  }

  private async startToy(map: maplibregl.Map) {
    try {
      const [provinces, land, mask] = await Promise.all(
        ['provinces', 'land', 'mask'].map(async (n) => {
          const res = await fetch(`assets/geo/${n}.json`);
          if (!res.ok) throw new Error(`geo ${n} ${res.status}`);
          return res.json();
        }),
      );
      if (this.destroyed) return;
      const sea = getComputedStyle(document.documentElement).getPropertyValue('--sea').trim() || undefined;
      setupToyLayers(map, { provinces, land, mask }, sea);
      void this.startSea(map, mask, matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.watchProvinceHover(map);
    } catch (e) {
      // decoration only: the street map and the reports still work without it
      console.warn('toy map unavailable', e);
    }
  }
  /** Lights up the province under a mouse pointer while the toy map shows (not on touch screens). */
  private watchProvinceHover(map: maplibregl.Map) {
    if (!matchMedia('(hover: hover)').matches) return;
    let current: string | number | undefined;
    const set = (id: string | number | undefined) => {
      if (id === current) return;
      if (current !== undefined) map.setFeatureState({ source: 'toy-provinces', id: current }, { hover: false });
      current = id;
      if (id !== undefined) map.setFeatureState({ source: 'toy-provinces', id }, { hover: true });
    };
    map.on('mousemove', 'toy-land', (e) => set(toyOpacity(map.getZoom()) > 0.5 ? e.features?.[0]?.id : undefined));
    map.on('mouseleave', 'toy-land', () => set(undefined));
  }

  /** The animated cel sea over the flat mask; if it fails the flat sea stays. */
  private async startSea(map: maplibregl.Map, mask: FeatureCollection, reducedMotion: boolean) {
    try {
      const { startSea } = await import('./sea/start-sea');
      if (this.destroyed) return;
      const stop = await startSea(map, mask, reducedMotion);
      if (this.destroyed) stop();
      else this.stopSea = stop;
    } catch (e) {
      console.warn('animated sea unavailable', e);
    }
  }

  private select(p: ReportProps) {
    this.hover.set(null);
    this.markSelected(false);
    this.selected.set(p);
    this.markSelected(true);
    // move focus into the card so keyboard and screen-reader users land on it
    setTimeout(() => this.closeButton()?.nativeElement.focus());
  }

  closePeek() {
    const p = this.selected();
    if (!p) return;
    this.markSelected(false);
    this.selected.set(null);
    this.discFor(p.id)?.focus();
  }

  private discFor(id: string) {
    return this.container().nativeElement.querySelector<HTMLElement>(`.disc[data-id="${CSS.escape(id)}"]`);
  }

  private markSelected(on: boolean) {
    const p = this.selected();
    if (p) this.discFor(p.id)?.classList.toggle('selected', on);
  }

  scheduleLoad(delay = LOAD_DEBOUNCE_MS) {
    clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => void this.load(), delay);
  }

  private async load() {
    const map = this.map;
    if (!map || this.destroyed) return;
    const b = map.getBounds();
    const bbox = toBbox({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    const result = await this.loader.load(bbox, this.levels());
    if (!result || this.destroyed) return;
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
  protected icon = (p: ReportProps) => categoryIcon(p.category);
  protected photo = (p: ReportProps) => (p.cover_photo_path ? coverPhotoUrl(p.cover_photo_path) : null);
}
