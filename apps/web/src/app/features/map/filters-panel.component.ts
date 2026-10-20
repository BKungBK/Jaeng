import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, output, signal } from '@angular/core';
import type { CategoryInfo } from '../../core/categories.service';
import { CategoriesService } from '../../core/categories.service';
import { FilterState } from '../../core/filter-state.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { isIconName, type IconName } from './icons';

let nextId = 0;

/**
 * "More filters" (handoff): categories and whether fixed reports show. Changes apply at once; the
 * map reloads through its own debounce. A popover under the button from 820 px, a bottom card below.
 */
@Component({
  selector: 'app-filters-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent],
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section class="panel" role="dialog" [attr.aria-labelledby]="id" (keydown.escape)="$event.stopPropagation(); closed.emit()">
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
                <app-icon class="tick" name="check" [size]="16" />
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

  protected icon(c: CategoryInfo): IconName {
    return isIconName(c.icon) ? c.icon : 'mapPin';
  }
}
