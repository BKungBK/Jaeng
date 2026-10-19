begin;
select plan(69);

-- Start from an empty map; the demo seed comes back when the transaction rolls back.
delete from public.reports;
delete from public.report_photos;

select tests.create_user('m5a@x.test') as a \gset
select tests.create_user('m5b@x.test') as b \gset
select tests.create_user('m5admin@x.test') as adm \gset
update public.profiles set role = 'admin' where id = :'adm';

-- P: a point inside a district, so place names are never null.
select st_x(g) as px, st_y(g) as py
from (select extensions.st_pointonsurface(geom::extensions.geometry) g from public.admin_areas
      where level = 2 order by id limit 1) s \gset

-- An unattached upload of user u, stored where the API stores it: {uploader}/{photo}.webp
create function pg_temp.photo(u uuid) returns uuid
language sql as $$
  with i as (select gen_random_uuid() as id)
  insert into public.report_photos (id, uploader_id, storage_path)
  select i.id, u, u::text || '/' || i.id::text || '.webp' from i
  returning id;
$$;

-- A point m metres east (or at the given bearing) of (lng, lat).
create function pg_temp.shift(lng float8, lat float8, m float8, deg float8 default 90)
returns extensions.geography
language sql as $$
  select extensions.st_project(extensions.st_point(lng, lat, 4326)::extensions.geography, m, radians(deg));
$$;

-- A pending report of u with n fresh photos; returns its id.
create function pg_temp.mk(u uuid, cat text, lng float8, lat float8, n int default 1, title text default 'เรื่องทดสอบ')
returns uuid language sql as $$
  select id from public.create_report(u, cat, lng, lat,
    array(select pg_temp.photo(u) from generate_series(1, n)), title, null, 1, null, false, false, 1000);
$$;

-- ================================================================ approve: keep, photos move
select pg_temp.mk(:'a', 'road', :px, :py, 2) as r1 \gset

set local role service_role;
select public.admin_approve_report(:'adm', :'r1', null, null, null, 'keep', null, null) as e1 \gset
reset role;

select is((select status from public.reports where id = :'r1'), 'open', 'approve: report is open');
select ok((select approved_at is not null from public.reports where id = :'r1'), 'approve: approved_at is set');
select ok(exists (select 1 from public.public_reports where id = :'r1'), 'approve: report is public');
select ok(not exists (select 1 from public.report_photos ph
                      where ph.report_id = :'r1' and ph.kind = 'before'
                        and ph.storage_path <> :'r1' || '/' || ph.id || '.webp'),
  'approve: every before photo moved to the report folder');
select is(jsonb_array_length(:'e1'::jsonb -> 'promote'), 2, 'approve: promote lists both photos');
select is((select count(*)::int from jsonb_array_elements(:'e1'::jsonb -> 'promote') x
           join public.report_photos ph on x ->> 'to' = ph.storage_path
            and x ->> 'from' = :'a' || '/' || ph.id || '.webp'), 2,
  'approve: each pair maps the upload path to the new path');
select is(:'e1'::jsonb -> 'report' ->> 'status', 'open', 'approve: effect carries the new status');
select ok(not (:'e1'::jsonb -> 'report' ? 'lng') and not (:'e1'::jsonb -> 'report' ? 'lat'),
  'approve: effect has no coordinates');
select is(:'e1'::jsonb -> 'demote', '[]'::jsonb, 'approve: nothing demoted');

-- ================================================================ approve: edits
select pg_temp.mk(:'a', 'road', :px, :py, 1) as r2 \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as r3 \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as r3b \gset

set local role service_role;
select public.admin_approve_report(:'adm', :'r2', 'water', 3, 'ท่อแตก', 'keep', null, null);
select public.admin_approve_report(:'adm', :'r3', null, null, '  ', 'keep', null, null);
select public.admin_approve_report(:'adm', :'r3b', null, null, null, 'keep', null, null);
reset role;

