// Test helper: the eight core categories as the categories table holds them (seed order).
import type { CategoryInfo } from '../../core/categories.service';

export const CATEGORIES: CategoryInfo[] = [
  { id: 1, slug: 'road', name_th: 'ถนน/ทางเท้า', icon: 'construction', default_level: 1 },
  { id: 2, slug: 'light', name_th: 'ไฟส่องสว่าง', icon: 'lightbulb', default_level: 0 },
  { id: 3, slug: 'water', name_th: 'น้ำประปา', icon: 'droplet', default_level: 0 },
  { id: 4, slug: 'flood', name_th: 'น้ำท่วม/ท่อระบาย', icon: 'waves', default_level: 1 },
  { id: 5, slug: 'waste', name_th: 'ขยะ', icon: 'trash2', default_level: 0 },
  { id: 6, slug: 'tree', name_th: 'ต้นไม้', icon: 'treeDeciduous', default_level: 1 },
  { id: 7, slug: 'hazard', name_th: 'จุดอันตราย', icon: 'triangleAlert', default_level: 2 },
  { id: 8, slug: 'other', name_th: 'อื่นๆ', icon: 'mapPin', default_level: 0 },
];
