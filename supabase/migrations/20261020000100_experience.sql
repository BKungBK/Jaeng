-- Plan 6 (experience): the monthly count follows the Thai calendar month, reports fixed long ago
-- stay readable for /list and old links (the map still drops them after 30 days), the /list page's
-- query, and district/province search for the place finder.

-- ---------------------------------------------------------------- public_reports: every fixed report
-- Same columns as 20261017000300_detail.sql; only the 30-day cut moves into reports_in_bbox.
create or replace view public.public_reports as
select
  r.id,
  c.slug as category,
  c.icon,
  r.danger_level,
  r.title,
  r.description,
  r.status,
  extensions.st_x(r.public_location::extensions.geometry) as lng,
  extensions.st_y(r.public_location::extensions.geometry) as lat,
  r.place_name,
  r.confirm_count,
  r.comment_count,
  floor(extract(epoch from (coalesce(r.resolved_at, now()) - r.approved_at)) / 86400)::int as days_open,
  case when r.hide_author then null else p.display_name end as author_name,
  (select ph.storage_path
     from public.report_photos ph
    where ph.report_id = r.id and ph.kind = 'before'
    order by ph.created_at
    limit 1) as cover_photo_path,
  coalesce((select array_agg(t.name order by t.name)
              from public.report_tags rt
              join public.tags t on t.id = rt.tag_id
             where rt.report_id = r.id), '{}'::text[]) as tags,
  r.approved_at,
  r.resolved_at,
  coalesce((select jsonb_agg(
                     jsonb_build_object('path', ph.storage_path, 'kind', ph.kind, 'width', ph.width, 'height', ph.height)
                     order by ph.kind, ph.created_at)
              from public.report_photos ph
             where ph.report_id = r.id and ph.kind in ('before', 'after')), '[]'::jsonb) as photos,
  r.created_at
from public.reports r
join public.categories c on c.id = r.category_id
join public.profiles p on p.id = r.author_id
where r.status in ('open', 'fix_claimed', 'resolved');

-- ---------------------------------------------------------------- reports_in_bbox: the map's 30-day cut
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
      and (p.status <> 'resolved' or p.resolved_at > now() - interval '30 days')
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

-- ---------------------------------------------------------------- stats_in_bbox: the Thai month
create or replace function public.stats_in_bbox(min_lng float8, min_lat float8, max_lng float8, max_lat float8)
returns table (resolved_this_month int, open_count int)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    count(*) filter (
      where r.status = 'resolved'
        and r.resolved_at >= (date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok')
    )::int,
    count(*) filter (where r.status in ('open', 'fix_claimed'))::int
  from public.reports r
  where r.public_location::geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;

-- ---------------------------------------------------------------- list_reports (/list)
-- Reads the public view only. Distances are measured from the published point, which the view
-- already shows, so they reveal nothing about a hazard's true location.
create function public.list_reports(
  min_lng float8,
  min_lat float8,
  max_lng float8,
  max_lat float8,
  levels int[] default '{0,1,2,3}',
  categories text[] default null,
  statuses text[] default '{open,fix_claimed,resolved}',
  include_old_resolved boolean default false,
  sort text default 'new',
  near_lng float8 default null,
  near_lat float8 default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with o as (
    select
      case
        when sort = 'near' and (near_lng is null or near_lat is null) then 'new'
        when sort in ('new', 'near', 'confirms', 'oldest') then sort
        else 'new'
      end as s,
      case when near_lng is not null and near_lat is not null
           then st_point(near_lng, near_lat, 4326)::geography end as pt
  ),
  hits as (
    select p.*,
           case when o.pt is not null then st_distance(st_point(p.lng, p.lat, 4326)::geography, o.pt) end as distance_m,
           o.s
    from public.public_reports p, o
    where p.id in (
            select r.id from public.reports r
            where r.public_location::geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
          )
      and p.danger_level = any (levels)
      and p.status = any (statuses)
      and (categories is null or p.category = any (categories))
      and (include_old_resolved or p.status <> 'resolved' or p.resolved_at > now() - interval '30 days')
  ),
  page as (
    select h.*,
           row_number() over (
             order by
               case when h.s = 'near' then h.distance_m end asc nulls last,
               case when h.s = 'confirms' then h.confirm_count end desc nulls last,
               case when h.s = 'oldest' then (h.status <> 'open')::int end asc nulls last,
               case when h.s = 'oldest' then h.days_open end desc nulls last,
               h.approved_at desc,
               h.id
           ) as rn
    from hits h
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pg.id,
           'title', pg.title,
           'category', pg.category,
           'icon', pg.icon,
           'danger_level', pg.danger_level,
           'status', pg.status,
           'confirm_count', pg.confirm_count,
           'comment_count', pg.comment_count,
           'days_open', pg.days_open,
           'place_name', pg.place_name,
           'cover_photo_path', pg.cover_photo_path,
           'approved_at', pg.approved_at,
           'resolved_at', pg.resolved_at,
           'distance_m', pg.distance_m
         ) order by pg.rn), '[]'::jsonb)
  from page pg
  where pg.rn > greatest(coalesce(p_offset, 0), 0)
    and pg.rn <= greatest(coalesce(p_offset, 0), 0) + least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

grant execute on function public.list_reports(float8, float8, float8, float8, int[], text[], text[], boolean, text,
                                              float8, float8, int, int) to anon, authenticated;

-- ---------------------------------------------------------------- search_areas (GET /places)
-- Provinces before districts, then shorter names. The API calls it with the service key.
create function public.search_areas(q text, p_limit int default 5)
returns table (level smallint, name_th text, name_en text, province_th text, province_en text,
               lng float8, lat float8, min_lng float8, min_lat float8, max_lng float8, max_lat float8)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select a.level, a.name_th, a.name_en, a.province_th, pv.name_en,
         st_x(g.c), st_y(g.c), st_xmin(g.b), st_ymin(g.b), st_xmax(g.b), st_ymax(g.b)
  from public.admin_areas a
  left join public.admin_areas pv on pv.level = 1 and pv.name_th = a.province_th
  cross join lateral (select st_pointonsurface(a.geom::geometry) as c, st_envelope(a.geom::geometry)::box2d as b) g
  where char_length(btrim(coalesce(q, ''))) >= 2
    and (a.name_th ilike '%' || public.escape_like(btrim(q)) || '%' escape '\'
         or a.name_en ilike '%' || public.escape_like(btrim(q)) || '%' escape '\')
  order by a.level, char_length(a.name_th), a.name_th
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
$$;

revoke execute on function public.search_areas(text, int) from public, anon, authenticated;
grant execute on function public.search_areas(text, int) to service_role;
