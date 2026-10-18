begin;
select plan(109);

-- Start from an empty map; the demo seed comes back when the transaction rolls back.
delete from public.reports;
delete from public.report_photos;

select tests.create_user('a@x.test') as a \gset
select tests.create_user('b@x.test') as b \gset
select tests.create_user('c@x.test') as c \gset
select tests.create_user('d@x.test') as d \gset

-- P: a point inside a district, so place names are never null.
select st_x(g) as px, st_y(g) as py
from (select extensions.st_pointonsurface(geom::extensions.geometry) g from public.admin_areas
      where level = 2 order by id limit 1) s \gset

-- An unattached upload of user u.
create function pg_temp.photo(u uuid) returns uuid
language sql as $$
  insert into public.report_photos (uploader_id, storage_path)
  values (u, 'pending/' || u || '/' || gen_random_uuid() || '.webp')
  returning id;
$$;

-- A point m metres east (or at the given bearing) of (lng, lat).
create function pg_temp.shift(lng float8, lat float8, m float8, deg float8 default 90)
returns extensions.geography
language sql as $$
  select extensions.st_project(extensions.st_point(lng, lat, 4326)::extensions.geography, m, radians(deg));
$$;

-- Create a report with one fresh photo; returns its id.
create function pg_temp.mk(u uuid, cat text, lng float8, lat float8, title text default 'เรื่องทดสอบ',
                           danger int default 1, tags text[] default null, lim int default 1000,
                           hide boolean default false, flagged boolean default false)
returns uuid
language sql as $$
  select id from public.create_report(u, cat, lng, lat, array[pg_temp.photo(u)], title, null,
                                      danger, tags, hide, flagged, lim);
$$;

-- ================================================================ create_report
select pg_temp.mk(:'a', 'road', :px, :py, '  ', null) as r_road \gset

select ok((select extensions.st_equals(location::extensions.geometry, public_location::extensions.geometry)
           from public.reports where id = :'r_road'), 'road: public_location equals location');
select is((select title from public.reports where id = :'r_road'),
  'ถนน/ทางเท้า ' || public.area_name_at(:px, :py), 'blank title falls back to category + place');
select is((select danger_level::int from public.reports where id = :'r_road'), 1, 'null danger uses road default_level');
select is((select status from public.reports where id = :'r_road'), 'pending_review', 'new report waits for review');
select ok((select approved_at is null from public.reports where id = :'r_road'), 'approved_at is null');
select ok(not exists (select 1 from public.public_reports where id = :'r_road'), 'new report is not public');
select is((select count(*)::int from public.report_photos where report_id = :'r_road' and kind = 'before'), 1,
  'photo is attached as before');

select pg_temp.mk(:'a', 'road', :px, :py, '  หลุมใหญ่  ', 3, null, 1000, true, true) as r_named \gset
select is((select title from public.reports where id = :'r_named'), 'หลุมใหญ่', 'given title is trimmed');
select is((select danger_level::int from public.reports where id = :'r_named'), 3, 'given danger is kept');
select ok((select hide_author and profanity_flag from public.reports where id = :'r_named'),
  'hide_author and profanity_flag are stored');
select is((select status from public.create_report(:'a', 'waste', :px, :py, array[pg_temp.photo(:'a')],
                                                   'ขยะ', 'รายละเอียด', null, null, false, false, 1000)),
  'pending_review', 'create_report returns the pending status');
select is((select danger_level::int from public.reports where title = 'ขยะ'), 0, 'waste default_level is 0');

-- hazard: 20 reports at P, each fuzzed within 150 m; everything public comes from the fuzzed point
create temp table hz as
  select pg_temp.mk(:'a', 'hazard', :px, :py, null, null) as id from generate_series(1, 20);
create temp view hzr as
  select r.*, public.area_name_at(st_x(r.public_location::extensions.geometry),
                                  st_y(r.public_location::extensions.geometry)) as pub_name
  from public.reports r join hz on hz.id = r.id;

select is((select count(*)::int from hzr), 20, '20 hazard reports created');
select is((select count(*)::int from hzr where extensions.st_distance(location, public_location) <= 150), 20,
  'hazard public_location is always within 150 m');
select ok((select count(*) from hzr where extensions.st_distance(location, public_location) > 0) >= 1,
  'hazard public_location moves at least once');
select is((select count(*)::int from hzr where place_name is not distinct from pub_name), 20,
  'hazard place_name comes from public_location');