select is((select c.slug from public.reports r join public.categories c on c.id = r.category_id where r.id = :'r2'),
  'water', 'approve edits: category changed');
select is((select danger_level::int from public.reports where id = :'r2'), 3, 'approve edits: danger changed');
select is((select title from public.reports where id = :'r2'), 'ท่อแตก', 'approve edits: title changed');
select is((select title from public.reports where id = :'r3'), 'เรื่องทดสอบ', 'blank title keeps the current one');
select is((select title from public.reports where id = :'r3b'), 'เรื่องทดสอบ', 'null title keeps the current one');

-- ================================================================ approve: invalid edits
select pg_temp.mk(:'a', 'road', :px, :py, 1) as r4 \gset

set local role service_role;
select throws_ok(format($q$select public.admin_approve_report(%L, %L, 'nope', null, null, 'keep', null, null)$q$, :'adm', :'r4'),
  'P0001', 'invalid_report', 'approve: unknown category is rejected');
select throws_ok(format($q$select public.admin_approve_report(%L, %L, null, 4, null, 'keep', null, null)$q$, :'adm', :'r4'),
  'P0001', 'invalid_report', 'approve: danger 4 is rejected');
select throws_ok(format($q$select public.admin_approve_report(%L, %L, null, null, %L, 'keep', null, null)$q$,
  :'adm', :'r4', repeat('ก', 121)), 'P0001', 'invalid_report', 'approve: title over 120 characters is rejected');
reset role;
select is((select status from public.reports where id = :'r4'), 'pending_review', 'invalid edits leave the report pending');

-- ================================================================ approve: location modes
select pg_temp.mk(:'a', 'hazard', :px, :py, 1) as rh \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as rp \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as rfail \gset
select st_x(g::extensions.geometry) as p3x, st_y(g::extensions.geometry) as p3y
from pg_temp.shift(:px, :py, 300) g \gset
select st_x(g::extensions.geometry) as far_x, st_y(g::extensions.geometry) as far_y
from pg_temp.shift(:px, :py, 1500) g \gset

set local role service_role;
select public.admin_approve_report(:'adm', :'rh', null, null, null, 'exact', null, null);
select public.admin_approve_report(:'adm', :'rp', null, null, null, 'point', :p3x, :p3y);
select throws_ok(format($q$select public.admin_approve_report(%L, %L, null, null, null, 'point', %s, %s)$q$,
  :'adm', :'rfail', :far_x, :far_y), 'P0001', 'invalid_location', 'point more than 1000 m away is rejected');
select throws_ok(format($q$select public.admin_approve_report(%L, %L, null, null, null, 'point', 0, 0)$q$, :'adm', :'rfail'),
  'P0001', 'invalid_location', 'point outside Thailand is rejected');
select throws_ok(format($q$select public.admin_approve_report(%L, %L, null, null, null, 'x', null, null)$q$, :'adm', :'rfail'),
  'P0001', 'invalid_request', 'unknown location mode is rejected');
reset role;

select ok((select extensions.st_equals(public_location::extensions.geometry, location::extensions.geometry)
           from public.reports where id = :'rh'), 'exact: the published point is the true point');
select ok((select extensions.st_distance(public_location,
                  extensions.st_point(:p3x, :p3y, 4326)::extensions.geography) < 0.01
           from public.reports where id = :'rp'), 'point: the published point is the admin pin');
select is((select place_name from public.reports where id = :'rp'), public.area_name_at(:p3x, :p3y),
  'point: place name follows the pin (no permission error under service_role)');

-- ================================================================ approve: hazard safety
select array_agg(pg_temp.mk(:'a', 'road', :px, :py, 1)) as hz_ids from generate_series(1, 10) \gset

set local role service_role;
select public.admin_approve_report(:'adm', x, 'hazard', null, null, 'keep', null, null)
from unnest(:'hz_ids'::uuid[]) x;
reset role;

