-- Place names from coordinates, used for report titles and place_name (spec 3.5, 5.1).

-- '{อำเภอ} {จังหวัด}', or null when the point is outside every district.
create function public.area_name_at(lng float8, lat float8)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select a.name_th || ' ' || a.province_th
  from public.admin_areas a
  where a.level = 2
    and st_covers(a.geom, st_point(lng, lat, 4326)::geography)
  limit 1;
$$;

create function public.area_province_at(lng float8, lat float8)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select a.name_th
  from public.admin_areas a
  where a.level = 1
    and st_covers(a.geom, st_point(lng, lat, 4326)::geography)
  limit 1;
$$;
