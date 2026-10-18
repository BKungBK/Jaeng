begin;
select plan(22);

-- Start from an empty map; the demo seed comes back when the transaction rolls back.
delete from public.reports;

select tests.create_user('a@x.test') as a \gset

-- Tag names never start with '#'
select throws_ok($$insert into public.tags (name) values ('#x')$$, '23514', null, 'tag starting with # is rejected');
select lives_ok($$insert into public.tags (name) values ('x#y')$$, 'tag with # inside is fine');

-- Legacy rows: '#a' and 'a' merge into one row, report_tags survive
insert into public.tags (id, name) values (9001, 'a');
alter table public.tags drop constraint tags_name_no_hash;
insert into public.tags (id, name) values (9002, '#a'), (9003, '#solo');
insert into public.reports (id, author_id, category_id, danger_level, title, location)
values ('00000000-0000-0000-0000-0000000000a1', :'a', 1, 1, 'ทดสอบแท็ก',
        extensions.st_point(100.5, 13.7, 4326)::extensions.geography),
       ('00000000-0000-0000-0000-0000000000a2', :'a', 1, 1, 'ทดสอบแท็ก 2',
        extensions.st_point(100.5, 13.7, 4326)::extensions.geography);
insert into public.report_tags (report_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000a1', 9002),
  ('00000000-0000-0000-0000-0000000000a2', 9001),
  ('00000000-0000-0000-0000-0000000000a2', 9002),
  ('00000000-0000-0000-0000-0000000000a1', 9003);
select public.merge_hash_tags();
select is((select count(*)::int from public.tags where name in ('a', '#a')), 1, 'duplicate #a merged into a');
select is((select count(*)::int from public.tags where name like '#%'), 0, 'no tag keeps a leading #');
select is((select count(*)::int from public.report_tags where tag_id = 9001), 2, 'report_tags moved to the surviving row');
select is((select count(*)::int from public.report_tags rt join public.tags t on t.id = rt.tag_id where t.name = 'solo'),
  1, 'lone #solo renamed, its report_tags kept');
select lives_ok($$select public.merge_hash_tags()$$, 'merge_hash_tags is idempotent');
alter table public.tags add constraint tags_name_no_hash check (left(name, 1) <> '#');

-- escape_like
select is(public.escape_like('50%_off\x'), '50\%\_off\\x', 'escape_like escapes %, _ and backslash');

-- Search with special characters
delete from public.report_tags;
delete from public.reports;
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'ลด 50% ทุกวัน', 'open', extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now()),
       (:'a', 1, 1, 'ถนน_พัง', 'open', extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now()),
       (:'a', 1, 1, 'ธรรมดา', 'open', extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now());
insert into public.tags (name) values ('หน้าโรงเรียน') on conflict do nothing;
insert into public.report_tags (report_id, tag_id)
select r.id, t.id from public.reports r, public.tags t where r.title = 'ธรรมดา' and t.name = 'หน้าโรงเรียน';

create function pg_temp.search_titles(p_q text) returns text[]
language sql as $$
  select coalesce(array_agg(f->'properties'->>'title' order by f->'properties'->>'title'), '{}')
  from jsonb_array_elements(public.reports_in_bbox(-180, -90, 180, 90, '{0,1,2,3}', null, '{open,fix_claimed}', p_q)->'features') f;
$$;

select is(pg_temp.search_titles('%'), array['ลด 50% ทุกวัน'], 'q=% matches only the literal percent');
select is(pg_temp.search_titles('_'), array['ถนน_พัง'], 'q=_ matches only the literal underscore');
select lives_ok($$select pg_temp.search_titles('\')$$, 'q=backslash does not error');
select is(pg_temp.search_titles('\'), '{}'::text[], 'q=backslash matches nothing');
select is(pg_temp.search_titles('โรงเรียน'), array['ธรรมดา'], 'tag substring matches');
select is(pg_temp.search_titles('#หน้า'), array['ธรรมดา'], '#tag prefix matches by tag substring');
select is(pg_temp.search_titles('#'), '{}'::text[], 'q=# matches nothing and does not error');
select is(pg_temp.search_titles('#%'), '{}'::text[], 'q=#% matches nothing');
select is(array_length(pg_temp.search_titles('  '), 1), 3, 'blank q returns everything');

-- place_name follows public_location
select public.area_name_at(st_x(g), st_y(g)) as pn1, st_x(g) as x1, st_y(g) as y1
from (select extensions.st_pointonsurface(geom::extensions.geometry) g from public.admin_areas
      where level = 2 order by id limit 1) s \gset
select public.area_name_at(st_x(g), st_y(g)) as pn2, st_x(g) as x2, st_y(g) as y2
from (select extensions.st_pointonsurface(geom::extensions.geometry) g from public.admin_areas
      where level = 2 and name_th || province_th <> (select name_th || province_th from public.admin_areas
                                                     where level = 2 order by id limit 1)
      order by id desc limit 1) s \gset
select public.area_name_at(st_x(g), st_y(g)) as pn3, st_x(g) as x3, st_y(g) as y3
from (select extensions.st_pointonsurface(geom::extensions.geometry) g from public.admin_areas
      where level = 2 and name_th || province_th not in (:'pn1', :'pn2') order by id offset 3 limit 1) s \gset

insert into public.reports (author_id, category_id, danger_level, title, location, public_location)
values (:'a', 1, 1, 'ย้ายพิกัด',
        extensions.st_point(:x1, :y1, 4326)::extensions.geography,
        extensions.st_point(:x2, :y2, 4326)::extensions.geography)
returning id as pr \gset
select is((select place_name from public.reports where id = :'pr'), :'pn2', 'insert computes place_name from public_location');
update public.reports set public_location = extensions.st_point(:x3, :y3, 4326)::extensions.geography where id = :'pr';
select is((select place_name from public.reports where id = :'pr'), :'pn3', 'place_name follows a changed public_location');
update public.reports set title = 'ชื่อใหม่' where id = :'pr';
select is((select place_name from public.reports where id = :'pr'), :'pn3', 'other updates keep place_name');

-- Profiles: display_name only through the API
select tests.as_user(:'a');
select throws_ok(
  format($q$update public.profiles set display_name = 'ชื่อใหม่' where id = %L$q$, :'a'),
  '42501', null, 'client cannot change display_name');
select lives_ok(
  format($q$update public.profiles set locale = 'en' where id = %L$q$, :'a'),
  'client can still change locale');
select tests.as_owner();

select * from finish();
rollback;