select is((select count(*)::int from hzr where title like 'จุดเสี่ยง/ความปลอดภัย %'), 20,
  'hazard default title starts with the category name');
select is((select count(*)::int from hzr where title = btrim('จุดเสี่ยง/ความปลอดภัย ' || coalesce(pub_name, ''))), 20,
  'hazard default title uses the fuzzed place');
select is((select count(*)::int from hzr where danger_level = 2), 20, 'hazard default_level is 2');

-- ================================================================ photos
select pg_temp.photo(:'b') as b_photo \gset
select pg_temp.photo(:'a') as a_p1 \gset

select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[%L]::uuid[],
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'b_photo'),
  'P0001', 'invalid_photos', 'photo of another user is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s,
  array(select id from public.report_photos where report_id = %L),
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'r_road'),
  'P0001', 'invalid_photos', 'photo already attached is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[gen_random_uuid()],
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py),
  'P0001', 'invalid_photos', 'unknown photo id is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[]::uuid[],
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py),
  'P0001', 'invalid_photos', 'no photos is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, null,
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py),
  'P0001', 'invalid_photos', 'null photo list is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s,
  array[pg_temp.photo(%L), pg_temp.photo(%L), pg_temp.photo(%L), pg_temp.photo(%L), pg_temp.photo(%L)],
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'a', :'a', :'a', :'a', :'a'),
  'P0001', 'invalid_photos', '5 photos are rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[%L, %L]::uuid[],
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'a_p1', :'a_p1'),
  'P0001', 'invalid_photos', 'duplicate id in the list is rejected');
select is((select count(*)::int from public.report_photos where id = :'a_p1' and report_id is null), 1,
  'rejected call left the photo unattached');

-- Same photos twice (double submit): the second call fails and no second report appears
select pg_temp.photo(:'a') as a_p2 \gset
select pg_temp.photo(:'a') as a_p3 \gset
select lives_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[%L, %L]::uuid[],
  'ส่งครั้งแรก', null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'a_p2', :'a_p3'),
  'four-or-fewer own photos are accepted');
select count(*)::int as n_reports from public.reports \gset
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[%L, %L]::uuid[],
  'ส่งซ้ำ', null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'a_p2', :'a_p3'),
  'P0001', 'invalid_photos', 'resubmitting the same photos is rejected');
select is((select count(*)::int from public.reports), :n_reports, 'no second report was created');

select throws_ok(format($q$select * from public.create_report(%L, 'nope', %s, %s, array[pg_temp.photo(%L)],
  null, null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'a'),
  'P0001', 'invalid_report', 'unknown category is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[pg_temp.photo(%L)],
  null, null, 7, null, false, false, 1000)$q$, :'a', :px, :py, :'a'),
  'P0001', 'invalid_report', 'danger outside 0..3 is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[pg_temp.photo(%L)],
  repeat('ก', 121), null, null, null, false, false, 1000)$q$, :'a', :px, :py, :'a'),
  'P0001', 'invalid_report', 'title over 120 characters is rejected');

-- ================================================================ tags
select pg_temp.mk(:'a', 'road', :px, :py, 'แท็ก', 1, array['#A', 'a', 'b']) as r_tags \gset
select is((select array_agg(t.name order by t.name) from public.report_tags rt join public.tags t on t.id = rt.tag_id
           where rt.report_id = :'r_tags'), array['a', 'b'], '#A, a, b become a and b');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[pg_temp.photo(%L)],
  null, null, null, array['t1','t2','t3','t4','t5','t6'], false, false, 1000)$q$, :'a', :px, :py, :'a'),
  'P0001', 'invalid_report', '6 tags are rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[pg_temp.photo(%L)],
  null, null, null, array[repeat('x', 31)], false, false, 1000)$q$, :'a', :px, :py, :'a'),
  'P0001', 'invalid_report', 'tag over 30 characters is rejected');
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[pg_temp.photo(%L)],
  null, null, null, array['#'], false, false, 1000)$q$, :'a', :px, :py, :'a'),
  'P0001', 'invalid_report', 'tag that is only # is rejected');
