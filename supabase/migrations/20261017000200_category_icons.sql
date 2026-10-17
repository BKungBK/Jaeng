-- Plan 2b: category icons are Lucide icon names, never emoji (owner decision 2026-10-17).
-- Keep in sync with CATEGORY_ICONS in packages/shared/categories.ts.
update public.categories c
set icon = v.icon
from (values
  ('road', 'construction'),
  ('light', 'lightbulb'),
  ('water', 'droplet'),
  ('flood', 'waves'),
  ('waste', 'trash2'),
  ('tree', 'treeDeciduous'),
  ('hazard', 'triangleAlert'),
  ('other', 'mapPin')
) as v(slug, icon)
where c.slug = v.slug;

alter table public.categories
  add constraint categories_icon_name check (icon ~ '^[a-zA-Z0-9]+$');