select is((select count(*)::int from public.reports
           where id = any (:'hz_ids'::uuid[])
             and extensions.st_distance(location, public_location) <= 150), 10,
  'hazard approved with keep: every published point is within 150 m');
select ok((select count(*) from public.reports
           where id = any (:'hz_ids'::uuid[])
             and extensions.st_distance(location, public_location) > 0) >= 1,
  'hazard approved with keep: the published point moves');

-- a pin dropped exactly on a hazard's true point is not the explicit "exact" choice: it is fuzzed too
select array_agg(pg_temp.mk(:'a', 'road', :px, :py, 1)) as hp_ids from generate_series(1, 10) \gset
set local role service_role;
select public.admin_approve_report(:'adm', x, 'hazard', null, null, 'point', :px, :py)
from unnest(:'hp_ids'::uuid[]) x;
reset role;
select is((select count(*)::int from public.reports
           where id = any (:'hp_ids'::uuid[]) and extensions.st_distance(location, public_location) <= 150), 10,
  'hazard pinned on its true point: every published point is within 150 m');
select ok((select count(*) from public.reports
           where id = any (:'hp_ids'::uuid[]) and extensions.st_distance(location, public_location) > 0) >= 1,
  'hazard pinned on its true point: the published point moves');

-- ================================================================ approve: fuzz
select array_agg(pg_temp.mk(:'a', 'road', :px, :py, 1)) as fz_ids from generate_series(1, 10) \gset

set local role service_role;
select public.admin_approve_report(:'adm', x, null, null, null, 'fuzz', null, null)
from unnest(:'fz_ids'::uuid[]) x;
reset role;

select is((select count(*)::int from public.reports
           where id = any (:'fz_ids'::uuid[])
             and extensions.st_distance(location, public_location) <= 150), 10,
  'fuzz: every published point is within 150 m');
select ok((select count(*) from public.reports
           where id = any (:'fz_ids'::uuid[])
             and extensions.st_distance(location, public_location) > 0) >= 1,
  'fuzz: the published point moves');

-- ================================================================ approve: default title
-- A default title names the area of the published point. After a category change to hazard,
-- the title must name the fuzzed point, never the area of the true point.
select pg_temp.mk(:'a', 'road', :px, :py, 1, '  ') as rt1 \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1, 'หลุมลึก') as rt2 \gset

set local role service_role;
select public.admin_approve_report(:'adm', :'rt1', 'hazard', null, null, 'keep', null, null);
select public.admin_approve_report(:'adm', :'rt2', 'hazard', null, null, 'keep', null, null);
reset role;

select is((select title from public.reports where id = :'rt1'),
  btrim('จุดเสี่ยง/ความปลอดภัย ' || coalesce((select place_name from public.reports where id = :'rt1'), '')),
  'hazard approve: a default title names the place of the published point');
select ok((select place_name is not distinct from public.area_name_at(
                 extensions.st_x(public_location::extensions.geometry),
                 extensions.st_y(public_location::extensions.geometry))
           from public.reports where id = :'rt1'),
  'hazard approve: place_name follows the published point');
select is((select title from public.reports where id = :'rt2'), 'หลุมลึก',
  'hazard approve: a custom title is kept');

-- ================================================================ states
set local role service_role;
select throws_ok(format($q$select public.admin_approve_report(%L, %L, null, null, null, 'keep', null, null)$q$, :'adm', :'r1'),
  'P0001', 'invalid_state', 'approving an open report again is rejected');
select throws_ok(format($q$select public.admin_reject_report(%L, %L, 'duplicate', null)$q$, :'adm', :'r1'),
  'P0001', 'invalid_state', 'rejecting an open report is rejected');
select throws_ok(format($q$select public.admin_approve_report(%L, gen_random_uuid(), null, null, null, 'keep', null, null)$q$, :'adm'),
  'P0001', 'report_not_found', 'approving an unknown report is rejected');
reset role;
select is((select count(*)::int from public.moderation_log where action = 'approve_report' and target_id = :'r1'), 1,
  'one approve_report log row for the report');
