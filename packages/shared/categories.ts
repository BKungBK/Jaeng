// Core category slugs in display order (spec 3.7). Names and icons live in the categories table.
export const CATEGORY_SLUGS = ['road', 'light', 'water', 'flood', 'waste', 'tree', 'hazard', 'other'] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