select ok(not exists (select 1 from public.tags where name = 'ใหม่เอี่ยม'), 'tag does not exist yet');
select pg_temp.mk(:'a', 'road', :px, :py, 'แท็กใหม่', 1, array['ใหม่เอี่ยม']) as r_newtag \gset
select ok(exists (select 1 from public.tags where name = 'ใหม่เอี่ยม'), 'new tag is created');
select is((select count(*)::int from public.report_tags rt join public.tags t on t.id = rt.tag_id
           where rt.report_id = :'r_newtag' and t.name = 'ใหม่เอี่ยม'), 1, 'new tag is linked to the report');

-- ================================================================ quotas (user c)
-- register_photo
select lives_ok(format($q$select public.register_photo(gen_random_uuid(), %L, 'pending/c/1.webp', 800, 600, false, 2)$q$, :'c'),
  'register_photo 1 of 2');
select lives_ok(format($q$select public.register_photo(gen_random_uuid(), %L, 'pending/c/2.webp', 800, 600, false, 2)$q$, :'c'),
  'register_photo 2 of 2');
select throws_ok(format($q$select public.register_photo(gen_random_uuid(), %L, 'pending/c/3.webp', 800, 600, false, 2)$q$, :'c'),
  'P0001', 'rate_limited', 'register_photo 3 of 2 is rate limited');
update public.report_photos set created_at = now() - interval '25 hours' where storage_path = 'pending/c/1.webp';
select lives_ok(format($q$select public.register_photo('00000000-0000-0000-0000-00000000c0c0', %L, 'pending/c/4.webp', 640, 480, true, 2)$q$, :'c'),
  'photo from 25 hours ago no longer counts');
select ok((select report_id is null and kind = 'before' and uploader_id = :'c' and storage_path = 'pending/c/4.webp'
                  and width = 640 and height = 480 and blurred
           from public.report_photos where id = '00000000-0000-0000-0000-00000000c0c0'),
  'register_photo stores an unattached before photo');

-- create_report
select lives_ok(format($q$select pg_temp.mk(%L, 'road', %s, %s, 'c1', 1, null, 2)$q$, :'c', :px, :py), 'report 1 of 2');
select lives_ok(format($q$select pg_temp.mk(%L, 'road', %s, %s, 'c2', 1, null, 2)$q$, :'c', :px, :py), 'report 2 of 2');
select throws_ok(format($q$select pg_temp.mk(%L, 'road', %s, %s, 'c3', 1, null, 2)$q$, :'c', :px, :py),
  'P0001', 'rate_limited', 'report 3 of 2 is rate limited');
update public.reports set created_at = now() - interval '25 hours' where author_id = :'c' and title = 'c1';
select lives_ok(format($q$select pg_temp.mk(%L, 'road', %s, %s, 'c4', 1, null, 2)$q$, :'c', :px, :py),
  'report from 25 hours ago no longer counts');

-- add_comment
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'เรื่องเปิด', 'open', extensions.st_point(:px, :py, 4326)::extensions.geography, now())
returning id as r_open \gset
insert into public.reports (author_id, category_id, danger_level, title, location)
values (:'a', 1, 1, 'เรื่องรอตรวจ', extensions.st_point(:px, :py, 4326)::extensions.geography)
returning id as r_pending \gset

select lives_ok(format($q$select * from public.add_comment(%L, %L, 'หนึ่ง', 2)$q$, :'r_open', :'c'), 'comment 1 of 2');
select lives_ok(format($q$select * from public.add_comment(%L, %L, 'สอง', 2)$q$, :'r_open', :'c'), 'comment 2 of 2');
select throws_ok(format($q$select * from public.add_comment(%L, %L, 'สาม', 2)$q$, :'r_open', :'c'),
  'P0001', 'rate_limited', 'comment 3 of 2 is rate limited');
update public.comments set created_at = now() - interval '25 hours' where author_id = :'c' and body = 'หนึ่ง';
select lives_ok(format($q$select * from public.add_comment(%L, %L, 'สี่', 2)$q$, :'r_open', :'c'),
  'comment from 25 hours ago no longer counts');
select throws_ok(format($q$select * from public.add_comment(%L, %L, '   ', 1000)$q$, :'r_open', :'b'),
  '23514', null, 'blank comment is still rejected');
select throws_ok(format($q$select * from public.add_comment(%L, %L, 'hi', 1000)$q$, :'r_pending', :'b'),
  'P0001', 'report_not_found', 'comment on a non-public report is rejected');
select throws_ok(format($q$select * from public.add_comment(%L, %L, 'hi', 1000, %L)$q$, :'r_open', :'b', :'b_photo'),
  'P0001', 'invalid_photos', 'comment photo must already belong to the report');