select is((select admin_id from public.moderation_log where action = 'approve_report' and target_id = :'r1'),
  :'adm'::uuid, 'the log names the admin');

-- ================================================================ reject
select pg_temp.mk(:'a', 'road', :px, :py, 1) as rd \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as ro \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as ro2 \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as ro3 \gset

set local role service_role;
select public.admin_reject_report(:'adm', :'rd', 'duplicate', null) as ed \gset
select public.admin_reject_report(:'adm', :'ro', 'other', '  พิกัดไม่ชัด  ');
select public.admin_reject_report(:'adm', :'ro2', 'other', null);
select throws_ok(format($q$select public.admin_reject_report(%L, %L, 'nope', null)$q$, :'adm', :'ro3'),
  'P0001', 'invalid_request', 'reject: unknown reason is rejected');
select throws_ok(format($q$select public.admin_reject_report(%L, %L, 'other', %L)$q$, :'adm', :'ro3', repeat('ก', 201)),
  'P0001', 'invalid_note', 'reject: note over 200 characters is rejected');
reset role;

select is((select status from public.reports where id = :'rd'), 'rejected', 'reject: status is rejected');
select is((select reject_reason from public.reports where id = :'rd'), 'duplicate', 'reject: reason is stored');
select is((select reject_reason from public.reports where id = :'ro'), 'พิกัดไม่ชัด',
  'reject other: the note is stored trimmed');
select is((select reject_reason from public.reports where id = :'ro2'), 'other',
  'reject other without a note keeps the reason');
select is(:'ed'::jsonb -> 'report', 'null'::jsonb, 'reject: effect has no report (not public)');
select ok(exists (select 1 from public.moderation_log
                   where action = 'reject_report' and target_id = :'rd' and detail ->> 'reason' = 'duplicate'),
  'reject: logged with the reason');

-- ================================================================ moderation_effect
select pg_temp.mk(:'a', 'road', :px, :py, 1) as re \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as rh2 \gset
select pg_temp.mk(:'a', 'road', :px, :py, 1) as rh3 \gset
update public.reports set status = 'hidden', hidden_from = 'open' where id = :'rh2';
update public.reports set status = 'hidden', hidden_from = 'pending_review' where id = :'rh3';

select is(public.moderation_effect(:'re') -> 'report', 'null'::jsonb, 'effect: a pending report is not announced');
select is(public.moderation_effect(:'rh2') -> 'report' ->> 'status', 'hidden',
  'effect: a report hidden from a public status is announced');
select is(public.moderation_effect(:'rh3') -> 'report', 'null'::jsonb,
  'effect: a report hidden from pending review is not announced');

-- ================================================================ schema
select lives_ok(format($q$insert into public.report_photos (uploader_id, storage_path, kind)
  values (%L, 'x/claim.webp', 'claim')$q$, :'a'), 'claim is an allowed photo kind');
select lives_ok($q$insert into public.moderation_log (admin_id, action, target_type, target_id)
  values (null, 'auto_hide', 'report', gen_random_uuid())$q$, 'the log accepts a system row without an admin');
select lives_ok(format($q$insert into public.flags (target_type, target_id, reporter_id, reason, status)
  values ('report', %L, %L, 'spam', 'open')$q$, :'r1', :'b'), 'first open flag from a member');
select throws_ok(format($q$insert into public.flags (target_type, target_id, reporter_id, reason, status)
  values ('report', %L, %L, 'spam', 'open')$q$, :'r1', :'b'), '23505', null,
  'a second open flag from the same member is rejected');
select lives_ok(format($q$update public.flags set status = 'dismissed'
  where target_type = 'report' and target_id = %L and reporter_id = %L$q$, :'r1', :'b'),
  'the first flag can be dismissed');
select lives_ok(format($q$insert into public.flags (target_type, target_id, reporter_id, reason, status)
  values ('report', %L, %L, 'spam', 'open')$q$, :'r1', :'b'), 'a new open flag is allowed after dismissal');

