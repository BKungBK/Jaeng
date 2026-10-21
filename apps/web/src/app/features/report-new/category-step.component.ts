import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CategoriesService, type CategoryInfo } from '../../core/categories.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { TickComponent } from '../../shared/tick.component';
import { isIconName, type IconName } from '../map/icons';

/** Step 2: eight big category buttons. A tap is the choice: the page moves on at once (no "Next"). */
@Component({
  selector: 'app-category-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TickComponent, TPipe],
  template: `
    @if (categories(); as list) {
      <div class="grid">
        @for (c of list; track c.slug) {
          <button
            type="button"
            class="cat"
            [class.picking]="c.slug === picking()"
            [attr.aria-pressed]="c.slug === selected()"
            (click)="picked.emit(c)"
          >
            <app-icon [name]="icon(c)" [size]="32" />
            <span class="name">{{ service.labelOf(c) }}</span>
            @if (c.slug === selected()) {
              <span class="tick" aria-hidden="true"><app-tick [size]="16" [play]="c.slug === picking()" /></span>
            }
          </button>
        }
      </div>
    } @else if (failed()) {
      <p class="status" role="status">{{ 'categoryStep.loadFailed' | t }}</p>
      <button type="button" class="btn" (click)="load()">
        <app-icon name="refreshCw" [size]="18" />
        {{ 'categoryStep.reload' | t }}
      </button>
    } @else {
      <p class="caption">{{ 'categoryStep.loading' | t }}</p>
    }
  `,
  styleUrl: 'category-step.component.scss',
})
export class CategoryStepComponent {
  protected readonly service = inject(CategoriesService);
  readonly selected = input<string | null>(null);
  /** the card just tapped, while the page holds on this step: its tick draws and the card settles */
  readonly picking = input<string | null>(null);
  readonly picked = output<CategoryInfo>();

  protected readonly categories = signal<CategoryInfo[] | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    void this.load();
  }

  protected async load() {
    this.failed.set(false);
    try {
      this.categories.set(await this.service.list());
    } catch {
      this.failed.set(true);
    }
  }

  protected icon(c: CategoryInfo): IconName {
    return isIconName(c.icon) ? c.icon : 'mapPin';
  }
}
