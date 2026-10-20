import { computed, inject, Injectable, signal } from '@angular/core';
import type { CategorySlug } from '@jaeng/shared/categories';
import { I18nService } from './i18n.service';
import { SupabaseService } from './supabase.service';

export type CategoryInfo = {
  id: number;
  slug: CategorySlug;
  name_th: string;
  name_en: string;
  icon: string;
  default_level: 0 | 1 | 2 | 3;
};

/** The categories table: its names are the words for each category in both languages (spec 3.12). */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private supabase = inject(SupabaseService);
  private i18n = inject(I18nService);
  private pending?: Promise<CategoryInfo[]>;
  private readonly loaded = signal<CategoryInfo[]>([]);

  /** Every category's name in the current language; {} until the table has loaded. */
  readonly names = computed<Partial<Record<CategorySlug, string>>>(() =>
    Object.fromEntries(this.loaded().map((c) => [c.slug, this.labelOf(c)])),
  );

  labelOf(c: CategoryInfo): string {
    return this.i18n.locale() === 'en' ? c.name_en : c.name_th;
  }

  /** Cached after the first successful load; a failed load is forgotten so the next call retries. */
  list(): Promise<CategoryInfo[]> {
    this.pending ??= this.load().catch((e) => {
      this.pending = undefined;
      throw e;
    });
    return this.pending;
  }

  private async load(): Promise<CategoryInfo[]> {
    const client = await this.supabase.client();
    const { data, error } = await client
      .from('categories')
      .select('id, slug, name_th, name_en, icon, default_level')
      .order('sort', { ascending: true });
    if (error) throw error;
    const list = (data ?? []) as CategoryInfo[];
    this.loaded.set(list);
    return list;
  }
}