select is((select comment_count from public.add_comment(:'r_open', :'b', '  สวัสดี  ', 1000)), 4,
  'comment added and counted');

-- ================================================================ find_duplicates
delete from public.reports;
-- d_open at P; the same point also holds road reports nobody may see
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'ซ้ำได้', 'open', extensions.st_point(:px, :py, 4326)::extensions.geography, now())
returning id as d_open \gset
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at, resolved_at)
values (:'a', 1, 1, 'รอตรวจ', 'pending_review', extensions.st_point(:px, :py, 4326)::extensions.geography, null, null),
       (:'a', 1, 1, 'ปฏิเสธ', 'rejected', extensions.st_point(:px, :py, 4326)::extensions.geography, null, null),
       (:'a', 1, 1, 'ซ่อน', 'hidden', extensions.st_point(:px, :py, 4326)::extensions.geography, now(), null),
       (:'a', 1, 1, 'แก้แล้ว', 'resolved', extensions.st_point(:px, :py, 4326)::extensions.geography, now(), now());

select st_x(g::extensions.geometry) as x30, st_y(g::extensions.geometry) as y30 from pg_temp.shift(:px, :py, 30) g \gset
select st_x(g::extensions.geometry) as x80, st_y(g::extensions.geometry) as y80 from pg_temp.shift(:px, :py, 80) g \gset

select ok(:'d_open' in (select id from public.find_duplicates(:x30, :y30, 'road')), 'open road report 30 m away is found');
select ok(:'d_open' not in (select id from public.find_duplicates(:x80, :y80, 'road')), 'report 80 m away is not found');
select is((select count(*)::int from public.find_duplicates(:px, :py, 'light')), 0, 'other category finds nothing');
select is(array(select id from public.find_duplicates(:px, :py, 'road')), array[:'d_open'::uuid],
  'pending, rejected, hidden and resolved reports are never found');
select is((select array_agg(k order by k) from public.find_duplicates(:px, :py, 'road') f, jsonb_object_keys(to_jsonb(f)) k),
  array['category', 'confirm_count', 'cover_photo_path', 'danger_level', 'id', 'status', 'title'],
  'only display columns come back, no coordinates or distance');

-- hazard with location Q and public_location 120 m north of Q
select st_x(g::extensions.geometry) as qx, st_y(g::extensions.geometry) as qy from pg_temp.shift(:px, :py, 2000) g \gset
select st_x(g::extensions.geometry) as qpx, st_y(g::extensions.geometry) as qpy from pg_temp.shift(:qx, :qy, 120, 0) g \gset
insert into public.reports (author_id, category_id, danger_level, title, status, location, public_location, approved_at)
values (:'a', 7, 2, 'จุดเสี่ยง', 'open', extensions.st_point(:qx, :qy, 4326)::extensions.geography,
        extensions.st_point(:qpx, :qpy, 4326)::extensions.geography, now())
returning id as d_hz \gset
select is((select count(*)::int from public.find_duplicates(:qx, :qy, 'hazard')), 0,
  'hazard is not found around its real location');
select is(array(select id from public.find_duplicates(:qpx, :qpy, 'hazard')), array[:'d_hz'::uuid],
  'hazard is found around its public location');

-- at most 3, nearest first
select st_x(g::extensions.geometry) as sx, st_y(g::extensions.geometry) as sy from pg_temp.shift(:px, :py, 4000) g \gset
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
select :'a', 1, 1, 'ใกล้ ' || n, 'open', pg_temp.shift(:sx, :sy, n * 5), now()
from generate_series(4, 1, -1) n;
select is(array(select title from public.find_duplicates(:sx, :sy, 'road')),
  array['ใกล้ 1', 'ใกล้ 2', 'ใกล้ 3'], 'returns the 3 nearest, nearest first');

-- ================================================================ merge_duplicate
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'เป้าหมาย', 'open', extensions.st_point(:px, :py, 4326)::extensions.geography, now())
returning id as m1 \gset
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at, resolved_at)
values (:'a', 1, 1, 'เป้าหมายแก้แล้ว', 'resolved', extensions.st_point(:px, :py, 4326)::extensions.geography, now(), now())
returning id as m_resolved \gset
insert into public.reports (author_id, category_id, danger_level, title, location)
values (:'a', 1, 1, 'เป้าหมายรอตรวจ', extensions.st_point(:px, :py, 4326)::extensions.geography)
returning id as m_pending \gset

