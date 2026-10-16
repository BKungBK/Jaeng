-- Base tables: profiles, categories, admin_areas (spec 5.1).

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  role text not null default 'user' check (role in ('user', 'admin')),
  locale text not null default 'th' check (locale in ('th', 'en')),
  banned_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.categories (
  id smallint primary key,
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  icon text not null,
  default_level smallint not null check (default_level between 0 and 3),
  sort smallint not null
);

insert into public.categories (id, slug, name_th, name_en, icon, default_level, sort) values
  (1, 'road',   'ถนน/ทางเท้า',           'Road & sidewalk',  '🕳️', 1, 1),
  (2, 'light',  'ไฟฟ้า/ไฟส่องสว่าง',       'Lighting & power', '💡', 1, 2),
  (3, 'water',  'น้ำประปา/ท่อระบาย',       'Water & drains',   '💧', 1, 3),
  (4, 'flood',  'น้ำท่วม',                 'Flooding',         '🌊', 2, 4),
  (5, 'waste',  'ขยะ',                    'Waste',            '🗑️', 0, 5),
  (6, 'tree',   'ต้นไม้',                   'Trees',            '🌳', 1, 6),
  (7, 'hazard', 'จุดเสี่ยง/ความปลอดภัย',     'Safety hazard',    '⚠️', 2, 7),
  (8, 'other',  'อื่นๆ',                    'Other',            '📍', 0, 8);

create table public.admin_areas (
  id serial primary key,
  level smallint not null check (level in (1, 2)),
  pcode text not null unique,
  name_th text not null,
  name_en text not null,
  province_th text not null,
  region text not null check (region in ('isan', 'other')),
  geom extensions.geography(MultiPolygon, 4326) not null
);
create index admin_areas_geom_idx on public.admin_areas using gist (geom);
create index admin_areas_level_idx on public.admin_areas (level);

-- Every new auth user gets a profile with a friendly random name.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'เพื่อนบ้าน' || lpad(floor(random() * 10000)::int::text, 4, '0'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
