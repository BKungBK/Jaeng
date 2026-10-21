import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LEVELS } from '@jaeng/shared/levels';
import type { Place } from '@jaeng/shared/places';
import { PLACE_QUERY_MIN } from '@jaeng/shared/places';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { categoryIcon } from './beacon';
import { LevelShapeComponent } from './level-shape';
import { PlacesService } from './places.service';
import type { ReportProps } from './report';
import { ReportsService } from './reports.service';

export const SEARCH_DEBOUNCE_MS = 300;

type State = 'idle' | 'loading' | 'ready' | 'failed';
type Option = { kind: 'place'; place: Place } | { kind: 'more' } | { kind: 'report'; report: ReportProps };
/** OpenStreetMap: not asked yet (typing asks only our districts), on its way, or answered */
type More = 'idle' | 'loading' | 'done';

let nextId = 0;

/**
 * Search reports and places (spec 3.9): an ARIA 1.2 combobox. A field from 820 px; below it a pill
 * showing the field's text that opens a full-width glass card over the top of the map (`collapsed`). Choosing a place flies the map
 * there; choosing a report opens it. Answers for an older query are dropped. OpenStreetMap is asked only
 * from the "search more places" row or Enter with no row chosen (its policy forbids auto-complete).
 */
@Component({
  selector: 'app-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent, LevelShapeComponent],
  templateUrl: 'search-box.component.html',
  styleUrl: 'search-box.component.scss',
  host: { '[class.open]': 'cardOpen()' },
})
export class SearchBoxComponent {
  private placesSvc = inject(PlacesService);
  private reportsSvc = inject(ReportsService);
  protected readonly i18n = inject(I18nService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** phones: an icon button until pressed */
  readonly collapsed = input(false);
  readonly place = output<Place>();
  readonly report = output<ReportProps>();
  /** the phone card opened or closed (the map hides its top group meanwhile) */
  readonly opened = output<boolean>();

  protected readonly id = `search-${++nextId}`;
  protected readonly q = signal('');
  protected readonly state = signal<State>('idle');
  protected readonly places = signal<Place[]>([]);
  protected readonly reports = signal<ReportProps[]>([]);
  protected readonly online = signal(true);
  protected readonly more = signal<More>('idle');
  protected readonly resultsOpen = signal(false);
  protected readonly active = signal(-1);
  protected readonly cardOpen = signal(false);

  protected readonly showField = computed(() => !this.collapsed() || this.cardOpen());
  protected readonly options = computed<Option[]>(() => [
    ...this.places().map((place): Option => ({ kind: 'place', place })),
    ...(this.state() === 'ready' && this.more() === 'idle' ? [{ kind: 'more' } as Option] : []),
    ...this.reports().map((report): Option => ({ kind: 'report', report })),
  ]);
  protected readonly expanded = computed(() => this.resultsOpen() && this.state() !== 'idle');
  protected readonly activeId = computed(() =>
    this.expanded() && this.active() >= 0 ? `${this.id}-opt-${this.active()}` : null,
  );

  private timer?: ReturnType<typeof setTimeout>;
  private seq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected openCard() {
    this.cardOpen.set(true);
    this.opened.emit(true);
    setTimeout(() => this.field()?.focus());
  }

  protected closeCard() {
    this.reset();
    this.cardOpen.set(false);
    this.opened.emit(false);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.search-pill')?.focus());
  }

  protected onInput(e: Event) {
    this.q.set((e.target as HTMLInputElement).value);
    this.schedule();
  }

  private schedule() {
    clearTimeout(this.timer);
    this.seq++; // whatever is in flight now answers an older query
    this.more.set('idle');
    if (this.q().trim().length < PLACE_QUERY_MIN) {
      this.state.set('idle');
      this.places.set([]);
      this.reports.set([]);
      this.active.set(-1);
      return;
    }
    this.timer = setTimeout(() => void this.run(), SEARCH_DEBOUNCE_MS);
  }

  protected async run() {
    const seq = ++this.seq;
    const q = this.q().trim();
    this.more.set('idle');
    this.state.set('loading');
    this.resultsOpen.set(true);
    const [p, r] = await Promise.allSettled([this.placesSvc.search(q, this.i18n.locale(), false), this.reportsSvc.search(q)]);
    if (seq !== this.seq) return;
    if (p.status === 'rejected' && r.status === 'rejected') {
      this.state.set('failed');
      return;
    }
    this.places.set(p.status === 'fulfilled' ? p.value.places : []);
    this.online.set(p.status === 'fulfilled' ? p.value.online : false);
    this.reports.set(r.status === 'fulfilled' ? r.value : []);
    this.active.set(-1);
    this.state.set('ready');
  }

  /** Our districts plus OpenStreetMap for the same query; the reports stay on screen meanwhile. */
  protected async askMore() {
    const seq = this.seq;
    const q = this.q().trim();
    this.more.set('loading');
    this.active.set(-1);
    let answer: { places: Place[]; online: boolean };
    try {
      answer = await this.placesSvc.search(q, this.i18n.locale(), true);
    } catch {
      answer = { places: this.places(), online: false };
    }
    if (seq !== this.seq) return;
    this.places.set(answer.places);
    this.online.set(answer.online);
    this.more.set('done');
  }

  protected onKey(e: KeyboardEvent) {
    const n = this.options().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!n) return;
      e.preventDefault();
      this.resultsOpen.set(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      this.active.set((this.active() + step + n) % n);
    } else if (e.key === 'Enter') {
      const o = this.options()[this.active()];
      if (this.expanded() && o) {
        e.preventDefault();
        this.choose(o);
      } else if (this.state() === 'ready' && this.more() === 'idle') {
        e.preventDefault();
        void this.askMore();
      }
    } else if (e.key === 'Escape') {
      // three steps: close the results, clear the field, close the phone card
      e.stopPropagation();
      if (this.expanded()) this.resultsOpen.set(false);
      else if (this.q()) {
        this.q.set('');
        this.schedule();
      } else if (this.collapsed() && this.cardOpen()) this.closeCard();
    }
  }

  protected choose(o: Option) {
    if (o.kind === 'more') {
      void this.askMore();
      return;
    }
    this.resultsOpen.set(false);
    this.active.set(-1);
    if (o.kind === 'place') this.place.emit(o.place);
    else this.report.emit(o.report);
    if (this.collapsed()) this.closeCard();
  }

  private reset() {
    clearTimeout(this.timer);
    this.seq++;
    this.q.set('');
    this.state.set('idle');
    this.more.set('idle');
    this.places.set([]);
    this.reports.set([]);
    this.resultsOpen.set(false);
    this.active.set(-1);
  }

  private field() {
    return this.host.nativeElement.querySelector<HTMLInputElement>('input');
  }

  // template helpers
  protected optionId = (i: number) => `${this.id}-opt-${i}`;
  protected indexOf = (o: Option) => this.options().indexOf(o);
  protected placeOptions = computed(() => this.options().filter((o) => o.kind === 'place'));
  protected moreOption = computed(() => this.options().find((o) => o.kind === 'more') ?? null);
  protected reportOptions = computed(() => this.options().filter((o) => o.kind === 'report'));
  protected level = (r: ReportProps) => LEVELS[r.danger_level];
  protected icon = (r: ReportProps) => categoryIcon(r.category);
  protected statusWord = (r: ReportProps) => this.i18n.t(`status.${r.status}`);
  protected asPlace = (o: Option) => (o.kind === 'place' ? o.place : null);
  protected asReport = (o: Option) => (o.kind === 'report' ? o.report : null);
}