select pg_temp.photo(:'b') as mb1 \gset
select pg_temp.photo(:'b') as mb2 \gset
select storage_path as mb1_old from public.report_photos where id = :'mb1' \gset

create temp table mg1 as select * from public.merge_duplicate(:'m1', :'b', array[:'mb1', :'mb2']::uuid[], 30);
select ok((select confirmed from mg1), 'first merge confirms');
select is((select confirm_count from mg1), 1, 'confirm_count +1');
select is((select comment_count from mg1), 1, 'comment_count +1');
select is((select photo_id from public.comments where id = (select comment_id from mg1)), :'mb1'::uuid,
  'merge comment carries the first photo');
select is((select body from public.comments where id = (select comment_id from mg1)), 'เจอเหมือนกัน แนบรูปเพิ่ม',
  'merge comment body');
select is((select photo_path from public.public_comments where id = (select comment_id from mg1)),
  :'m1' || '/' || :'mb1' || '.webp', 'public_comments.photo_path is the new path');
select is((select moved from mg1),
  jsonb_build_array(jsonb_build_object('from', :'mb1_old', 'to', :'m1' || '/' || :'mb1' || '.webp')),
  'moved lists the old and new path');
select ok((select report_id = :'m1' and kind = 'comment' from public.report_photos where id = :'mb1'),
  'photo now belongs to the report as a comment photo');
select is((select status from mg1), 'open', 'merge returns the status');

-- c had already confirmed: the confirmation stays, the comment is added
insert into public.confirmations (report_id, user_id) values (:'m1', :'c');
create temp table mg2 as select * from public.merge_duplicate(:'m1', :'c', array[pg_temp.photo(:'c')], 30);
select ok((select confirmed from mg2), 'already-confirmed user is still confirmed');
select is((select confirm_count from mg2), 2, 'confirm_count is not toggled off');
select is((select comment_count from mg2), 2, 'second merge still adds a comment');

select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[pg_temp.photo(%L)], 30)$q$,
  :'m_resolved', :'d', :'d'), 'P0001', 'report_resolved', 'resolved target is rejected');
select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[pg_temp.photo(%L)], 30)$q$,
  :'m_pending', :'d', :'d'), 'P0001', 'report_not_found', 'non-public target is rejected');
select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[pg_temp.photo(%L)], 30)$q$,
  gen_random_uuid(), :'d', :'d'), 'P0001', 'report_not_found', 'unknown target is rejected');
select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[%L]::uuid[], 30)$q$,
  :'m1', :'d', :'b_photo'), 'P0001', 'invalid_photos', 'photo of another user is rejected');
select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[]::uuid[], 30)$q$,
  :'m1', :'d'), 'P0001', 'invalid_photos', 'merge without photos is rejected');
select ok(not exists (select 1 from public.confirmations where report_id = :'m1' and user_id = :'d'),
  'failed merge left no confirmation');
select is((select confirm_count from public.reports where id = :'m1'), 2, 'failed merge left confirm_count alone');
select is((select comment_count from public.reports where id = :'m1'), 2, 'failed merge left comment_count alone');
select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[pg_temp.photo(%L)], 1)$q$,
  :'m1', :'b', :'b'), 'P0001', 'rate_limited', 'merge counts toward the comment limit');

-- ================================================================ delete_orphan_photos
insert into public.report_photos (id, uploader_id, storage_path, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', :'a', 'pending/old.webp', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000f2', :'a', 'pending/new.webp', now() - interval '1 hour');
insert into public.report_photos (id, report_id, uploader_id, storage_path, created_at) values
  ('00000000-0000-0000-0000-0000000000f3', :'m1', :'a', 'bound/old.webp', now() - interval '2 days');
create temp table swept as select * from public.delete_orphan_photos('24 hours');
select ok(('00000000-0000-0000-0000-0000000000f1'::uuid, 'pending/old.webp') in (select id, storage_path from swept),
  'old orphan is returned with its path');
select ok(not exists (select 1 from public.report_photos where id = '00000000-0000-0000-0000-0000000000f1'),
  'old orphan is deleted');
select ok(exists (select 1 from public.report_photos where id = '00000000-0000-0000-0000-0000000000f2'),
  'recent orphan stays');
