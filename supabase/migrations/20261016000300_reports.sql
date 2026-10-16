-- Reports and everything attached to them (spec 5.1).

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category_id smallint not null references public.categories (id),
  danger_level smallint not null check (danger_level between 0 and 3),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'open', 'fix_claimed', 'resolved', 'rejected', 'hidden')),
  location extensions.geography(Point, 4326) not null,
  public_location extensions.geography(Point, 4326) not null,
  place_name text,
  hide_author boolean not null default false,
  confirm_count int not null default 0,
  comment_count int not null default 0,
  reject_reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index reports_public_location_idx on public.reports using gist (public_location);
create index reports_status_approved_idx on public.reports (status, approved_at);
create index reports_title_trgm_idx on public.reports using gin (title extensions.gin_trgm_ops);
create index reports_author_idx on public.reports (author_id);

-- Photos are uploaded before their report exists, so report_id starts null (spec 6: POST /photos).
create table public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'before' check (kind in ('before', 'after', 'comment')),
  storage_path text not null,
  width int,
  height int,
  blurred boolean not null default false,
  created_at timestamptz not null default now()
);
create index report_photos_report_idx on public.report_photos (report_id);

create table public.tags (
  id serial primary key,
  name text not null unique check (char_length(name) between 1 and 30 and name = lower(name))
);

create table public.report_tags (
  report_id uuid not null references public.reports (id) on delete cascade,
  tag_id int not null references public.tags (id) on delete cascade,
  primary key (report_id, tag_id)
);

create table public.confirmations (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  photo_id uuid references public.report_photos (id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);
create index comments_report_idx on public.comments (report_id, created_at);

create table public.fix_claims (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 500),
  photo_id uuid references public.report_photos (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index fix_claims_one_pending_idx on public.fix_claims (report_id) where status = 'pending';

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('report', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'false', 'personal_attack', 'privacy', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);
create index flags_target_idx on public.flags (target_type, target_id);

create table public.moderation_log (
  id bigserial primary key,
  admin_id uuid not null references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- A random point within max_m metres of p (used to blur sensitive locations, spec 6.4).
create function public.fuzz_point(p extensions.geography, max_m float8)
returns extensions.geography
language sql
volatile
set search_path = public, extensions
as $$
  select st_project(p, sqrt(random()) * max_m, radians(random() * 360));
$$;

create function public.reports_fill_defaults()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.public_location := coalesce(new.public_location, new.location);
  if new.place_name is null then
    new.place_name := public.area_name_at(st_x(new.location::geometry), st_y(new.location::geometry));
  end if;
  return new;
end;
$$;

create trigger reports_fill_defaults
  before insert on public.reports
  for each row execute function public.reports_fill_defaults();

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reports_touch_updated_at
  before update on public.reports
  for each row execute function public.touch_updated_at();

-- Counters use atomic increments so concurrent me-too clicks stay exact.
create function public.confirmations_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reports set confirm_count = confirm_count + 1 where id = new.report_id;
  else
    update public.reports set confirm_count = greatest(confirm_count - 1, 0) where id = old.report_id;
  end if;
  return null;
end;
$$;

create trigger confirmations_count
  after insert or delete on public.confirmations
  for each row execute function public.confirmations_count();

create function public.comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := coalesce(new.report_id, old.report_id);
begin
  update public.reports
  set comment_count = (select count(*) from public.comments c where c.report_id = rid and c.status = 'visible')
  where id = rid;
  return null;
end;
$$;

create trigger comments_count
  after insert or update of status or delete on public.comments
  for each row execute function public.comments_count();
