import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, output, signal } from '@angular/core';
import type { CategoryInfo } from '../../core/categories.service';
import { CategoriesService } from '../../core/categories.service';
import { FilterState } from '../../core/filter-state.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { TickComponent } from '../../shared/tick.component';
import { isIconName, type IconName } from './icons';

let nextId = 0;

/**
 * "More filters" (handoff): categories and whether fixed reports show. Changes apply at once; the
 * map reloads through its own debounce. A popover under the button from 820 px, a bottom card below.
 */
@Component({
  selector: 'app-filters-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent, TickComponent],
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section
      class="panel"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="id"
      (keydown.escape)="$event.stopPropagation(); closed.emit()"
      (keydown.tab)="trap($event)"
      (keydown.shift.tab)="trap($event)"
    >
      <h2 [id]="id" tabindex="-1">{{ 'filters.button' | t }}</h2>
      <div role="group" [attr.aria-labelledby]="id + '-cats'">
        <p class="label" [id]="id + '-cats'">{{ 'filters.categories' | t }}</p>
        <p class="caption">{{ 'filters.allHint' | t }}</p>
        <div class="cats">
          @for (c of categories(); track c.slug) {
            @let on = filters.categories().includes(c.slug);
            <button type="button" class="cat" [attr.aria-pressed]="on" (click)="filters.toggleCategory(c.slug)">
              <app-icon [name]="icon(c)" [size]="20" />
              <span>{{ svc.labelOf(c) }}</span>
              @if (on) {
                <app-tick class="tick" [size]="16" />
              }
            </button>
          }
        </div>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          [checked]="filters.showResolved()"
          (change)="filters.showResolved.set($any($event.target).checked)"
        />
        <span class="track" aria-hidden="true"></span>
        {{ 'filters.showResolved' | t }}
      </label>
      <div class="row">
        <button type="button" class="btn" (click)="filters.clearExtra()">{{ 'filters.clear' | t }}</button>
        <button type="button" class="btn primary" (click)="closed.emit()">{{ 'filters.done' | t }}</button>
      </div>
    </section>
  `,
  styleUrl: 'filters-panel.component.scss',
})
export class FiltersPanelComponent {
  protected readonly filters = inject(FilterState);
  protected readonly svc = inject(CategoriesService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly closed = output<void>();
  protected readonly id = `filters-${++nextId}`;
  protected readonly categories = signal<CategoryInfo[]>([]);

  constructor() {
    void this.svc
      .list()
      .then((c) => this.categories.set(c))
      .catch(() => undefined);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('h2')?.focus());
  }

  /** The panel is modal: Tab and Shift+Tab go round inside it instead of out to the map behind. */
  protected trap(e: Event) {
    const ke = e as KeyboardEvent;
    const items = [...this.host.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // from the title (focused by script, tabindex -1) Tab goes to the first control, Shift+Tab to the last
    if (ke.shiftKey && (active === first || active === this.host.nativeElement.querySelector('h2'))) {
      ke.preventDefault();
      last.focus();
    } else if (!ke.shiftKey && active === last) {
      ke.preventDefault();
      first.focus();
    }
  }

  protected icon(c: CategoryInfo): IconName {
    return isIconName(c.icon) ? c.icon : 'mapPin';
  }
}