select ok(exists (select 1 from public.report_photos where id = '00000000-0000-0000-0000-0000000000f3'),
  'old attached photo stays');

-- ================================================================ suggest_tags
delete from public.tags;
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'แท็ก1', 'open', extensions.st_point(:px, :py, 4326)::extensions.geography, now()),
       (:'a', 1, 1, 'แท็ก2', 'open', extensions.st_point(:px, :py, 4326)::extensions.geography, now());
insert into public.reports (author_id, category_id, danger_level, title, location)
values (:'a', 1, 1, 'แท็กลับ', extensions.st_point(:px, :py, 4326)::extensions.geography);
insert into public.tags (name) values ('หน้าโรงเรียน'), ('โรงพยาบาล'), ('50%off'), ('ทางม้าลาย'), ('โรงลับ');
insert into public.report_tags (report_id, tag_id)
select r.id, t.id from public.reports r, public.tags t
where (r.title in ('แท็ก1', 'แท็ก2') and t.name = 'โรงพยาบาล')
   or (r.title = 'แท็ก1' and t.name in ('หน้าโรงเรียน', '50%off', 'ทางม้าลาย'))
   or (r.title = 'แท็กลับ' and t.name = 'โรงลับ');

select is(array(select public.suggest_tags('โรง')), array['โรงพยาบาล', 'หน้าโรงเรียน'],
  'substring match, most used first; tags only on unreviewed reports are not suggested');
select is(array(select public.suggest_tags('%')), array['50%off'], '% is a literal character');
select is(array(select public.suggest_tags('#โรง', 1)), array['โรงพยาบาล'], 'max_rows caps the list, leading # ignored');
select tests.as_anon();
select is(array(select public.suggest_tags('ม้า')), array['ทางม้าลาย'], 'anon may call suggest_tags');
select tests.as_owner();

-- ================================================================ privileges
select tests.as_anon();
select throws_ok(format($q$select public.register_photo(gen_random_uuid(), %L, 'x', 1, 1, false, 9)$q$, :'a'),
  '42501', null, 'anon cannot register_photo');
select throws_ok(format($q$select * from public.create_report(%L, 'road', 100.5, 13.7, array[]::uuid[], null, null, null, null, false, false, 9)$q$, :'a'),
  '42501', null, 'anon cannot create_report');
select throws_ok($q$select * from public.find_duplicates(100.5, 13.7, 'road')$q$,
  '42501', null, 'anon cannot find_duplicates');
select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[]::uuid[], 9)$q$, :'m1', :'a'),
  '42501', null, 'anon cannot merge_duplicate');
select throws_ok($q$select * from public.delete_orphan_photos('1 hour')$q$,
  '42501', null, 'anon cannot delete_orphan_photos');
select throws_ok(format($q$select * from public.add_comment(%L, %L, 'hi', 9)$q$, :'m1', :'a'),
  '42501', null, 'anon cannot add_comment');
select tests.as_user(:'a');
select throws_ok(format($q$select public.register_photo(gen_random_uuid(), %L, 'x', 1, 1, false, 9)$q$, :'a'),
  '42501', null, 'member cannot register_photo');
select throws_ok(format($q$select * from public.create_report(%L, 'road', 100.5, 13.7, array[]::uuid[], null, null, null, null, false, false, 9)$q$, :'a'),
  '42501', null, 'member cannot create_report');
select throws_ok($q$select * from public.find_duplicates(100.5, 13.7, 'road')$q$,
  '42501', null, 'member cannot find_duplicates');
select throws_ok(format($q$select * from public.merge_duplicate(%L, %L, array[]::uuid[], 9)$q$, :'m1', :'a'),
  '42501', null, 'member cannot merge_duplicate');
select throws_ok($q$select * from public.delete_orphan_photos('1 hour')$q$,
  '42501', null, 'member cannot delete_orphan_photos');
select throws_ok(format($q$select * from public.add_comment(%L, %L, 'hi', 9)$q$, :'m1', :'a'),
  '42501', null, 'member cannot add_comment');
select tests.as_owner();

select hasnt_column('public', 'public_reports', 'profanity_flag', 'public_reports has no profanity_flag');
select has_column('public', 'public_comments', 'photo_path', 'public_comments has photo_path');
select hasnt_function('public', 'add_comment', array['uuid', 'uuid', 'text'], 'old 3-argument add_comment is gone');

select * from finish();
rollback;
