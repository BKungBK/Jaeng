begin;
select * from no_plan();

-- Counts are compared as differences, so the demo seed may stay in place.
select reports as c0_reports, claims as c0_claims, flags as c0_flags from public.admin_counts() \gset

select tests.create_user('m7a@x.test') as a \gset
select tests.create_user('m7b@x.test') as b \gset
select tests.create_user('m7c@x.test') as c \gset
select tests.create_user('m7admin@x.test') as adm \gset
update public.profiles set role = 'admin' where id = :'adm';
update public.profiles set display_name = 'สมหญิง ทดสอบ' where id = :'a';

select st_x(g) as px, st_y(g) as py
from (select extensions.st_pointonsurface(geom::extensions.geometry) g from public.admin_areas
      where level = 2 order by id limit 1) s \gset

create function pg_temp.photo(u uuid) returns uuid
language sql as $$
  with i as (select gen_random_uuid() as id)
  insert into public.report_photos (id, uploader_id, storage_path)
  select i.id, u, u::text || '/' || i.id::text || '.webp' from i
  returning id;
$$;

create function pg_temp.mk(u uuid, cat text, lng float8, lat float8, n int default 1, hide boolean default false,
                           flagged boolean default false, tags text[] default null)
returns uuid language sql as $$
  select id from public.create_report(u, cat, lng, lat,
    array(select pg_temp.photo(u) from generate_series(1, n)), 'เรื่องทดสอบ', null, 1, tags, hide, flagged, 1000);
$$;

create function pg_temp.open(u uuid, adm uuid, lng float8, lat float8) returns uuid
language plpgsql as $$
declare v uuid;
begin
  v := pg_temp.mk(u, 'road', lng, lat);
  perform public.admin_approve_report(adm, v, null, null, null, 'keep', null, null);
  return v;
end;
$$;

-- One queue item by id.
create function pg_temp.item(q jsonb, id text) returns jsonb
language sql as $$
  select x from jsonb_array_elements(q) x where x ->> 'id' = id;
$$;

-- ================================================================ review queue
select pg_temp.mk(:'a', 'road', :px, :py, 2, true, true, array['หลุม', 'ถนน']) as q1 \gset
update public.reports set created_at = now() - interval '2 days' where id = :'q1';
select pg_temp.mk(:'a', 'hazard', :px, :py) as q2 \gset
select pg_temp.open(:'a', :'adm', :px, :py) as o1 \gset

set local role service_role;
select public.admin_queue_reports(500) as qr \gset
reset role;

select ok(pg_temp.item(:'qr', :'q1') is not null and pg_temp.item(:'qr', :'q2') is not null, 'queue: both pending reports');
select ok(pg_temp.item(:'qr', :'o1') is null, 'queue: an open report is not in it');
select ok((select min(o) from jsonb_array_elements(:'qr'::jsonb) with ordinality t(x, o) where x ->> 'id' = :'q1')
        < (select min(o) from jsonb_array_elements(:'qr'::jsonb) with ordinality t(x, o) where x ->> 'id' = :'q2'),
  'queue: oldest first');
select ok(abs((pg_temp.item(:'qr', :'q1') ->> 'lng')::float8 - :px::float8) < 1e-9, 'queue: lng is the true point');
select ok((select (x ->> 'lng')::float8 <> (x ->> 'public_lng')::float8 or (x ->> 'lat')::float8 <> (x ->> 'public_lat')::float8
           from (select pg_temp.item(:'qr', :'q2') x) s)
          or (select st_equals(location::extensions.geometry, public_location::extensions.geometry) from public.reports where id = :'q2'),
  'queue: hazard shows both points');
select ok(abs((pg_temp.item(:'qr', :'q2') ->> 'public_lng')::float8
              - (select st_x(public_location::extensions.geometry) from public.reports where id = :'q2')) < 1e-9,
  'queue: public_lng is the published point');
