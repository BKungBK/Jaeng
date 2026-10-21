import { BackdropComponent } from '../../shared/backdrop.component';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import { THAILAND_BBOX } from '@jaeng/shared/report';
import { DeviceService, type LngLat } from '../../core/device.service';
import { FilterState } from '../../core/filter-state.service';
import { I18nService, type Said } from '../../core/i18n.service';
import { MapViewService } from '../../core/map-view.service';
import { RealtimeService } from '../../core/realtime.service';
import type { MessageKey } from '../../i18n/keys';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { categoryIcon } from '../map/beacon';
import { FilterBarComponent } from '../map/filter-bar.component';
import { LevelShapeComponent } from '../map/level-shape';
import { coverPhotoUrl, type Bbox } from '../map/report';
import { STATUS_ICON } from '../me/reject-reason';
import { MapReturnService } from '../report-new/map-return.service';
import { formatDistance, LIST_PAGE, LIST_SORTS, ListService, type ListRow, type ListSort } from './list.service';

type State = 'loading' | 'ready' | 'error';

/** Live signals for the list are gathered over this window into one quiet reload. */
export const LIST_LIVE_DEBOUNCE_MS = 1000;
const LONG_WAIT_DAYS = 30;

const SORT_ICON: Partial<Record<ListSort, 'navigation'>> = { near: 'navigation' };

/**
 * `/list` (spec 3.9, handoff "/list"): the reports of the map's last view as rows, for people who
 * cannot or would rather not use the map. Shares FilterState with the map; four sorts; 50 a page.
 */
@Component({
  selector: 'app-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackdropComponent, TPipe, IconComponent, LevelShapeComponent, FilterBarComponent],
  templateUrl: 'list.page.html',
  styleUrl: 'list.page.scss',
  host: { class: 'ion-page' },
})
export class ListPage {
  private svc = inject(ListService);
  private device = inject(DeviceService);
  private back = inject(MapReturnService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly filters = inject(FilterState);
  protected readonly i18n = inject(I18nService);

  private readonly view = inject(MapViewService);
  protected readonly bbox = signal<Bbox>(this.view.bbox() ?? [...THAILAND_BBOX]);
  protected readonly whole = signal(this.view.bbox() === null);
  protected readonly sort = signal<ListSort>('new');
  protected readonly near = signal<LngLat | null>(null);
  protected readonly locating = signal(false);
  protected readonly includeOld = signal(false);
  protected readonly notice = signal<Said>(null);

  protected readonly state = signal<State>('loading');
  protected readonly rows = signal<ListRow[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly sorts = LIST_SORTS;
  protected readonly sortIcon = SORT_ICON;

  /** Bumped per request, so an answer for an older query never lands. */
  private seq = 0;
  private liveTimer?: ReturnType<typeof setTimeout>;

  protected readonly query = computed(() => {
    const f = this.filters.filter();
    return {
      bbox: this.bbox(),
      levels: f.levels,
      categories: f.categories,
      statuses: f.statuses,
      includeOld: this.filters.showResolved() && this.includeOld(),
      sort: this.sort(),
      near: this.sort() === 'near' ? this.near() : null,
    };
  });

  constructor() {
    effect(() => {
      this.query();
      untracked(() => void this.load(0));
    });
    const stop = inject(RealtimeService).listen(() => {
      clearTimeout(this.liveTimer);
      this.liveTimer = setTimeout(() => {
        // a reader who paged on keeps their place; the next filter change reloads anyway
        if (this.rows().length <= LIST_PAGE) void this.load(0, true);
      }, LIST_LIVE_DEBOUNCE_MS);
    });
    inject(DestroyRef).onDestroy(() => {
      stop();
      clearTimeout(this.liveTimer);
    });
  }

  ionViewDidEnter() {
    this.host.nativeElement.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }

  protected async load(offset: number, quiet = false) {
    const seq = ++this.seq;
    if (offset === 0 && !quiet) this.state.set('loading');
    try {
      const page = await this.svc.page({ ...this.query(), offset });
      if (seq !== this.seq) return;
      this.rows.update((have) => (offset === 0 ? page : [...have, ...page]));
      this.hasMore.set(page.length === LIST_PAGE);
      this.state.set('ready');
    } catch {
      if (seq !== this.seq || quiet) return;
      this.state.set('error');
    }
  }

  protected more() {
    void this.load(this.rows().length);
  }

  protected retry() {
    void this.load(0);
  }

  protected async choose(s: ListSort) {
    if (s === this.sort() && s !== 'near') return;
    this.notice.set(null);
    if (s !== 'near') {
      this.sort.set(s);
      return;
    }
    this.locating.set(true);
    const pos = await this.device.currentPosition();
    this.locating.set(false);
    if (!pos) {
      this.sort.set('new');
      this.notice.set('map.toast.geoDenied');
      return;
    }
    this.near.set(pos);
    this.sort.set('near');
  }

  /** Arrow keys move along the sorts and choose (one tab stop). */
  protected onSortKey(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = LIST_SORTS.indexOf(this.sort());
    const next = LIST_SORTS[(i + step + LIST_SORTS.length) % LIST_SORTS.length];
    void this.choose(next);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-sort="${next}"]`)?.focus());
  }

  protected wholeCountry() {
    this.whole.set(true);
    this.bbox.set([...THAILAND_BBOX]);
  }

  protected goBack() {
    void this.back.go();
  }

  /** A row is a real link; a plain click goes back to the map page and opens the report there. */
  protected open(r: ListRow, e: MouseEvent) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    void this.back.go(['/r', r.id]);
  }

  // template helpers
  protected sortKey = (s: ListSort): MessageKey => `list.sort.${s}`;
  protected level = (r: ListRow) => LEVELS[r.danger_level as DangerLevel] ?? LEVELS[0];
  protected icon = (r: ListRow) => categoryIcon(r.category);
  protected photo = (r: ListRow) => (r.cover_photo_path ? coverPhotoUrl(r.cover_photo_path) : null);
  protected statusWord = (r: ListRow) => this.i18n.t(`status.${r.status}`);
  protected statusIcon = (r: ListRow) => STATUS_ICON[r.status];
  protected longWait = (r: ListRow) => r.days_open > LONG_WAIT_DAYS;
  protected distance = (r: ListRow) => (r.distance_m === null ? null : formatDistance(r.distance_m, this.i18n.locale()));
}
