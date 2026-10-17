-- Plan 2 review fix: compare map boxes in planar geometry.
-- A geography envelope from -180 to 180 collapses (both edges are the same meridian), and very wide
-- geography boxes bend along great circles and drop points near their edges. The web app sends the
-- whole world when the globe view wraps, so reports_in_bbox and stats_in_bbox returned nothing there.

create index reports_public_location_geom_idx
  on public.reports using gist ((public_location::extensions.geometry));

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
        or p.title ilike '%' || btrim(q) || '%'
        or lower(ltrim(btrim(q), '#')) = any (p.tags)
      )
    order by p.confirm_count desc, p.approved_at desc
    limit 2000
  ) f;
$$;

create or replace function public.stats_in_bbox(min_lng float8, min_lat float8, max_lng float8, max_lat float8)
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
  where r.public_location::geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;
