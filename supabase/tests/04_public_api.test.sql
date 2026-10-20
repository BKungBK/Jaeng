begin;
select plan(20);

-- Start from an empty map; the demo seed comes back when the transaction rolls back.
delete from public.reports;
delete from public.tags;

select tests.create_user('author@x.test') as author \gset

-- One report per status, all in Bangkok, plus one level-3 report in Chiang Mai.
create temp table r (k text primary key, id uuid);
create function pg_temp.mk(k text, status text, lvl int, lng float8, lat float8, title text,
                          approved interval, resolved interval, hide boolean)
returns void language plpgsql as $$
declare v uuid;
begin
  insert into public.reports (author_id, category_id, danger_level, title, status, location,
                              approved_at, resolved_at, hide_author)
  values (current_setting('t.author')::uuid, 1, lvl, title, status,
          extensions.st_point(lng, lat, 4326)::extensions.geography,
          now() - approved, now() - resolved, hide)
  returning id into v;
  insert into r values (k, v);
end $$;
select set_config('t.author', :'author', true);

select pg_temp.mk('open',      'open',           2, 100.50, 13.75, 'หลุมลึกกลางถนนหน้าตลาด', interval '12 days', null, false);
select pg_temp.mk('claimed',   'fix_claimed',    1, 100.52, 13.76, 'ไฟถนนดับทั้งซอย',          interval '5 days',  null, false);
select pg_temp.mk('fresh',     'resolved',       0, 100.54, 13.77, 'ทางเท้าแตก',               interval '20 days', interval '3 days', false);
select pg_temp.mk('stale',     'resolved',       0, 100.55, 13.78, 'ท่อเก่าซ่อมแล้ว',            interval '60 days', interval '31 days', false);
select pg_temp.mk('pending',   'pending_review', 1, 100.56, 13.79, 'รอตรวจ',                   null, null, false);
select pg_temp.mk('rejected',  'rejected',       1, 100.57, 13.80, 'ถูกปฏิเสธ',                 null, null, false);
select pg_temp.mk('hidden',    'hidden',         1, 100.58, 13.81, 'ถูกซ่อน',                   interval '2 days', null, false);
select pg_temp.mk('anon',      'open',           1, 100.59, 13.82, 'ขยะล้นถัง',                 interval '1 day',  null, true);
select pg_temp.mk('cm',        'open',           3, 98.99, 18.79, 'กิ่งไม้ใหญ่พาดสายไฟ',        interval '1 day',  null, false);

insert into public.tags (name) values ('ซอย5') returning id as tag \gset
insert into public.report_tags select id, :tag from r where k = 'claimed';

-- public_reports
select set_eq(
  $$select r.k from public.public_reports p join r on r.id = p.id$$,
  $$values ('open'), ('claimed'), ('fresh'), ('stale'), ('anon'), ('cm')$$,
  'public_reports has open, fix_claimed and resolved of any age (plan 6: /list and old links)'
);
select is((select author_name from public.public_reports where id = (select id from r where k = 'anon')), null,
  'hidden author has no name');
select isnt((select author_name from public.public_reports where id = (select id from r where k = 'open')), null,
  'visible author has a name');
select hasnt_column('public', 'public_reports', 'author_id', 'no author_id exposed');
select hasnt_column('public', 'public_reports', 'location', 'no true location exposed');
select is((select days_open from public.public_reports where id = (select id from r where k = 'open')), 12,
  'days_open counts from approval');
select is((select tags from public.public_reports where id = (select id from r where k = 'claimed')), array['ซอย5'],
  'tags are listed');

-- reports_in_bbox
select is(
  (select jsonb_array_length(public.reports_in_bbox(100.4, 13.7, 100.7, 13.9) -> 'features')),
  3, 'Bangkok bbox: open + fix_claimed + anon (default statuses)');
select is(
  (select public.reports_in_bbox(100.4, 13.7, 100.7, 13.9) ->> 'type'), 'FeatureCollection',
  'result is a FeatureCollection');
select is(
  (select jsonb_array_length(public.reports_in_bbox(97, 5, 106, 21, levels => '{3}') -> 'features')),
  1, 'level filter keeps only level 3');
select is(
  (select public.reports_in_bbox(97, 5, 106, 21, levels => '{3}') -> 'features' -> 0 -> 'properties' ->> 'title'),
  'กิ่งไม้ใหญ่พาดสายไฟ', 'feature carries its title');
select is(
  (select jsonb_array_length(public.reports_in_bbox(97, 5, 106, 21, q => 'หลุม') -> 'features')),
  1, 'Thai substring search matches the title');
select is(
  (select jsonb_array_length(public.reports_in_bbox(97, 5, 106, 21, q => '#ซอย5') -> 'features')),
  1, 'tag search matches #ซอย5');
select is(
  (select jsonb_array_length(public.reports_in_bbox(97, 5, 106, 21, statuses => '{resolved}') -> 'features')),
  1, 'resolved older than 30 days stays off the map');
select is(
  (select jsonb_array_length(public.reports_in_bbox(97, 5, 106, 21, categories => '{waste}') -> 'features')),
  0, 'category filter by slug');

-- The web app sends the whole world when the globe view wraps (toBbox). A geography envelope
-- from -180 to 180 collapses to nothing, so these compare in planar geometry.
select is(
  (select jsonb_array_length(public.reports_in_bbox(-180, -85, 180, 85) -> 'features')),
  (select jsonb_array_length(public.reports_in_bbox(97, 5, 106, 21) -> 'features')),
  'the world box finds every report Thailand has');
select is(
  (select jsonb_array_length(public.reports_in_bbox(20, 6.5, 180, 40) -> 'features')),
  (select jsonb_array_length(public.reports_in_bbox(97, 5, 106, 21) -> 'features')),
  'a very wide box keeps points near its south edge');
select is(
  (select open_count from public.stats_in_bbox(-180, -85, 180, 85)),
  (select open_count from public.stats_in_bbox(97, 5, 106, 21)),
  'stats over the world box match Thailand');

-- stats_in_bbox: Bangkok has 1 resolved this month (fresh, if inside this month) and 3 open-ish.
select is(
  (select open_count from public.stats_in_bbox(100.4, 13.7, 100.7, 13.9)),
  3, 'open_count counts open and fix_claimed');
-- 'fresh' was resolved 3 days ago and 'stale' 31 days ago; only this calendar month counts.
select is(
  (select resolved_this_month from public.stats_in_bbox(100.4, 13.7, 100.7, 13.9)),
  (case when now() - interval '3 days' >= date_trunc('month', now()) then 1 else 0 end),
  'resolved_this_month counts only this calendar month');

select * from finish();
rollback;
