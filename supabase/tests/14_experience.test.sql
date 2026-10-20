begin;
select plan(28);

-- Start from an empty map; the demo seed comes back when the transaction rolls back.
delete from public.reports;

select tests.create_user('exp-author@x.test') as author \gset
select tests.create_user('exp-member@x.test') as member \gset
select set_config('t.author', :'author', true);

create temp table r (k text primary key, id uuid);
create function pg_temp.mk(k text, status text, lvl int, lng float8, lat float8,
                          approved timestamptz, resolved timestamptz, cat int default 1, confirms int default 0)
returns void language plpgsql as $$
declare v uuid;
begin
  insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at, resolved_at)
  values (current_setting('t.author')::uuid, cat, lvl, 'เรื่อง ' || k, status,
          extensions.st_point(lng, lat, 4326)::extensions.geography, approved, resolved)
  returning id into v;
  update public.reports set confirm_count = confirms where id = v;
  insert into r values (k, v);
end $$;

-- Bangkok: the list cases, west to east
select pg_temp.mk('open1',   'open',           2, 100.50, 13.75, now() - interval '12 days', null, 1, 9);
select pg_temp.mk('open2',   'open',           3, 100.51, 13.75, now() - interval '2 days',  null);
select pg_temp.mk('claimed', 'fix_claimed',    1, 100.52, 13.75, now() - interval '5 days',  null);
select pg_temp.mk('fresh',   'resolved',       0, 100.53, 13.75, now() - interval '20 days', now() - interval '3 days');
select pg_temp.mk('stale',   'resolved',       0, 100.54, 13.75, now() - interval '90 days', now() - interval '60 days');
select pg_temp.mk('pending', 'pending_review', 1, 100.55, 13.75, null, null);
select pg_temp.mk('reject',  'rejected',       1, 100.56, 13.75, null, null);
select pg_temp.mk('hidden',  'hidden',         1, 100.57, 13.75, now() - interval '2 days', null);

-- Thai month edges: resolved 30 minutes either side of the first instant of this month in Bangkok
select date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok' as ms \gset
select pg_temp.mk('before_month', 'resolved', 0, 99.00, 18.80, :'ms'::timestamptz - interval '10 days',
                  :'ms'::timestamptz - interval '30 minutes');
select pg_temp.mk('after_month',  'resolved', 0, 99.50, 18.80, :'ms'::timestamptz - interval '10 days',
                  :'ms'::timestamptz + interval '30 minutes');

-- ================================================================ stats_in_bbox
select is((select resolved_this_month from public.stats_in_bbox(98.9, 18.7, 99.1, 18.9)), 0,
  'a report fixed 30 minutes before the Thai month began is last month');
select is((select resolved_this_month from public.stats_in_bbox(99.4, 18.7, 99.6, 18.9)), 1,
  'a report fixed 30 minutes after the Thai month began is this month');

-- ================================================================ public_reports / reports_in_bbox
select ok(exists (select 1 from public.public_reports where id = (select id from r where k = 'stale')),
  'public_reports keeps a report fixed 60 days ago (its link still opens)');
select is(
  (select jsonb_array_length(public.reports_in_bbox(100.4, 13.7, 100.7, 13.8, statuses => '{resolved}') -> 'features')),
  1, 'the map still drops reports fixed more than 30 days ago');

-- ================================================================ list_reports
create function pg_temp.keys(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(r.k order by x.n), '{}')
  from jsonb_array_elements(j) with ordinality x(e, n)
  join r on r.id = (x.e ->> 'id')::uuid;
$$;

select set_eq(
  $$select unnest(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8)))$$,
  $$values ('open1'), ('open2'), ('claimed'), ('fresh')$$,
  'default list: open, fix_claimed and recently fixed only');
select set_eq(
  $$select unnest(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, include_old_resolved => true)))$$,
  $$values ('open1'), ('open2'), ('claimed'), ('fresh'), ('stale')$$,
  'include_old_resolved adds the report fixed 60 days ago');
select set_eq(
  $$select unnest(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8,
      statuses => '{open,fix_claimed,resolved,pending_review,rejected,hidden}', include_old_resolved => true)))$$,
  $$values ('open1'), ('open2'), ('claimed'), ('fresh'), ('stale')$$,
  'never pending, rejected or hidden, whatever statuses are asked');