select is(pg_temp.item(:'qr', :'q1') -> 'author' ->> 'display_name', 'สมหญิง ทดสอบ', 'queue: real name even when hidden');
select is(pg_temp.item(:'qr', :'q1') -> 'author' ->> 'email', 'm7a@x.test', 'queue: author email');
select is(pg_temp.item(:'qr', :'q1') ->> 'hide_author', 'true', 'queue: hide_author shown');
select is(pg_temp.item(:'qr', :'q1') ->> 'profanity_flag', 'true', 'queue: profanity_flag shown');
select is(pg_temp.item(:'qr', :'q1') -> 'tags', '["ถนน", "หลุม"]'::jsonb, 'queue: tags');
select is(pg_temp.item(:'qr', :'q1') ->> 'category', 'road', 'queue: category slug');
select is(jsonb_array_length(pg_temp.item(:'qr', :'q1') -> 'photos'), 2, 'queue: both photos');
select is((select array_agg(x ->> 'path' order by o) from jsonb_array_elements(pg_temp.item(:'qr', :'q1') -> 'photos') with ordinality t(x, o)),
          (select array_agg(storage_path order by created_at, id) from public.report_photos where report_id = :'q1'),
  'queue: photos are PhotoRefs in order');
select ok(not (pg_temp.item(:'qr', :'q1') -> 'photos' -> 0 ? 'url'), 'queue: no URL from the database');

-- ================================================================ claims queue
select pg_temp.open(:'a', :'adm', :px, :py) as rc \gset
select pg_temp.photo(:'b') as b_ph \gset
select public.create_fix_claim(:'b', :'rc', 'ซ่อมแล้ว', :'b_ph', 1000) ->> 'claim_id' as cl1 \gset
select pg_temp.open(:'a', :'adm', :px, :py) as rch \gset
select public.create_fix_claim(:'c', :'rch', null, null, 1000) ->> 'claim_id' as cl_hidden \gset
select public.admin_hide(:'adm', 'report', :'rch') is not null as x \gset
select pg_temp.open(:'a', :'adm', :px, :py) as rcd \gset
select public.create_fix_claim(:'c', :'rcd', null, null, 1000) ->> 'claim_id' as cl_done \gset
select public.admin_review_fix_claim(:'adm', :'cl_done', false) is not null as x \gset

select public.admin_queue_claims(500) as qc \gset
select ok(pg_temp.item(:'qc', :'cl1') is not null, 'claims: a pending claim is listed');
select is(pg_temp.item(:'qc', :'cl1') -> 'photo' ->> 'path', :'b' || '/' || :'b_ph' || '.webp', 'claims: claim photo path');
select is(pg_temp.item(:'qc', :'cl1') -> 'claimant' ->> 'email', 'm7b@x.test', 'claims: claimant');
select is(pg_temp.item(:'qc', :'cl1') ->> 'note', 'ซ่อมแล้ว', 'claims: note');
select is(pg_temp.item(:'qc', :'cl1') -> 'report' ->> 'id', :'rc'::text, 'claims: its report');
select is(jsonb_array_length(pg_temp.item(:'qc', :'cl1') -> 'report' -> 'photos'), 1, 'claims: report before photos');
select ok(pg_temp.item(:'qc', :'cl1') -> 'report' ? 'days_open', 'claims: days_open');
select ok(pg_temp.item(:'qc', :'cl_hidden') is null, 'claims: the claim of a hidden report is not listed');
select ok(pg_temp.item(:'qc', :'cl_done') is null, 'claims: a reviewed claim is not listed');

-- ================================================================ flags queue
select pg_temp.open(:'a', :'adm', :px, :py) as rf \gset
select public.create_flag(:'b', 'report', :'rf', 'spam', 'โฆษณา', 1000) ->> 'flag_id' as ff1 \gset
select public.create_flag(:'c', 'report', :'rf', 'false', null, 1000) ->> 'flag_id' as ff2 \gset
update public.flags set created_at = now() - interval '1 hour' where id = :'ff1';
select (select comment_id from public.add_comment(:'rf', :'c', 'ความเห็นที่ถูกรายงาน', 1000)) as cmf \gset
select public.create_flag(:'b', 'comment', :'cmf', 'personal_attack', null, 1000) ->> 'flag_id' as ffc \gset
select pg_temp.open(:'a', :'adm', :px, :py) as rfd \gset
select public.create_flag(:'b', 'report', :'rfd', 'spam', null, 1000) ->> 'flag_id' as ffd \gset
select public.admin_resolve_flags(:'adm', :'ffd', 'dismiss') is not null as x \gset

