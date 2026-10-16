-- Public read API (spec 5.2). Views run as their owner, so they are the only window the
-- browser gets onto reports: they never expose author_id or the true location.

create view public.public_reports as
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
  r.resolved_at
from public.reports r
join public.categories c on c.id = r.category_id
join public.profiles p on p.id = r.author_id
where r.status in ('open', 'fix_claimed')
   or (r.status = 'resolved' and r.resolved_at > now() - interval '30 days');

create view public.public_comments as
select
  cm.id,
  cm.report_id,
  cm.body,
  p.display_name as author_name,
  cm.created_at
from public.comments cm
join public.profiles p on p.id = cm.author_id
where cm.status = 'visible'
  and cm.report_id in (select id from public.public_reports);

-- GeoJSON FeatureCollection of public reports inside a bounding box (max 2000 features).
create function public.reports_in_bbox(
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
    where p.lng between min_lng and max_lng
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

-- Encouragement numbers for the area on screen (spec 3.9).
create function public.stats_in_bbox(min_lng float8, min_lat float8, max_lng float8, max_lat float8)
returns table (resolved_this_month int, open_count int)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    count(*) filter (where r.status = 'resolved' and r.resolved_at >= date_trunc('month', now()))::int,
    count(*) filter (where r.status in ('open', 'fix_claimed'))::int
  from public.reports r
  where r.public_location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography;
$$;
