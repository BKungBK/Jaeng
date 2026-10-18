import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CategoriesService, type CategoryInfo } from '../../core/categories.service';
import { IconComponent } from '../../shared/icon.component';
import { isIconName, type IconName } from '../map/icons';

/** Step 2: eight big category buttons. A tap is the choice: the page moves on at once (no "ถัดไป"). */
@Component({
  selector: 'app-category-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (categories(); as list) {
      <div class="grid">
        @for (c of list; track c.slug) {
          <button type="button" class="cat" [attr.aria-pressed]="c.slug === selected()" (click)="picked.emit(c)">
            <app-icon [name]="icon(c)" [size]="32" />
            <span class="name">{{ c.name_th }}</span>
            @if (c.slug === selected()) {
              <span class="tick" aria-hidden="true"><app-icon name="check" [size]="16" /></span>
            }
          </button>
        }
      </div>
    } @else if (failed()) {
      <p class="status" role="status">โหลดหมวดไม่สำเร็จ ลองใหม่อีกครั้งนะ</p>
      <button type="button" class="btn" (click)="load()">
        <app-icon name="refreshCw" [size]="18" />
        ลองโหลดใหม่
      </button>
    } @else {
      <p class="caption">กำลังโหลดหมวด…</p>
    }
  `,
  styleUrl: 'category-step.component.scss',
})
export class CategoryStepComponent {
  private service = inject(CategoriesService);
  readonly selected = input<string | null>(null);
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
