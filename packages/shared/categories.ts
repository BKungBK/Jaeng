// Core category slugs in display order (spec 3.7). Names live in the categories table.
export const CATEGORY_SLUGS = ['road', 'light', 'water', 'flood', 'waste', 'tree', 'hazard', 'other'] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

/** Lucide icon names (plan 2b: no emoji). The categories.icon column holds the same names. */
export const CATEGORY_ICONS = {
  road: 'construction',
  light: 'lightbulb',
  water: 'droplet',
  flood: 'waves',
  waste: 'trash2',
  tree: 'treeDeciduous',
  hazard: 'triangleAlert',
  other: 'mapPin',
} as const satisfies Record<CategorySlug, string>;
