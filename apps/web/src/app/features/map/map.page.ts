import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  isDevMode,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { IonModal } from '@ionic/angular';
import { LEVELS } from '@jaeng/shared/levels';
import type { Place } from '@jaeng/shared/places';
import { BACK_PRIORITY, BackButtonService } from '../../core/back-button.service';
import { DeviceService } from '../../core/device.service';
import { FilterState, type ReportFilter } from '../../core/filter-state.service';
import type { FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';
import { I18nService, type Said } from '../../core/i18n.service';
import { MapViewService } from '../../core/map-view.service';
import { FIT, FLY, leave, unleave } from '../../core/motion';
import type { MessageKey } from '../../i18n/keys';
import { LanguageToggleComponent } from '../../shared/language-toggle.component';
import { RealtimeService } from '../../core/realtime.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { AccountButtonComponent } from '../auth/account-button.component';
import type { ReportDetail } from '../report-detail/report-detail';
import { ReportDetailComponent } from '../report-detail/report-detail.component';
import { ReportFabComponent } from '../report-new/report-fab.component';
import { categoryIcon } from './beacon';
import type { BeaconLayer } from './beacon-layer';
import { FilterBarComponent } from './filter-bar.component';
import { LevelShapeComponent } from './level-shape';
import { fitPadding, MAP_FACTORY, THAILAND_BOUNDS } from './map-factory';
import { holdBaseLabels, labelBaseMap, REPORT_SOURCE, setupReportLayers, setupToyLayers, tintBaseMap } from './map-style';
import { currentSeaTheme, SEA_HEX, SeaTheme, watchSeaTheme } from './sea/sea-palette';
import { Bbox, coverPhotoUrl, ReportProps, toBbox } from './report';
import { ReportsLoader } from './reports-loader';
import { ReportsService } from './reports.service';
import { StatsLineComponent, type StatsState } from './stats-line.component';
import { StatsService } from './stats.service';
import { SearchBoxComponent } from './search-box.component';
import { topReports } from './top-reports';
import { toyOpacity, zoomHint } from './toy';

const LOAD_DEBOUNCE_MS = 300;
/** A linked report opens at street level at least (spec 3.4). */
const DETAIL_ZOOM = 15;
/** Room the right panel takes: 380 px plus its two 20 px gutters. */
const PANEL_SPACE = 420;
const WIDE = '(min-width: 820px)';
/** Room for the side panel, the detail panel and ~440 px of map between them (plan 6b decision 8). */
const ROOMY = '(min-width: 1180px)';
/** How many reports the side panel lists. */
const IN_VIEW = 3;
/** Ionic's dismiss roles for the reader closing the sheet: a drag ('gesture'), the backdrop or Escape.
 *  A drag allowed by `canDismiss` then dismisses with 'handler'. */
const SHEET_CLOSE_ROLES = new Set(['gesture', 'backdrop']);
const TOAST_MS = 3200;
/** The wide panel slides out 16 px sideways while it fades (plan 8). */
const PANEL_LEAVE_MS = 200;
/** How the wide panel leaves (an injection point so a test can hold the exit open). */
export const PANEL_EXIT = new InjectionToken<(el: HTMLElement, ms: number, to: { x?: number; y?: number }) => Promise<void>>('PANEL_EXIT', {
  providedIn: 'root',
  factory: () => leave,
});
/** A toast with a button stays long enough to reach the button. */
const ACTION_TOAST_MS = 8000;

export type Toast = { said: Said; action?: { label: MessageKey; run: () => void } };

/** The map centre that shows `target` at `offset` px from the middle of the view at `zoom` (Web Mercator,
 *  512 px tiles; close enough to the globe at street zoom). */
export function centerFor(target: [number, number], zoom: number, offset: [number, number]): [number, number] {
  const world = 512 * 2 ** zoom;
  const x = ((target[0] + 180) / 360) * world - offset[0];
  const lat = (target[1] * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2) * world - offset[1];
  const lng = (x / world) * 360 - 180;
  const lat2 = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world))) * 180) / Math.PI;
  return [lng, lat2];
}

