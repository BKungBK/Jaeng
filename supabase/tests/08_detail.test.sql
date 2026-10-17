begin;
select plan(26);

-- Start from an empty map; the demo seed comes back when the transaction rolls back.
delete from public.reports;

select tests.create_user('a@x.test') as a \gset
select tests.create_user('b@x.test') as b \gset

-- r1: author hidden · r2: normal, with photos · r3 pending · r4 resolved · r5 hidden
insert into public.reports (author_id, category_id, danger_level, title, status, hide_author, location, approved_at)
values (:'a', 1, 1, 'เรื่องปิดชื่อ', 'open', true, extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now())
returning id as r1 \gset
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'เรื่องเปิดชื่อ', 'open', extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now())
returning id as r2 \gset
insert into public.reports (author_id, category_id, danger_level, title, location)
values (:'a', 1, 1, 'เรื่องรอตรวจ', extensions.st_point(100.5, 13.7, 4326)::extensions.geography)
returning id as r3 \gset
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at, resolved_at)
values (:'a', 1, 1, 'เรื่องแก้แล้ว', 'resolved', extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now(), now())
returning id as r4 \gset
insert into public.reports (author_id, category_id, danger_level, title, status, location, approved_at)
values (:'a', 1, 1, 'เรื่องที่ถูกซ่อน', 'hidden', extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now())
returning id as r5 \gset

insert into public.report_photos (report_id, uploader_id, kind, storage_path, width, height, created_at) values
  (:'r2', :'a', 'before',  'p/before.jpg',  800, 600, now() - interval '2 minutes'),
  (:'r2', :'a', 'after',   'p/after.jpg',   800, 600, now() - interval '1 minute'),
  (:'r2', :'b', 'comment', 'p/comment.jpg', 800, 600, now());

insert into public.comments (report_id, author_id, body) values
  (:'r1', :'a', 'ผมเป็นคนแจ้งเอง'),
  (:'r1', :'b', 'ผ่านมาเจอเหมือนกัน'),
  (:'r2', :'a', 'แจ้งโดยเปิดชื่อ');

-- Anonymous reporter on r1
select is((select author_name from public.public_comments where report_id = :'r1' and body = 'ผมเป็นคนแจ้งเอง'),
  null, 'hidden-author reporter comment has no name');
select ok((select by_reporter from public.public_comments where report_id = :'r1' and body = 'ผมเป็นคนแจ้งเอง'),
  'hidden-author reporter comment is flagged by_reporter');
select isnt((select author_name from public.public_comments where report_id = :'r1' and body = 'ผ่านมาเจอเหมือนกัน'),
  null, 'other commenter keeps their name');
select ok(not (select by_reporter from public.public_comments where report_id = :'r1' and body = 'ผ่านมาเจอเหมือนกัน'),
  'other commenter is not by_reporter');
select isnt((select author_name from public.public_comments where report_id = :'r2'),
  null, 'open-author reporter comment shows name');
select ok((select by_reporter from public.public_comments where report_id = :'r2'),
  'open-author reporter comment is by_reporter');

-- toggle_confirmation
select ok((select confirmed from public.toggle_confirmation(:'r2', :'b')), 'first toggle confirms');
select is((select confirm_count from public.reports where id = :'r2'), 1, 'count is 1 after confirming');
select ok(not (select confirmed from public.toggle_confirmation(:'r2', :'b')), 'second toggle removes it');
select is((select confirm_count from public.reports where id = :'r2'), 0, 'count back to 0');
select throws_ok(format($q$select * from public.toggle_confirmation(%L, %L)$q$, :'r3', :'b'),
  'P0001', 'report_not_found', 'pending report cannot be confirmed');
select throws_ok(format($q$select * from public.toggle_confirmation(%L, %L)$q$, :'r4', :'b'),
  'P0001', 'report_resolved', 'resolved report cannot be confirmed');

-- add_comment
select throws_ok(format($q$select * from public.add_comment(%L, %L, %L)$q$, :'r2', :'b', '   '),
  '23514', null, 'blank comment is rejected');
select throws_ok(format($q$select * from public.add_comment(%L, %L, %L)$q$, :'r5', :'b', 'hi'),
  'P0001', 'report_not_found', 'hidden report cannot be commented');
select is((select comment_count from public.add_comment(:'r2', :'b', '  สวัสดี  ')),
  2, 'comment added and counted');

-- Roles cannot call the functions
select tests.as_anon();
select throws_ok(format($q$select * from public.toggle_confirmation(%L, %L)$q$, :'r2', :'b'),
  '42501', null, 'anon cannot toggle');
select throws_ok(format($q$select * from public.add_comment(%L, %L, %L)$q$, :'r2', :'b', 'hi'),
  '42501', null, 'anon cannot comment');
select tests.as_user(:'a');
select throws_ok(format($q$select * from public.toggle_confirmation(%L, %L)$q$, :'r2', :'a'),
  '42501', null, 'member cannot toggle through SQL');
select throws_ok(format($q$select * from public.add_comment(%L, %L, %L)$q$, :'r2', :'a', 'hi'),
  '42501', null, 'member cannot comment through SQL');
select tests.as_owner();

-- Own confirmations only
insert into public.confirmations (report_id, user_id) values (:'r1', :'a'), (:'r1', :'b'), (:'r2', :'b');
select tests.as_user(:'a');
select is((select count(*)::int from public.confirmations), 1, 'A reads only own confirmations');
select tests.as_owner();

-- photos
select is((select photos from public.public_reports where id = :'r1'), '[]'::jsonb, 'no photos is an empty array');
select is((select jsonb_array_length(photos) from public.public_reports where id = :'r2'), 2,
  'only before/after photos are exposed');

-- The public views never expose who wrote something or the raw location column
select hasnt_column('public', 'public_reports', 'author_id', 'public_reports has no author_id');
select hasnt_column('public', 'public_reports', 'location', 'public_reports has no location column');
select hasnt_column('public', 'public_comments', 'author_id', 'public_comments has no author_id');
select hasnt_column('public', 'public_comments', 'location', 'public_comments has no location column');

select * from finish();
rollback;
