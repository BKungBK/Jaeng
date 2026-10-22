begin;
select plan(26);

select tests.create_user('new@x.test') as a \gset
select tests.create_user('hider@x.test') as h \gset
select tests.create_user('admin@x.test') as adm \gset

-- ---------------------------------------------------------------- columns and the bucket
select has_column('public', 'profiles', 'avatar_path', 'profiles.avatar_path exists');
select has_column('public', 'profiles', 'onboarded_at', 'profiles.onboarded_at exists');
select is((select onboarded_at from public.profiles where id = :'a'), null, 'a new member is not onboarded yet');
select is((select count(*)::int from public.profiles pf join auth.users u on u.id = pf.id
            where u.email like '%@jaeng.local' and pf.onboarded_at is null),
          0, 'demo members never see the profile step');
select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'$$,
  $$values (true, 1048576::bigint, array['image/webp'])$$,
  'avatars bucket: public, 1 MB, webp only');

-- ---------------------------------------------------------------- clients cannot write the new columns
select tests.as_user(:'a');
select throws_ok($$update public.profiles set avatar_path = 'x' where id = auth.uid()$$, '42501', null,
  'a member cannot write avatar_path directly');
select throws_ok($$update public.profiles set onboarded_at = now() where id = auth.uid()$$, '42501', null,
  'a member cannot write onboarded_at directly');
select lives_ok($$update public.profiles set locale = 'en' where id = auth.uid()$$, 'locale is still theirs');
select throws_ok($$select public.set_avatar(auth.uid(), 'x', 5)$$, '42501', null, 'set_avatar is not callable by members');
select throws_ok($$select public.complete_profile(auth.uid(), 'ชื่อ')$$, '42501', null, 'complete_profile is not callable by members');
select tests.as_owner();

-- ---------------------------------------------------------------- set_avatar
select is(public.set_avatar(:'a', 'a/1.webp', 2), null, 'first picture: nothing to replace');
select is((select avatar_path from public.profiles where id = :'a'), 'a/1.webp', 'the path is stored');
select is(public.set_avatar(:'a', 'a/2.webp', 2), 'a/1.webp', 'a new picture returns the one it replaces');
select throws_ok($$select public.set_avatar('$$ || :'a' || $$', 'a/3.webp', 2)$$, 'P0001', 'rate_limited',
  'the third picture inside 24 hours is refused');
select is((select avatar_path from public.profiles where id = :'a'), 'a/2.webp', 'a refused picture changes nothing');
select is(public.set_avatar(:'a', null, 2), 'a/2.webp', 'clearing is never limited and returns the old path');
select is(public.set_avatar(:'a', null, 2), null, 'clearing twice is fine');

-- ---------------------------------------------------------------- complete_profile
select public.complete_profile(:'a', 'น้องเมย์');
select is((select display_name from public.profiles where id = :'a'), 'น้องเมย์', 'the nickname is the display name');
select isnt((select onboarded_at from public.profiles where id = :'a'), null, 'the profile is marked set up');
create temp table first_time as select onboarded_at from public.profiles where id = :'a';
select public.complete_profile(:'a', 'เมย์');
select is((select onboarded_at from public.profiles where id = :'a'), (select onboarded_at from first_time),
  'completing again keeps the first time');

-- ---------------------------------------------------------------- the picture follows the name in the public views
select public.set_avatar(:'h', 'h/1.webp', 5);
insert into public.reports (id, author_id, category_id, danger_level, title, status, location, approved_at, hide_author)
values ('00000000-0000-0000-0000-0000000000c1', :'h', 1, 1, 'ซ่อนชื่อ', 'open',
        extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now(), true),
       ('00000000-0000-0000-0000-0000000000c2', :'a', 1, 1, 'เปิดชื่อ', 'open',
        extensions.st_point(100.5, 13.7, 4326)::extensions.geography, now(), false);
select public.set_avatar(:'a', 'a/9.webp', 5);
select is((select author_avatar from public.public_reports where id = '00000000-0000-0000-0000-0000000000c1'), null,
  'a hidden author shows no picture');
select is((select author_avatar from public.public_reports where id = '00000000-0000-0000-0000-0000000000c2'), 'a/9.webp',
  'a named author shows the picture');
insert into public.comments (report_id, author_id, body)
values ('00000000-0000-0000-0000-0000000000c1', :'h', 'จากคนแจ้งที่ซ่อนชื่อ'),
       ('00000000-0000-0000-0000-0000000000c1', :'a', 'จากคนอื่น');
select is((select author_avatar from public.public_comments where body = 'จากคนแจ้งที่ซ่อนชื่อ'), null,
  'the hiding reporter''s own comment shows no picture');
select is((select author_avatar from public.public_comments where body = 'จากคนอื่น'), 'a/9.webp',
  'another member''s comment shows theirs');

-- ---------------------------------------------------------------- admin
select is(public.admin_remove_avatar(:'adm', :'a'), 'a/9.webp', 'an admin removing a picture gets the old path');
select is((select count(*)::int from public.moderation_log where action = 'remove_avatar' and target_id = :'a'), 1,
  'the removal is logged');

select * from finish();
rollback;
