begin;
select plan(14);

select tests.create_user('a@x.test') as a \gset
select tests.create_user('b@x.test') as b \gset

insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'เรื่องที่อนุมัติแล้ว', 'open', extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now());
insert into public.reports (author_id, category_id, danger_level, title, location)
values (:'a', 1, 1, 'เรื่องรอตรวจของ A', extensions.st_point(100.5, 13.7, 4326)::extensions.geography)
returning id as a_pending \gset
insert into public.reports (author_id, category_id, danger_level, title, location)
values (:'b', 1, 1, 'เรื่องรอตรวจของ B', extensions.st_point(100.5, 13.7, 4326)::extensions.geography)
returning id as b_pending \gset

-- Visitors
select tests.as_anon();
select is((select count(*)::int from public.reports), 0, 'anon reads no rows from reports');
select is((select count(*)::int from public.public_reports), 1, 'anon reads approved reports through the view');
select is((select count(*)::int from public.categories), 8, 'anon reads categories');
select lives_ok($$select public.reports_in_bbox(97, 5, 106, 21)$$, 'anon can call reports_in_bbox');
select is((select count(*)::int from public.profiles), 0, 'anon reads no profiles');
select throws_ok(
  $$insert into public.confirmations (report_id, user_id) select id, id from public.reports limit 1$$,
  '42501', null, 'anon cannot write confirmations');
select tests.as_owner();

-- Signed-in user A
select tests.as_user(:'a');
select ok(exists (select 1 from public.reports where id = :'a_pending'), 'A sees own pending report');
select ok(not exists (select 1 from public.reports where id = :'b_pending'), 'A does not see B''s pending report');
select lives_ok(
  format($q$update public.profiles set display_name = 'ใหม่นะ' where id = %L$q$, :'a'),
  'A renames themself');
select throws_ok(
  format($q$update public.profiles set role = 'admin' where id = %L$q$, :'a'),
  '42501', null, 'A cannot make themself admin');
select throws_ok(
  format($q$insert into public.reports (author_id, category_id, danger_level, title, location)
            values (%L, 1, 1, 'x', extensions.st_point(100.5, 13.7, 4326)::extensions.geography)$q$, :'a'),
  '42501', null, 'A cannot insert reports directly');
select throws_ok(
  format($q$insert into public.confirmations (report_id, user_id) values (%L, %L)$q$, :'a_pending', :'a'),
  '42501', null, 'A cannot insert confirmations directly');
select is((select count(*)::int from public.profiles where id = :'b'), 0, 'A cannot read B''s profile');
select tests.as_owner();

select is((select display_name from public.profiles where id = :'a'), 'ใหม่นะ', 'rename stuck');

select * from finish();
rollback;