-- ================================================================ plan 4 carry-over
select throws_ok(format($q$select * from public.create_report(%L, 'road', %s, %s, array[pg_temp.photo(%L)],
  null, null, null, null, false, false, null)$q$, :'a', :px, :py, :'a'),
  'P0001', 'rate_limited', 'create_report: a null quota counts as zero');
select throws_ok(format($q$select public.register_photo(gen_random_uuid(), %L, 'x/y.webp', 1, 1, false, null)$q$, :'b'),
  'P0001', 'rate_limited', 'register_photo: a null quota counts as zero');
select throws_ok(format($q$select * from public.add_comment(%L, %L, 'hi', null)$q$, :'r1', :'b'),
  'P0001', 'rate_limited', 'add_comment: a null quota counts as zero');

-- Q is 5000 m due north of P. Two public reports 150 m and 300 m due east of Q; a huge radius is clamped to 200 m.
select st_x(g::extensions.geometry) as qx, st_y(g::extensions.geometry) as qy
from pg_temp.shift(:px, :py, 5000, 0) g \gset
select st_x(g::extensions.geometry) as x150, st_y(g::extensions.geometry) as y150
from pg_temp.shift(:qx, :qy, 150) g \gset
select st_x(g::extensions.geometry) as x300, st_y(g::extensions.geometry) as y300
from pg_temp.shift(:qx, :qy, 300) g \gset
select pg_temp.mk(:'a', 'road', :x150, :y150, 1) as q150 \gset
select pg_temp.mk(:'a', 'road', :x300, :y300, 1) as q300 \gset

set local role service_role;
select public.admin_approve_report(:'adm', :'q150', null, null, null, 'keep', null, null);
select public.admin_approve_report(:'adm', :'q300', null, null, null, 'keep', null, null);
reset role;

select ok(:'q150'::uuid in (select id from public.find_duplicates(:qx, :qy, 'road', 1000000)),
  'find_duplicates: a report 150 m away is found (radius clamped to 200 m)');
select ok(not (:'q300'::uuid in (select id from public.find_duplicates(:qx, :qy, 'road', 1000000))),
  'find_duplicates: a report 300 m away is not found');

-- ================================================================ privileges
select tests.as_anon();
select throws_ok($q$select public.admin_approve_report(gen_random_uuid(), gen_random_uuid(), null, null, null, 'keep', null, null)$q$,
  '42501', null, 'anon cannot approve');
select throws_ok($q$select public.admin_reject_report(gen_random_uuid(), gen_random_uuid(), 'duplicate', null)$q$,
  '42501', null, 'anon cannot reject');
select throws_ok($q$select public.log_action(gen_random_uuid(), 'x', 'report', gen_random_uuid(), '{}'::jsonb)$q$,
  '42501', null, 'anon cannot call log_action');
select throws_ok($q$select public.moderation_effect(gen_random_uuid())$q$,
  '42501', null, 'anon cannot call moderation_effect');
select tests.as_user(:'a');
select throws_ok($q$select public.admin_approve_report(gen_random_uuid(), gen_random_uuid(), null, null, null, 'keep', null, null)$q$,
  '42501', null, 'member cannot approve');
select throws_ok($q$select public.admin_reject_report(gen_random_uuid(), gen_random_uuid(), 'duplicate', null)$q$,
  '42501', null, 'member cannot reject');
select throws_ok($q$select public.log_action(gen_random_uuid(), 'x', 'report', gen_random_uuid(), '{}'::jsonb)$q$,
  '42501', null, 'member cannot call log_action');
select throws_ok($q$select public.moderation_effect(gen_random_uuid())$q$,
  '42501', null, 'member cannot call moderation_effect');
select tests.as_owner();
select hasnt_column('public', 'public_reports', 'hidden_from', 'public_reports has no hidden_from');

select * from finish();
rollback;
