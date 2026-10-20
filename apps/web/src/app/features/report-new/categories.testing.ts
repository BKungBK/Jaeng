// Test helper: the eight core categories as the categories table holds them (seed order).
import { computed, inject, type Provider } from '@angular/core';
import { CategoriesService, type CategoryInfo } from '../../core/categories.service';
import { I18nService } from '../../core/i18n.service';

export const CATEGORIES: CategoryInfo[] = [
  { id: 1, slug: 'road', name_th: 'ถนน/ทางเท้า', name_en: 'Roads & sidewalks', icon: 'construction', default_level: 1 },
  { id: 2, slug: 'light', name_th: 'ไฟส่องสว่าง', name_en: 'Street lights', icon: 'lightbulb', default_level: 0 },
  { id: 3, slug: 'water', name_th: 'น้ำประปา', name_en: 'Water supply', icon: 'droplet', default_level: 0 },
  { id: 4, slug: 'flood', name_th: 'น้ำท่วม/ท่อระบาย', name_en: 'Flooding & drains', icon: 'waves', default_level: 1 },
  { id: 5, slug: 'waste', name_th: 'ขยะ', name_en: 'Waste', icon: 'trash2', default_level: 0 },
  { id: 6, slug: 'tree', name_th: 'ต้นไม้', name_en: 'Trees', icon: 'treeDeciduous', default_level: 1 },
  { id: 7, slug: 'hazard', name_th: 'จุดอันตราย', name_en: 'Safety hazard', icon: 'triangleAlert', default_level: 2 },
  { id: 8, slug: 'other', name_th: 'อื่นๆ', name_en: 'Other', icon: 'mapPin', default_level: 0 },
];

/** A loaded CategoriesService over CATEGORIES that follows the test's locale. */
export function provideCategories(list: CategoryInfo[] = CATEGORIES): Provider {
  return {
    provide: CategoriesService,
    useFactory: () => {
      const i18n = inject(I18nService);
      const labelOf = (c: CategoryInfo) => (i18n.locale() === 'en' ? c.name_en : c.name_th);
      return {
        list: () => Promise.resolve(list),
        labelOf,
        names: computed(() => Object.fromEntries(list.map((c) => [c.slug, labelOf(c)]))),
      };
    },
  };
}