select is(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, statuses => '{resolved}')), array['fresh'],
  'statuses filter');
select is(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, levels => '{3}')), array['open2'],
  'levels filter');

select is(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8)),
  array['open2', 'claimed', 'open1', 'fresh'], 'new: newest approval first');
select is((pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'confirms')))[1], 'open1',
  'confirms: most confirmed first');
select is((pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'oldest')))[1:2],
  array['open1', 'open2'], 'oldest: open reports first, the longest open at the top');
select is(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'near', near_lng => 100.535, near_lat => 13.75)),
  array['fresh', 'claimed', 'open2', 'open1'], 'near: nearest first');
select ok((select bool_and((e ->> 'distance_m') is not null and (e ->> 'distance_m')::float8 >= 0)
           from jsonb_array_elements(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'near',
                                                         near_lng => 100.535, near_lat => 13.75)) e),
  'near: every row has a distance');
select is(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'near')),
  pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'new')), 'near without a point is new');
select ok((select bool_and(e -> 'distance_m' = 'null'::jsonb)
           from jsonb_array_elements(public.list_reports(100.4, 13.7, 100.7, 13.8)) e),
  'no distance without a point');
select is(pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'bogus')),
  pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8)), 'an unknown sort is new');

select is(
  pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, p_limit => 2, p_offset => 0))
    || pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, p_limit => 2, p_offset => 2)),
  pg_temp.keys(public.list_reports(100.4, 13.7, 100.7, 13.8, p_limit => 4)),
  'two pages of two are the first page of four, with no repeats');

-- 105 open reports in Khon Kaen
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
select :'author'::uuid, 1, 0, 'กอง ' || g, 'open',
       extensions.st_point(102.8 + g * 0.0001, 16.4, 4326)::extensions.geography, now() - make_interval(mins => g)
from generate_series(1, 105) g;
select is(jsonb_array_length(public.list_reports(102.7, 16.3, 102.9, 16.5, p_limit => 1000)), 100,
  'the page size is clamped to 100');
select is(jsonb_array_length(public.list_reports(102.7, 16.3, 102.9, 16.5, p_offset => -5)), 50,
  'a negative offset starts at the top, 50 by default');

select ok(not exists (select 1 from jsonb_array_elements(public.list_reports(100.4, 13.7, 100.7, 13.8)) e
                      where e ? 'location' or e ? 'lng' or e ? 'lat'),
  'rows carry no coordinates');

-- a hazard's distance is measured from the point the map shows, never the true one
select pg_temp.mk('hazard', 'open', 2, 100.60, 13.75, now() - interval '1 day', null, 7);
select ok((select abs((e ->> 'distance_m')::float8
                      - extensions.st_distance(rp.public_location, extensions.st_point(100.60, 13.75, 4326)::extensions.geography)) < 1
           from jsonb_array_elements(public.list_reports(100.4, 13.7, 100.7, 13.8, sort => 'near',
                                                         near_lng => 100.60, near_lat => 13.75)) e
           join public.reports rp on rp.id = (e ->> 'id')::uuid
           where rp.id = (select id from r where k = 'hazard')),
  'hazard distance uses the displayed point');

-- ================================================================ search_areas
select is((select level from public.search_areas('เชียงใหม่') limit 1), 1::smallint, 'a province comes first');
select ok(exists (select 1 from public.search_areas('Mueang Chiang Mai') where name_en = 'Mueang Chiang Mai'
                  and province_en = 'Chiang Mai' and province_th = 'เชียงใหม่'),
  'English district names match, with their province in both languages');
select is((select count(*)::int from public.search_areas('%')) + (select count(*)::int from public.search_areas('_')), 0,
  'LIKE wildcards are literal');
select is((select count(*)::int from public.search_areas(' a ')), 0, 'under two characters finds nothing');

select tests.as_anon();
select throws_ok($q$select * from public.search_areas('เชียงใหม่')$q$, '42501', null, 'anon cannot call search_areas');
select tests.as_user(:'member');
select throws_ok($q$select * from public.search_areas('เชียงใหม่')$q$, '42501', null, 'members cannot call search_areas');
select tests.as_owner();

select * from finish();
rollback;
