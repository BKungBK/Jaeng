import { computed, Injectable, signal } from '@angular/core';
import type { PublicStatus } from '@jaeng/shared/api';
import type { CategorySlug } from '@jaeng/shared/categories';
import type { DangerLevel } from '@jaeng/shared/levels';

export type ReportFilter = {
  levels: readonly DangerLevel[];
  categories: readonly CategorySlug[];
  statuses: readonly PublicStatus[];
};

/** What the reader chose to see, shared by the map and /list (spec 3.9). */
@Injectable({ providedIn: 'root' })
export class FilterState {
  readonly levels = signal<readonly DangerLevel[]>([0, 1, 2, 3]);
  /** [] = every category */
  readonly categories = signal<readonly CategorySlug[]>([]);
  readonly showResolved = signal(true);

  /** how many "more filters" are on: categories chosen (0 when all) plus the resolved switch when off */
  readonly extraCount = computed(() => this.categories().length + (this.showResolved() ? 0 : 1));
  readonly statuses = computed<readonly PublicStatus[]>(() =>
    this.showResolved() ? ['open', 'fix_claimed', 'resolved'] : ['open', 'fix_claimed'],
  );
  /** everything a report query needs, as one value */
  readonly filter = computed<ReportFilter>(() => ({
    levels: this.levels(),
    categories: this.categories(),
    statuses: this.statuses(),
  }));

  toggleCategory(slug: CategorySlug): void {
    this.categories.update((list) => (list.includes(slug) ? list.filter((c) => c !== slug) : [...list, slug]));
  }

  /** Back to every category with fixed reports shown; the level chips have their own buttons. */
  clearExtra(): void {
    this.categories.set([]);
    this.showResolved.set(true);
  }
}
