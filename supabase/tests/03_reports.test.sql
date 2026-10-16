begin;
select plan(14);

select tests.create_user('author@x.test') as author \gset
select tests.create_user('n1@x.test') as n1 \gset
select tests.create_user('n2@x.test') as n2 \gset

insert into public.reports (author_id, category_id, danger_level, title, location)
values (:'author', 1, 2, 'หลุมลึกกลางถนนหน้าตลาด',
        extensions.st_point(100.5018, 13.7563, 4326)::extensions.geography)
returning id as rid \gset

select matches((select place_name from public.reports where id = :'rid'), 'กรุงเทพมหานคร$',
  'place_name defaults to the district and province');
select ok((select extensions.st_equals(public_location::extensions.geometry, location::extensions.geometry)
           from public.reports where id = :'rid'),
  'public_location defaults to location');
select is((select status from public.reports where id = :'rid'), 'pending_review', 'new reports wait for review');

select throws_ok(
  format($q$insert into public.reports (author_id, category_id, danger_level, title, location)
            values (%L, 1, 4, 'x', extensions.st_point(100.5, 13.7, 4326)::extensions.geography)$q$, :'author'),
  '23514', null, 'danger_level 4 is rejected');
select throws_ok(
  format($q$update public.reports set status = 'foo' where id = %L$q$, :'rid'),
  '23514', null, 'unknown status is rejected');

-- "เจอเหมือนกัน" keeps confirm_count equal to the row count.
insert into public.confirmations (report_id, user_id) values (:'rid', :'n1'), (:'rid', :'n2');
select is((select confirm_count from public.reports where id = :'rid'), 2, 'two confirmations counted');
delete from public.confirmations where report_id = :'rid' and user_id = :'n1';
select is((select confirm_count from public.reports where id = :'rid'), 1, 'un-confirm decrements');
select throws_ok(
  format($q$insert into public.confirmations (report_id, user_id) values (%L, %L)$q$, :'rid', :'n2'),
  '23505', null, 'a user confirms a report at most once');
select is((select confirm_count from public.reports where id = :'rid'), 1, 'count unchanged after duplicate attempt');

-- Visible comments are counted; hidden ones are not.
insert into public.comments (report_id, author_id, body) values (:'rid', :'n1', 'เจอเหมือนกันเลยครับ')
returning id as cid \gset
select is((select comment_count from public.reports where id = :'rid'), 1, 'visible comment counted');
update public.comments set status = 'hidden' where id = :'cid';
select is((select comment_count from public.reports where id = :'rid'), 0, 'hidden comment not counted');

-- Only one pending fix claim per report.
insert into public.fix_claims (report_id, claimant_id) values (:'rid', :'n1');
select throws_ok(
  format($q$insert into public.fix_claims (report_id, claimant_id) values (%L, %L)$q$, :'rid', :'n2'),
  '23505', null, 'second pending fix claim is rejected');

-- fuzz_point stays within the radius.
select ok(
  (select bool_and(extensions.st_distance(
     public.fuzz_point(extensions.st_point(100.5, 13.7, 4326)::extensions.geography, 150),
     extensions.st_point(100.5, 13.7, 4326)::extensions.geography) <= 150)
   from generate_series(1, 50)),
  'fuzz_point stays within 150 m');

select ok(
  (select bool_or(extensions.st_distance(
     public.fuzz_point(extensions.st_point(100.5, 13.7, 4326)::extensions.geography, 150),
     extensions.st_point(100.5, 13.7, 4326)::extensions.geography) > 1)
   from generate_series(1, 50)),
  'fuzz_point actually moves the point');

select * from finish();
rollback;
