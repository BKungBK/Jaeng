-- Fixes from the plan 1 whole-branch review.

-- 1. comment_count: atomic increments. The old recount read a stale snapshot when a concurrent
--    comment held the report row lock, so the stored count could drift (scripts/race-comment-count.sh).
create or replace function public.comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := 0;
  rid uuid;
begin
  if tg_op = 'INSERT' then
    rid := new.report_id;
    delta := case when new.status = 'visible' then 1 else 0 end;
  elsif tg_op = 'DELETE' then
    rid := old.report_id;
    delta := case when old.status = 'visible' then -1 else 0 end;
  else
    rid := new.report_id;
    delta := (case when new.status = 'visible' then 1 else 0 end)
           - (case when old.status = 'visible' then 1 else 0 end);
  end if;
  if delta <> 0 then
    update public.reports set comment_count = greatest(comment_count + delta, 0) where id = rid;
  end if;
  return null;
end;
$$;

-- 2. reports_in_bbox: filter on the GiST-indexed public_location first, then apply the exact box.
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
            where r.public_location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
          )
      and p.lng between min_lng and max_lng
      and p.lat between min_lat and max_lat
      and p.danger_level = any (levels)
      and p.status = any (statuses)
      and (categories is null or p.category = any (categories))
      and (
        q is null or btrim(q) = ''
        or p.title ilike '%' || btrim(q) || '%'
        or lower(ltrim(btrim(q), '#')) = any (p.tags)
      )
    order by p.confirm_count desc, p.approved_at desc
    limit 2000
  ) f;
$$;

-- 3. Table SELECT only where a policy needs it, so a table that forgets RLS is never readable.
revoke select, maintain on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke select, maintain on tables from anon, authenticated;
revoke usage, select, update on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke usage, select, update on sequences from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.reports, public.profiles to authenticated;   -- own rows only, via RLS
grant select on public.public_reports, public.public_comments to anon, authenticated;

-- Place-name helpers serve triggers and the API, not clients.
revoke execute on function public.area_name_at(float8, float8) from public, anon, authenticated;
revoke execute on function public.area_province_at(float8, float8) from public, anon, authenticated;
revoke execute on function public.fuzz_point(extensions.geography, float8) from public, anon, authenticated;