select public.admin_queue_flags(500) as qf \gset
create temp table qf as select x from jsonb_array_elements(:'qf'::jsonb) x;
select is((select count(*)::int from qf where x ->> 'target_id' = :'rf'), 1, 'flags: one item per target');
select is((select jsonb_array_length(x -> 'flags') from qf where x ->> 'target_id' = :'rf'), 2, 'flags: both flags listed');
select is((select x ->> 'flag_id' from qf where x ->> 'target_id' = :'rf'), :'ff1'::text, 'flags: flag_id is the oldest open flag');
select is((select x -> 'flags' -> 0 ->> 'reason' from qf where x ->> 'target_id' = :'rf'), 'spam', 'flags: reasons oldest first');
select is((select x -> 'flags' -> 0 ->> 'note' from qf where x ->> 'target_id' = :'rf'), 'โฆษณา', 'flags: note');
select ok((select x -> 'flags' -> 0 ? 'reporter_name' from qf where x ->> 'target_id' = :'rf'), 'flags: reporter name');
select is((select x ->> 'hidden' from qf where x ->> 'target_id' = :'rf'), 'false', 'flags: hidden is false');
select is((select x -> 'author' ->> 'id' from qf where x ->> 'target_id' = :'rf'), :'a'::text, 'flags: report owner');
select ok((select x -> 'comment' = 'null'::jsonb from qf where x ->> 'target_id' = :'rf'), 'flags: no comment for a report');
select is((select x -> 'comment' ->> 'body' from qf where x ->> 'target_id' = :'cmf'), 'ความเห็นที่ถูกรายงาน', 'flags: comment body');
select is((select x -> 'author' ->> 'id' from qf where x ->> 'target_id' = :'cmf'), :'c'::text, 'flags: comment author is the owner');
select is((select x -> 'report' ->> 'id' from qf where x ->> 'target_id' = :'cmf'), :'rf'::text, 'flags: the comment''s report');
select is((select x -> 'report' ->> 'status' from qf where x ->> 'target_id' = :'rf'), 'open', 'flags: report status');
select ok(not exists (select 1 from qf where x ->> 'target_id' = :'rfd'), 'flags: dismissed flags do not list the target');
select public.admin_hide(:'adm', 'report', :'rf') is not null as x \gset
select is((select x ->> 'hidden' from jsonb_array_elements(public.admin_queue_flags(500)) x where x ->> 'target_id' = :'rf'), 'true',
  'flags: hidden follows the target');

-- ================================================================ hidden list
select public.admin_hide(:'adm', 'comment', :'cmf') is not null as x \gset
select public.admin_hidden(500) as qh \gset
select ok(exists (select 1 from jsonb_array_elements(:'qh'::jsonb) x where x ->> 'target_type' = 'report' and x ->> 'target_id' = :'rf'),
  'hidden: the report');
select ok(exists (select 1 from jsonb_array_elements(:'qh'::jsonb) x
                  where x ->> 'target_type' = 'comment' and x ->> 'target_id' = :'cmf' and x -> 'comment' ->> 'body' = 'ความเห็นที่ถูกรายงาน'),
  'hidden: the comment with its body');
select ok((select x -> 'report' -> 'photo' = 'null'::jsonb from jsonb_array_elements(:'qh'::jsonb) x
           where x ->> 'target_id' = :'cmf'),
  'hidden: a comment without a photo shows none (never the public cover)');
select public.admin_restore(:'adm', 'report', :'rf') is not null as x \gset
select ok(not exists (select 1 from jsonb_array_elements(public.admin_hidden(500)) x where x ->> 'target_id' = :'rf'),
  'hidden: a restored report leaves the list');

-- ================================================================ counts
select is((select reports - :c0_reports from public.admin_counts()), 2, 'counts: two more pending reports');
select is((select claims - :c0_claims from public.admin_counts()), 1, 'counts: one more reviewable claim');
select is((select flags - :c0_flags from public.admin_counts()), 2, 'counts: two more flagged targets');

-- ================================================================ users
select public.admin_set_ban(:'adm', :'c', true) is not null as x \gset
select ok(exists (select 1 from jsonb_array_elements(public.admin_users('7a@x.te')) x where x ->> 'id' = :'a'), 'users: middle of the email');
select ok(exists (select 1 from jsonb_array_elements(public.admin_users('หญิง')) x where x ->> 'id' = :'a'), 'users: middle of the name');
select is(jsonb_array_length(public.admin_users('%')), 0, 'users: % is a literal');
select is(jsonb_array_length(public.admin_users('', 3)), 3, 'users: blank query is capped by the limit');
select is(jsonb_array_length(public.admin_users(null, 1000)),
          least((select count(*)::int from public.profiles), 100), 'users: limit clamped to 100');
