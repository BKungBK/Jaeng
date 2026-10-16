begin;
select plan(7);

select is((select count(*)::int from public.admin_areas where level = 1), 77, '77 provinces');
select is((select count(*)::int from public.admin_areas where level = 2), 928, '928 districts');

select matches(public.area_name_at(100.5018, 13.7563), 'กรุงเทพมหานคร$', 'Bangkok point names Bangkok');
select matches(public.area_name_at(98.9853, 18.7883), 'เชียงใหม่$', 'Chiang Mai point names Chiang Mai');
select is(public.area_name_at(101.0, 10.0), null, 'Gulf of Thailand is outside every district');
select is(public.area_name_at(105.85, 21.03), null, 'Hanoi is outside Thailand');

select is(
  (select region from public.admin_areas
   where level = 1 and extensions.st_covers(geom, extensions.st_point(102.83, 16.44, 4326)::extensions.geography)),
  'isan',
  'Khon Kaen province is in region isan'
);

select * from finish();
rollback;
