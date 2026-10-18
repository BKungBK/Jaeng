import { inject, Injectable } from '@angular/core';
import type { CategorySlug } from '@jaeng/shared/categories';
import { SupabaseService } from './supabase.service';

export type CategoryInfo = {
  id: number;
  slug: CategorySlug;
  name_th: string;
  icon: string;
  default_level: 0 | 1 | 2 | 3;
};

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private supabase = inject(SupabaseService);
  private pending?: Promise<CategoryInfo[]>;

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
      .select('id, slug, name_th, icon, default_level')
      .order('sort', { ascending: true });
    if (error) throw error;
    return (data ?? []) as CategoryInfo[];
  }
}
