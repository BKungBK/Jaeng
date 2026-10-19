-- Plan 4 task 2: carry-over fixes from plan 1.
-- 1) tag names never start with '#'  2) search treats % _ \ as plain characters
-- 3) place_name follows public_location (hazard reports must not leak the real point)
-- 4) display_name is changed through PATCH /me only

-- ---------------------------------------------------------------- tags without '#'
-- Idempotent. Strips leading '#' from tag names; when the stripped name already exists the
-- report_tags rows move to that row and the '#' row is deleted. A tag that is only '#' is dropped.
create or replace function public.merge_hash_tags()
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_target int;
  v_clean text;
begin
  for r in select id, name from public.tags where left(name, 1) = '#' order by id loop
    v_clean := ltrim(r.name, '#');
    if v_clean = '' then
      delete from public.tags where id = r.id;
      continue;
    end if;
    select t.id into v_target from public.tags t where t.name = v_clean and t.id <> r.id;
    if v_target is null then
      update public.tags set name = v_clean where id = r.id;
    else
      insert into public.report_tags (report_id, tag_id)
        select rt.report_id, v_target from public.report_tags rt where rt.tag_id = r.id
        on conflict do nothing;
      delete from public.tags where id = r.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.merge_hash_tags() from public, anon, authenticated;

select public.merge_hash_tags();

alter table public.tags add constraint tags_name_no_hash check (left(name, 1) <> '#');

-- ---------------------------------------------------------------- literal search
create or replace function public.escape_like(s text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(s, '\', '\\'), '%', '\%'), '_', '\_');
$$;

grant execute on function public.escape_like(text) to anon, authenticated;

create or replace function public.reports_in_bbox(
  min_lng float8,
  min_lat float8,
  max_lng float8,
  max_lat float8,
  levels int[] default '{0,1,2,3}',
  categories text[] default null,
  statuses text[] default '{open,fix_claimed}',
  q text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(f.feature), '[]'::jsonb)
  )
  from (
    select jsonb_build_object(
      'type', 'Feature',
      'geometry', jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array(p.lng, p.lat)),
      'properties', jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'category', p.category,
        'icon', p.icon,
        'danger_level', p.danger_level,
        'status', p.status,
        'confirm_count', p.confirm_count,
        'comment_count', p.comment_count,
        'days_open', p.days_open,
        'cover_photo_path', p.cover_photo_path
      )
    ) as feature
    from public.public_reports p
    where p.id in (
            select r.id from public.reports r
            where r.public_location::geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
          )
      and p.danger_level = any (levels)
      and p.status = any (statuses)
      and (categories is null or p.category = any (categories))
      and (
        q is null or btrim(q) = ''
        or p.title ilike '%' || public.escape_like(btrim(q)) || '%' escape '\'
        or (
          lower(ltrim(btrim(q), '#')) <> ''
          and exists (
            select 1 from unnest(p.tags) as tg
            where tg like '%' || public.escape_like(lower(ltrim(btrim(q), '#'))) || '%' escape '\'
          )
        )
      )
    order by p.confirm_count desc, p.approved_at desc
    limit 2000
  ) f;
$$;

-- ---------------------------------------------------------------- place_name from public_location
create or replace function public.reports_fill_defaults()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.public_location := coalesce(new.public_location, new.location);
  if new.place_name is null then
    new.place_name := public.area_name_at(st_x(new.public_location::geometry), st_y(new.public_location::geometry));
  end if;
  return new;
end;
$$;

create or replace function public.reports_refresh_place()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.place_name := public.area_name_at(st_x(new.public_location::geometry), st_y(new.public_location::geometry));
  return new;
end;
$$;

create trigger reports_refresh_place
  before update of public_location on public.reports
  for each row
  when (old.public_location is distinct from new.public_location)
  execute function public.reports_refresh_place();

-- ---------------------------------------------------------------- profiles
revoke update (display_name) on public.profiles from authenticated;