select ok((select x ->> 'banned_at' is not null from jsonb_array_elements(public.admin_users('m7c@')) x where x ->> 'id' = :'c'), 'users: banned_at');
select is((select (x ->> 'report_count')::int from jsonb_array_elements(public.admin_users('m7a@')) x where x ->> 'id' = :'a'),
          (select count(*)::int from public.reports where author_id = :'a'), 'users: report_count');
select is((select (x ->> 'comment_count')::int from jsonb_array_elements(public.admin_users('m7c@')) x where x ->> 'id' = :'c'),
          1, 'users: comment_count');
select is((select x ->> 'role' from jsonb_array_elements(public.admin_users('m7admin')) x where x ->> 'id' = :'adm'), 'admin', 'users: role');

-- ================================================================ log
select public.admin_log(null, 500) as lg \gset
select ok((select bool_and(a > b) from (select (x ->> 'id')::bigint a, lead((x ->> 'id')::bigint) over (order by o) b
                                        from jsonb_array_elements(:'lg'::jsonb) with ordinality t(x, o)) s where b is not null),
  'log: newest first');
select (:'lg'::jsonb -> 2 ->> 'id') as third_id \gset
select is((select count(*)::int from jsonb_array_elements(public.admin_log(:'third_id'::bigint, 500)) x
           where (x ->> 'id')::bigint >= :'third_id'::bigint), 0, 'log: before pages backwards');
select is(jsonb_array_length(public.admin_log(null, 2)), 2, 'log: limit');
select public.create_flag(:'a', 'report', :'o1', 'spam', null, 1000) is not null as x \gset
select public.create_flag(:'b', 'report', :'o1', 'spam', null, 1000) is not null as x \gset
select public.create_flag(:'adm', 'report', :'o1', 'spam', null, 1000) is not null as x \gset
select ok((select x -> 'admin_name' = 'null'::jsonb from jsonb_array_elements(public.admin_log(null, 50)) x
           where x ->> 'action' = 'auto_hide' and x ->> 'target_id' = :'o1'), 'log: the system has no admin_name');
select ok((select x ->> 'admin_name' is not null from jsonb_array_elements(public.admin_log(null, 50)) x
           where x ->> 'action' = 'ban' and x ->> 'target_id' = :'c'), 'log: an admin action has the admin name');

-- ================================================================ privileges
select tests.as_anon();
select throws_ok($q$select * from public.admin_counts()$q$, '42501', null, 'anon: admin_counts');
select throws_ok($q$select public.admin_queue_reports()$q$, '42501', null, 'anon: admin_queue_reports');
select throws_ok($q$select public.admin_queue_claims()$q$, '42501', null, 'anon: admin_queue_claims');
select throws_ok($q$select public.admin_queue_flags()$q$, '42501', null, 'anon: admin_queue_flags');
select throws_ok($q$select public.admin_hidden()$q$, '42501', null, 'anon: admin_hidden');
select throws_ok($q$select public.admin_users('a')$q$, '42501', null, 'anon: admin_users');
select throws_ok($q$select public.admin_log(null)$q$, '42501', null, 'anon: admin_log');
select tests.as_user(:'a');
select throws_ok($q$select * from public.admin_counts()$q$, '42501', null, 'member: admin_counts');
select throws_ok($q$select public.admin_queue_reports()$q$, '42501', null, 'member: admin_queue_reports');
select throws_ok($q$select public.admin_queue_claims()$q$, '42501', null, 'member: admin_queue_claims');
select throws_ok($q$select public.admin_queue_flags()$q$, '42501', null, 'member: admin_queue_flags');
select throws_ok($q$select public.admin_hidden()$q$, '42501', null, 'member: admin_hidden');
select throws_ok($q$select public.admin_users('a')$q$, '42501', null, 'member: admin_users');
select throws_ok($q$select public.admin_log(null)$q$, '42501', null, 'member: admin_log');
select tests.as_owner();

select * from finish();
rollback;