// The home map (spec 3.2–3.4) with the report detail as a right panel (≥ 820 px) or a bottom sheet.
@Component({
  selector: 'app-map',
  templateUrl: 'map.page.html',
  styleUrls: ['map.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FilterBarComponent,
    NgTemplateOutlet,
    LevelShapeComponent,
    IconComponent,
    AccountButtonComponent,
    ReportDetailComponent,
    ReportFabComponent,
    IonModal,
    TPipe,
    StatsLineComponent,
    LanguageToggleComponent,
    SearchBoxComponent,
  ],
  host: {
    class: 'ion-page',
    '[class.with-panel]': 'panelOpen()',
    '[class.sheet-open]': '!wide() && !!id()',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class MapPage {
  private createMap = inject(MAP_FACTORY);
  private reports = inject(ReportsService);
  private statsSvc = inject(StatsService);
  private view = inject(MapViewService);
  private statsSeq = 0;
  private loader = new ReportsLoader<ReportFilter>((bbox, f) => this.reports.inBbox(bbox, f));
  protected readonly filters = inject(FilterState);
  private container = viewChild.required<ElementRef<HTMLElement>>('map');

  private map?: maplibregl.Map;
  private beacons?: BeaconLayer;
  private stopSea?: () => void;
  private stopTheme?: () => void;
  private stopWords?: () => void;
  private loadTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  private router = inject(Router);
  private device = inject(DeviceService);
  private backButton = inject(BackButtonService);
  private releaseBack?: () => void;
  protected readonly i18n = inject(I18nService);
  /** The beacon last clicked here, so its own navigation is not treated as a link. */
  private clicked: ReportProps | null = null;
  private fromClick = false;
  private pendingFly: ReportDetail | null = null;
  /** The id this page is already closing, so the sheet's didDismiss does not navigate twice. */
  private closing?: string;

  /** Bound from the route (`/r/:id`); undefined on `/`. */
  readonly id = input<string>();
  /** the phone search card is open: the brand and chips step aside */
  readonly searching = signal(false);
  readonly zoom = signal(5);
  readonly shown = signal<number | null>(null);
  readonly hover = signal<{ p: ReportProps; x: number; y: number } | null>(null);
  readonly toast = signal<Toast | null>(null);
  /** the month numbers of the loaded view (hint card) */
  readonly stats = signal<StatsState>('loading');
  /** One breakpoint (DESIGN.md Layout): the right panel from 820 px, the bottom sheet below. */
  readonly wide = signal(false);
  readonly panelOpen = computed(() => this.wide() && !!this.id());
  /** wide enough for both panels side by side */
  private readonly roomy = signal(false);
  /** the detail panel is open on a screen under 1180 px: the side panel folds to its search row */
  readonly sideCompact = computed(() => this.panelOpen() && !this.roomy());
  /** the side panel's top reports of the loaded view, and how many the view holds */
  readonly inView = signal<ReportProps[]>([]);
  readonly inViewCount = signal(0);
  /** The id of the wide panel while it plays its way out (the URL is already `/`), else null. */
  readonly panelLeaving = signal<string | null>(null);
  private panelEl = viewChild<ElementRef<HTMLElement>>('panelEl');
  private exitPanel = inject(PANEL_EXIT);
  /** The wide panel keeps its report while it leaves; a report opened meanwhile takes the same panel over. */
  protected readonly panelId = linkedSignal<{ id: string | undefined; leaving: string | null }, string | undefined>({
    source: () => ({ id: this.id(), leaving: this.panelLeaving() }),
    computation: (s, prev) => s.id ?? (s.leaving ? prev?.value : undefined),
  });
  /** The sheet keeps showing its report while it slides away after the URL went back to `/`. */
  protected readonly sheetId = linkedSignal<string | undefined, string | undefined>({
    source: this.id,
    computation: (id, prev) => id ?? prev?.value,
  });

  readonly hint = computed(() => zoomHint(this.zoom(), this.shown() ?? 1, this.filters.levels().length, (k) => this.i18n.t(k)));
  /** The hint shows only when it reports a state (every level off, nothing here); zoom tips stay for
   *  screen readers (plan 6b decision 6). */
  readonly hintIsState = computed(() => this.filters.levels().length === 0 || this.shown() === 0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    for (const [query, flag] of [
      [WIDE, this.wide],
      [ROOMY, this.roomy],
    ] as const) {
      const media = matchMedia(query);
      flag.set(media.matches);
      const onMedia = (e: MediaQueryListEvent) => flag.set(e.matches);
      media.addEventListener('change', onMedia);
      destroyRef.onDestroy(() => media.removeEventListener('change', onMedia));
    }
    effect(() => {
      const id = this.id();
      untracked(() => this.follow(id));
    });
    // a filter change (here or on /list) reloads the view through the usual debounce; not on the first run
    let seenFilter: string | undefined;
    effect(() => {
      const key = JSON.stringify(this.filters.filter());
      if (seenFilter !== undefined && key !== seenFilter) untracked(() => this.scheduleLoad());
      seenFilter = key;
    });
    // every live signal re-runs the debounced bbox load, so a burst becomes one request
    destroyRef.onDestroy(inject(RealtimeService).listen(() => this.scheduleLoad()));
    // a page that sends the reader here can leave a word for them ("ขอบคุณนะ นับให้แล้ว" after a merge);
    // only for that navigation itself, not when Back/Forward lands on the same history entry later
    let trigger: NavigationStart['navigationTrigger'];
    const nav = this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) trigger = e.navigationTrigger;
      else if (e instanceof NavigationEnd && trigger === 'imperative') {
        const toast = (history.state as { toast?: unknown } | null)?.toast;
        if (typeof toast === 'string') this.showToast(toast); // a dictionary key
      }
    });
    destroyRef.onDestroy(() => nav.unsubscribe());
    afterNextRender(() => void this.start());
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.releaseBack?.();
      clearTimeout(this.loadTimer);
      clearTimeout(this.toastTimer);
      this.beacons?.destroy();
      this.stopSea?.();
      this.stopTheme?.();
      this.stopWords?.();
      this.map?.remove();
    });
  }

  /** The route's report changed. A click on this page already shows the place; anything else
   *  (a shared link, Back/Forward) flies there once the panel has loaded the report. */
  private follow(id: string | undefined) {
    this.beacons?.setSelected(id ?? null);
    this.fromClick = !!id && this.clicked?.id === id;
    this.pendingFly = null;
    if (id !== this.closing) this.closing = undefined;
    // another report was opened while the panel was still leaving: it stays, shown again at once
    if (id && this.panelLeaving()) {
      this.panelLeaving.set(null);
      const el = this.panelEl()?.nativeElement;
      if (el) unleave(el);
    }
  }

  /** The panel loaded its report (`loaded`). */
  protected onLoaded(d: ReportDetail) {
    if (d.id !== this.id() || this.fromClick) return;
    this.pendingFly = d;
    this.flyPending();
  }

  private flyPending() {
    const d = this.pendingFly;
    if (!d || !this.map) return;
    this.pendingFly = null;
    // land the report in the map that stays visible: left of the panel, or above the 64% sheet.
    // MapLibre 5's flyTo ignores `offset`, and `padding` would stick to the map afterwards.
    const zoom = Math.max(this.map.getZoom(), DETAIL_ZOOM);
    // phones: the beam's foot just above the sheet's 64% edge, so the disc above it stays in view
    const offset: [number, number] = this.wide() ? [-PANEL_SPACE / 2, 0] : [0, -Math.round(innerHeight * 0.14 + 32)];
    this.map.flyTo({ center: centerFor([d.lng, d.lat], zoom, offset), zoom, ...FLY });
  }

  /** The linked report is not public (or never existed): say so and go home. The panel may name why (an admin hid it). */
  protected onMissing(message?: Said | void) {
    this.closing = this.id();
    this.clicked = null;
    this.beacons?.setSelected(null);
    this.showToast(message || 'map.toast.missing');
    void this.router.navigate(['/'], { replaceUrl: true });
  }

  /** Escape closes the panel, unless another overlay (the login sheet, the account menu) is on top. */
  protected onEscape() {
    const others = document.querySelectorAll('ion-modal:not(.detail-sheet), ion-popover, ion-alert');
    if ([...others].some((o) => !o.classList.contains('overlay-hidden'))) return;
    this.close();
  }

  private async start() {
    const map = await this.createMap(this.container().nativeElement);
    if (this.destroyed) {
      map.remove(); // the page left while MapLibre was still loading
      return;
    }
    this.map = map;
    this.flyPending(); // a deep link that loaded before the map did
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
    labelBaseMap(map, this.i18n.locale());
    this.stopWords = this.i18n.watch((l) => labelBaseMap(map, l));
    setupReportLayers(map);
    // start with the attribution folded to its info button at every width (plan 6b: a faint ⓘ, as in
    // the comps); a press unfolds the credits
    map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
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
          const right = innerWidth - (this.panelOpen() ? PANEL_SPACE : 0) - 256; // keep clear of the panel
          this.hover.set({ p, x: Math.min(right, r.right + 10), y: Math.max(76, r.top) });
        },
        leave: () => this.hover.set(null),
        select: (p) => this.select(p),
      }, this.i18n);
      this.beacons.setSelected(this.id() ?? null);
    } catch {
      if (!this.destroyed) this.showToast('map.toast.beaconsFailed', { label: 'common.retry', run: () => location.reload() });
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
      void this.startSea(map, mask);
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
  private async startSea(map: maplibregl.Map, mask: FeatureCollection) {
    try {
      const { startSea } = await import('./sea/start-sea');
      if (this.destroyed) return;
      const stop = await startSea(map, mask);
      if (this.destroyed) stop();
      else this.stopSea = stop;
    } catch (e) {
      console.warn('animated sea unavailable', e);
    }
  }

  /** A beacon was chosen: the URL is the state, the `id` effect does the rest. */
  select(p: ReportProps) {
    this.hover.set(null);
    this.clicked = p;
    void this.router.navigate(['/r', p.id]);
  }

  /** The sheet ends the report only when the reader closes it: a drag to 0 (Ionic asks with 'gesture'),
   *  the backdrop at full height or Escape ('backdrop'), or this page closing it (the close button,
   *  Back, a missing report). Ionic may dismiss it on its own while another overlay (the account
   *  menu, the login sheet) opens over it, with no role; that would close the report the reader is in.
   *  'parent-removed' (this page went away) always passes, so no orphaned sheet stays behind. */
  protected readonly sheetCanDismiss = async (_data?: unknown, role?: string) => {
    const id = this.id();
    return !id || this.closing === id || SHEET_CLOSE_ROLES.has(role ?? '') || role === 'parent-removed';
  };

  /** `didDismiss` after a dismissal `sheetCanDismiss` allowed: navigate only for the reader's own close. */
  protected onSheetDismissed(e: Event) {
    const role = (e as CustomEvent<{ role?: string } | undefined>).detail?.role;
    if (role === 'handler' || SHEET_CLOSE_ROLES.has(role ?? '')) this.close();
  }

  /** Ionic calls these as the page comes and goes in its stack; the Android back button is the page's only while it shows. */
  ionViewDidEnter() {
    this.releaseBack?.();
    this.releaseBack = this.backButton.on(BACK_PRIORITY.panel, (next) => this.onHardwareBack(next));
  }

  ionViewWillLeave() {
    this.releaseBack?.();
    this.releaseBack = undefined;
  }

  /** The Android back button closes the wide detail panel. On a phone the report is a sheet, an Ionic
   *  overlay: it takes the button first (priority 100) and its dismissal runs `close()` through `onSheetDismissed`. */
  onHardwareBack(next: () => void): void {
    if (this.wide() && this.id()) this.close();
    else next();
  }

  /** Close the panel or sheet; focus goes back to the report's disc once the URL is `/` again. */
  close() {
    const id = this.id();
    if (!id || this.closing === id) return; // the sheet's didDismiss follows our own close
    this.closing = id;
    this.clicked = null; // Back to /r/:id later is a link, not this click
    this.beacons?.setSelected(null);
    void this.leavePanel(id);
    void this.router.navigate(['/']).then((ok) => {
      if (this.destroyed) return;
      if (!ok) {
        this.closing = undefined; // the navigation did not happen: the report is still open and can be closed again
        return;
      }
      if (this.beacons?.focus(id)) return;
      this.map?.getCanvas().focus();
    });
  }

  /** The wide panel plays its exit while the URL is already back at `/`; the sheet has Ionic's own. */
  private async leavePanel(id: string) {
    const el = this.panelEl()?.nativeElement;
    if (!this.wide() || !el) return;
    this.panelLeaving.set(id);
    await this.exitPanel(el, PANEL_LEAVE_MS, { x: 16 });
    if (this.panelLeaving() === id) this.panelLeaving.set(null); // done: the panel is gone with the id
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
    const c = map.getCenter();
    this.view.set(bbox, [c.lng, c.lat]);
    void this.loadStats(bbox);
    const result = await this.loader.load(bbox, this.filters.filter());
    if (!result || this.destroyed) return;
    if ('error' in result) {
      this.showToast('map.toast.loadFailed', { label: 'common.retry', run: () => this.scheduleLoad(0) });
      return;
    }
    const props = result.data.features.map((f) => f.properties);
    this.shown.set(props.length);
    this.inView.set(topReports(props, IN_VIEW));
    this.inViewCount.set(props.length);
    map.getSource<maplibregl.GeoJSONSource>(REPORT_SOURCE)?.setData(result.data);
  }

  /** Encouragement, not data: a failure hides the line, the old numbers stay until new ones come. */
  private async loadStats(bbox: Bbox) {
    const seq = ++this.statsSeq;
    try {
      const s = await this.statsSvc.inBbox(bbox);
      if (seq === this.statsSeq && !this.destroyed) this.stats.set(s);
    } catch {
      if (seq === this.statsSeq && !this.destroyed) this.stats.set('error');
    }
  }

  private showToast(said: Said, action?: Toast['action']) {
    this.toast.set({ said, action });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), action ? ACTION_TOAST_MS : TOAST_MS);
  }

  protected runToast(t: Toast) {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
    t.action?.run();
  }

  /** Back to the whole country: the same view the app opens with. */
  home() {
    const map = this.map;
    if (!map) return;
    map.fitBounds(THAILAND_BOUNDS, { padding: fitPadding(map.getContainer().clientWidth), ...FIT });
  }

  /** A place from the search: its own box when it has one (not closer than street level), else its point. */
  flyToPlace(p: Place) {
    const map = this.map;
    if (!map) return;
    if (p.bbox) map.fitBounds(p.bbox, { padding: 48, maxZoom: 14, ...FIT });
    else map.flyTo({ center: [p.lng, p.lat], zoom: 13, ...FLY });
  }

  /** A report from the search opens like a shared link: the panel loads it and the map flies there. */
  openReport(p: ReportProps) {
    this.hover.set(null);
    this.clicked = null;
    void this.router.navigate(['/r', p.id]);
  }

  openList() {
    void this.router.navigate(['/list']);
  }

  openAbout() {
    void this.router.navigate(['/about']);
  }

  /** The skip link: a real link for screen readers and new tabs, routed in place on a plain click. */
  protected skipToList(e: MouseEvent) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    this.openList();
  }

  zoomIn() {
    this.map?.zoomIn();
  }

  zoomOut() {
    this.map?.zoomOut();
  }

  async locate() {
    const here = await this.device.currentPosition(10000);
    if (!here) return this.showToast('map.toast.geoDenied');
    this.map?.flyTo({ center: [here.lng, here.lat], zoom: 14, ...FLY });
  }

  // template helpers
  protected level = (p: ReportProps) => LEVELS[p.danger_level];
  protected status = (p: ReportProps) => this.i18n.t(`status.${p.status}`);
  protected icon = (p: ReportProps) => categoryIcon(p.category);
  protected photo = (p: ReportProps) => (p.cover_photo_path ? coverPhotoUrl(p.cover_photo_path) : null);
}
