begin;
select * from no_plan();

-- Start from an empty map; the demo seed comes back when the transaction rolls back.
delete from public.reports;
delete from public.report_photos;

select tests.create_user('m6a@x.test') as a \gset
select tests.create_user('m6b@x.test') as b \gset
select tests.create_user('m6c@x.test') as c \gset
select tests.create_user('m6d@x.test') as d \gset
select tests.create_user('m6e@x.test') as e \gset
select tests.create_user('m6admin@x.test') as adm \gset
select tests.create_user('m6admin2@x.test') as adm2 \gset
update public.profiles set role = 'admin' where id in (:'adm', :'adm2');

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

-- A pending report of u with n fresh photos.
create function pg_temp.mk(u uuid, lng float8, lat float8, n int default 1) returns uuid
language sql as $$
  select id from public.create_report(u, 'road', lng, lat,
    array(select pg_temp.photo(u) from generate_series(1, n)), 'เรื่องทดสอบ', null, 1, null, false, false, 1000);
$$;

-- An approved (open) report of u with n photos.
create function pg_temp.open(u uuid, adm uuid, lng float8, lat float8, n int default 1) returns uuid
language plpgsql as $$
declare v uuid;
begin
  v := pg_temp.mk(u, lng, lat, n);
  perform public.admin_approve_report(adm, v, null, null, null, 'keep', null, null);
  return v;
end;
$$;

-- Is this storage path in any public_reports.photos?
create function pg_temp.in_public(p text) returns boolean
language sql as $$
  select exists (select 1 from public.public_reports pr, jsonb_array_elements(pr.photos) x where x ->> 'path' = p);
$$;

-- ================================================================ fix claims
select pg_temp.open(:'a', :'adm', :px, :py) as r_nophoto \gset
select pg_temp.open(:'a', :'adm', :px, :py) as r_photo \gset
select pg_temp.photo(:'b') as b_ph \gset

set local role service_role;
select public.create_fix_claim(:'b', :'r_nophoto', '  ', null, 1000) as fc1 \gset
select public.create_fix_claim(:'b', :'r_photo', ' ซ่อมแล้ว ', :'b_ph', 1000) as fc2 \gset
reset role;

select is((select status from public.reports where id = :'r_nophoto'), 'fix_claimed', 'claim: report becomes fix_claimed');
select is((select count(*)::int from public.fix_claims where report_id = :'r_nophoto' and status = 'pending'), 1,
  'claim: one pending claim');
select is(:'fc1'::jsonb -> 'report' ->> 'status', 'fix_claimed', 'claim: effect carries fix_claimed');
select ok(:'fc1'::jsonb ? 'claim_id', 'claim: result has claim_id');
select ok((select note is null from public.fix_claims where report_id = :'r_nophoto'), 'claim: blank note is null');
select is((select note from public.fix_claims where report_id = :'r_photo'), 'ซ่อมแล้ว', 'claim: note is trimmed');
select is((select report_id from public.report_photos where id = :'b_ph'), :'r_photo'::uuid, 'claim: photo joins the report');
select is((select kind from public.report_photos where id = :'b_ph'), 'claim', 'claim: photo kind is claim');
select ok((select storage_path like :'b' || '/%' from public.report_photos where id = :'b_ph'),
  'claim: photo stays in the claimant folder');
select ok(not pg_temp.in_public((select storage_path from public.report_photos where id = :'b_ph')),
  'claim: photo is not public');

select pg_temp.mk(:'a', :px, :py) as r_pending \gset
select pg_temp.open(:'a', :'adm', :px, :py) as r_open2 \gset
select pg_temp.photo(:'c') as c_ph \gset
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 1000)$q$, :'c', :'r_nophoto'),
  'P0001', 'claim_pending', 'claim: a second claim while one waits');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 1000)$q$, :'c', :'r_pending'),
  'P0001', 'report_not_found', 'claim: pending_review report');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 1000)$q$, :'c', gen_random_uuid()),
  'P0001', 'report_not_found', 'claim: missing report');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, %L, 1000)$q$, :'b', :'r_open2', :'c_ph'),
  'P0001', 'invalid_photos', 'claim: photo of another user');
select is((select status from public.reports where id = :'r_open2'), 'open', 'claim: failed claim changes nothing');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, %L, 1000)$q$, :'b', :'r_open2', :'b_ph'),
  'P0001', 'invalid_photos', 'claim: a photo already used');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, %L, null, 1000)$q$, :'c', :'r_open2', repeat('ก', 501)),
  'P0001', 'invalid_note', 'claim: note over 500');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, null)$q$, :'c', :'r_open2'),
  'P0001', 'rate_limited', 'claim: null quota counts as 0');

select pg_temp.open(:'a', :'adm', :px, :py) as r_q1 \gset
select pg_temp.open(:'a', :'adm', :px, :py) as r_q2 \gset
select lives_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 1)$q$, :'d', :'r_q1'),
  'claim: first claim within the quota');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 1)$q$, :'d', :'r_q2'),
  'P0001', 'rate_limited', 'claim: second claim over the quota');

-- ================================================================ claim review
select approved_at as nophoto_approved from public.reports where id = :'r_nophoto' \gset
select fc.id as claim_photo from public.fix_claims fc where fc.report_id = :'r_photo' \gset
select fc.id as claim_nophoto from public.fix_claims fc where fc.report_id = :'r_nophoto' \gset

set local role service_role;
select public.admin_review_fix_claim(:'adm', :'claim_photo', true) as rv1 \gset
select public.admin_review_fix_claim(:'adm', :'claim_nophoto', false) as rv2 \gset
reset role;

select is((select status from public.reports where id = :'r_photo'), 'resolved', 'review: approved claim resolves');
select ok((select resolved_at is not null from public.reports where id = :'r_photo'), 'review: resolved_at is set');
select is((select kind from public.report_photos where id = :'b_ph'), 'after', 'review: claim photo becomes after');
select is((select storage_path from public.report_photos where id = :'b_ph'), :'r_photo' || '/' || :'b_ph' || '.webp',
  'review: after photo moves to the report folder');
select is(:'rv1'::jsonb -> 'promote',
  jsonb_build_array(jsonb_build_object('from', :'b' || '/' || :'b_ph' || '.webp',
                                       'to', :'r_photo' || '/' || :'b_ph' || '.webp')),
  'review: promote maps the claim path to the public path');
select ok(pg_temp.in_public(:'r_photo' || '/' || :'b_ph' || '.webp'), 'review: after photo is public');
select is((select status from public.fix_claims where id = :'claim_photo'), 'approved', 'review: claim approved');
select is((select reviewed_by from public.fix_claims where id = :'claim_photo'), :'adm'::uuid, 'review: reviewed_by');
select is(:'rv1'::jsonb -> 'report' ->> 'status', 'resolved', 'review: effect carries resolved');

select is((select status from public.reports where id = :'r_nophoto'), 'open', 'review: rejected claim reopens');
select is((select approved_at from public.reports where id = :'r_nophoto'), :'nophoto_approved'::timestamptz,
  'review: approved_at is kept (days keep counting)');
select ok((select resolved_at is null from public.reports where id = :'r_nophoto'), 'review: resolved_at stays null');
select is((select status from public.fix_claims where id = :'claim_nophoto'), 'rejected', 'review: claim rejected');

select throws_ok(format($q$select public.admin_review_fix_claim(%L, %L, true)$q$, :'adm', :'claim_photo'),
  'P0001', 'invalid_state', 'review: a reviewed claim');
select throws_ok(format($q$select public.admin_review_fix_claim(%L, %L, true)$q$, :'adm', gen_random_uuid()),
  'P0001', 'item_not_found', 'review: missing claim');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 1000)$q$, :'c', :'r_photo'),
  'P0001', 'already_resolved', 'claim: resolved report');

select pg_temp.open(:'a', :'adm', :px, :py) as r_hidewait \gset
select public.create_fix_claim(:'c', :'r_hidewait', null, null, 1000) ->> 'claim_id' as claim_hidewait \gset
select public.admin_hide(:'adm', 'report', :'r_hidewait') is not null as hid \gset
select throws_ok(format($q$select public.admin_review_fix_claim(%L, %L, true)$q$, :'adm', :'claim_hidewait'),
  'P0001', 'invalid_state', 'review: report hidden while the claim waits');

select is((select count(*)::int from public.moderation_log
           where action = 'approve_claim' and target_type = 'report' and target_id = :'r_photo'), 1,
  'review: approve_claim logged against the report');
select is((select count(*)::int from public.moderation_log
           where action = 'reject_claim' and target_type = 'report' and target_id = :'r_nophoto'), 1,
  'review: reject_claim logged against the report');

-- ================================================================ hide / restore a report
select pg_temp.open(:'a', :'adm', :px, :py) as rh \gset
select (select comment_id from public.merge_duplicate(:'rh', :'c', array[pg_temp.photo(:'c')], 1000)) as cm_c \gset
select (select comment_id from public.merge_duplicate(:'rh', :'d', array[pg_temp.photo(:'d')], 1000)) as cm_d \gset
select ph.storage_path as rh_before from public.report_photos ph where ph.report_id = :'rh' and ph.kind = 'before' \gset
select ph.storage_path as c_path from public.comments cm join public.report_photos ph on ph.id = cm.photo_id where cm.id = :'cm_c' \gset
select ph.storage_path as d_path from public.comments cm join public.report_photos ph on ph.id = cm.photo_id where cm.id = :'cm_d' \gset

set local role service_role;
select public.admin_hide(:'adm', 'comment', :'cm_d') as hd \gset
select public.admin_hide(:'adm', 'report', :'rh') as hr \gset
reset role;

select is((select status from public.reports where id = :'rh'), 'hidden', 'hide: report hidden');
select is((select hidden_from from public.reports where id = :'rh'), 'open', 'hide: hidden_from keeps open');
select ok(not exists (select 1 from public.public_reports where id = :'rh'), 'hide: report leaves public_reports');
select ok(not exists (select 1 from public.public_comments where report_id = :'rh'), 'hide: its comments leave public_comments');
select ok(:'hr'::jsonb -> 'demote' ? :'rh_before', 'hide: demote has the before photo');
select ok(:'hr'::jsonb -> 'demote' ? :'c_path', 'hide: demote has the visible comment photo');
select ok(not (:'hr'::jsonb -> 'demote' ? :'d_path'), 'hide: demote skips a comment hidden on its own');
select is(:'hr'::jsonb -> 'report' ->> 'status', 'hidden', 'hide: effect signals hidden');
select throws_ok(format($q$select public.admin_hide(%L, 'report', %L)$q$, :'adm', :'rh'),
  'P0001', 'invalid_state', 'hide: twice');

set local role service_role;
select public.admin_restore(:'adm', 'report', :'rh') as rr \gset
reset role;
select is((select status from public.reports where id = :'rh'), 'open', 'restore: back to open');
select ok((select hidden_from is null from public.reports where id = :'rh'), 'restore: hidden_from cleared');
select ok(:'rr'::jsonb -> 'promote' @> jsonb_build_array(jsonb_build_object('from', :'rh_before', 'to', :'rh_before')),
  'restore: before photo goes back to the same path');
select ok(:'rr'::jsonb -> 'promote' @> jsonb_build_array(jsonb_build_object('from', :'c_path', 'to', :'c_path')),
  'restore: visible comment photo goes back');
select ok(not (:'rr'::jsonb -> 'promote' @> jsonb_build_array(jsonb_build_object('from', :'d_path', 'to', :'d_path'))),
  'restore: a separately hidden comment photo stays private');
select throws_ok(format($q$select public.admin_restore(%L, 'report', %L)$q$, :'adm', :'rh'),
  'P0001', 'invalid_state', 'restore: a report that is not hidden');

select pg_temp.mk(:'a', :px, :py) as rp \gset
select public.admin_hide(:'adm', 'report', :'rp') as hp \gset
select is(:'hp'::jsonb -> 'demote', '[]'::jsonb, 'hide pending: nothing to demote');
select ok(:'hp'::jsonb -> 'report' = 'null'::jsonb, 'hide pending: no public signal');
select public.admin_restore(:'adm', 'report', :'rp') as rpr \gset
select is((select status from public.reports where id = :'rp'), 'pending_review', 'restore pending: back to review');
select ok(not exists (select 1 from public.public_reports where id = :'rp'), 'restore pending: not public');

select pg_temp.open(:'a', :'adm', :px, :py) as rfc \gset
select public.create_fix_claim(:'e', :'rfc', null, null, 1000) is not null as x \gset
select public.admin_hide(:'adm', 'report', :'rfc') is not null as x \gset
select public.admin_restore(:'adm', 'report', :'rfc') is not null as x \gset
select is((select status from public.reports where id = :'rfc'), 'fix_claimed', 'restore fix_claimed: back to fix_claimed');
select is((select status from public.fix_claims where report_id = :'rfc'), 'pending', 'restore fix_claimed: claim still pending');

select pg_temp.mk(:'a', :px, :py) as rrej \gset
select public.admin_reject_report(:'adm', :'rrej', 'duplicate', null) is not null as x \gset
select throws_ok(format($q$select public.admin_hide(%L, 'report', %L)$q$, :'adm', :'rrej'),
  'P0001', 'invalid_state', 'hide: a rejected report');

-- ================================================================ hide / restore a comment
select pg_temp.open(:'a', :'adm', :px, :py) as rcm \gset
select (select comment_id from public.merge_duplicate(:'rcm', :'b', array[pg_temp.photo(:'b')], 1000)) as cm1 \gset
select ph.storage_path as cm1_path from public.comments cm join public.report_photos ph on ph.id = cm.photo_id where cm.id = :'cm1' \gset
select comment_count as cc_before from public.reports where id = :'rcm' \gset

select public.admin_hide(:'adm', 'comment', :'cm1') as hc \gset
select is((select status from public.comments where id = :'cm1'), 'hidden', 'hide comment: hidden');
select is((select comment_count from public.reports where id = :'rcm'), :'cc_before'::int - 1, 'hide comment: count drops');
select is(:'hc'::jsonb -> 'demote', jsonb_build_array(:'cm1_path'), 'hide comment: demote its photo');
select is(:'hc'::jsonb -> 'report' ->> 'id', :'rcm'::text, 'hide comment: signal is its report');
select throws_ok(format($q$select public.admin_hide(%L, 'comment', %L)$q$, :'adm', :'cm1'),
  'P0001', 'invalid_state', 'hide comment: twice');
select public.admin_restore(:'adm', 'comment', :'cm1') as rc \gset
select is((select status from public.comments where id = :'cm1'), 'visible', 'restore comment: visible');
select is((select comment_count from public.reports where id = :'rcm'), :'cc_before'::int, 'restore comment: count back');
select is(:'rc'::jsonb -> 'promote', jsonb_build_array(jsonb_build_object('from', :'cm1_path', 'to', :'cm1_path')),
  'restore comment: promote its photo');
select throws_ok(format($q$select public.admin_hide(%L, 'comment', %L)$q$, :'adm', gen_random_uuid()),
  'P0001', 'item_not_found', 'hide comment: missing');
select throws_ok(format($q$select public.admin_hide(%L, 'user', %L)$q$, :'adm', :'cm1'),
  'P0001', 'invalid_request', 'hide: unknown target type');

-- ================================================================ flags and auto-hide
select pg_temp.open(:'a', :'adm', :px, :py) as rx \gset
set local role service_role;
select public.create_flag(:'b', 'report', :'rx', 'spam', null, 1000) as f1 \gset
reset role;
select is(:'f1'::jsonb ->> 'hidden', 'false', 'flag: first flag does not hide');
select ok(:'f1'::jsonb ? 'flag_id', 'flag: result has flag_id');
select public.create_flag(:'b', 'report', :'rx', 'false', null, 1000) ->> 'flag_id' as f1b \gset
select public.create_flag(:'b', 'report', :'rx', 'spam', null, 1000) ->> 'flag_id' as f1c \gset
select is((select count(*)::int from public.flags where target_id = :'rx' and reporter_id = :'b' and status = 'open'), 1,
  'flag: repeats keep one open row');
select is(:'f1b'::text, :'f1'::jsonb ->> 'flag_id', 'flag: a repeat returns the existing flag');
select is((select status from public.reports where id = :'rx'), 'open', 'flag: one person cannot hide');
select public.create_flag(:'c', 'report', :'rx', 'privacy', 'มีหน้าคน', 1000) as f2 \gset
select is((select status from public.reports where id = :'rx'), 'open', 'flag: two people do not hide');
select public.create_flag(:'d', 'report', :'rx', 'spam', null, 1000) as f3 \gset
select is(:'f3'::jsonb ->> 'hidden', 'true', 'flag: the third person hides');
select is((select status from public.reports where id = :'rx'), 'hidden', 'flag: report auto-hidden');
select is((select hidden_from from public.reports where id = :'rx'), 'open', 'flag: hidden_from open');
select ok(jsonb_array_length(:'f3'::jsonb -> 'demote') > 0, 'flag: auto-hide demotes the photos');
select is((select count(*)::int from public.moderation_log where action = 'auto_hide' and target_id = :'rx' and admin_id is null), 1,
  'flag: auto_hide logged by the system');

select pg_temp.open(:'a', :'adm', :px, :py) as rcf \gset
select (select comment_id from public.add_comment(:'rcf', :'e', 'ความเห็นแย่ๆ', 1000)) as cmx \gset
select public.create_flag(:'b', 'comment', :'cmx', 'personal_attack', null, 1000) is not null as x \gset
select public.create_flag(:'c', 'comment', :'cmx', 'personal_attack', null, 1000) is not null as x \gset
select public.create_flag(:'d', 'comment', :'cmx', 'personal_attack', null, 1000) ->> 'hidden' as cmx_hidden \gset
select is(:'cmx_hidden'::text, 'true', 'flag comment: third person hides');
select is((select status from public.comments where id = :'cmx'), 'hidden', 'flag comment: comment hidden');

select throws_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', null, 1000)$q$, :'b', :'rp'),
  'P0001', 'report_not_found', 'flag: pending report');
select throws_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', null, 1000)$q$, :'e', :'rx'),
  'P0001', 'report_not_found', 'flag: hidden report');
select throws_ok(format($q$select public.create_flag(%L, 'comment', %L, 'spam', null, 1000)$q$, :'e', :'cmx'),
  'P0001', 'item_not_found', 'flag: hidden comment');
select throws_ok(format($q$select public.create_flag(%L, 'report', %L, 'nope', null, 1000)$q$, :'e', :'rcf'),
  'P0001', 'invalid_request', 'flag: unknown reason');
select throws_ok(format($q$select public.create_flag(%L, 'user', %L, 'spam', null, 1000)$q$, :'e', :'rcf'),
  'P0001', 'invalid_request', 'flag: unknown target type');
select throws_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', %L, 1000)$q$, :'e', :'rcf', repeat('ก', 501)),
  'P0001', 'invalid_note', 'flag: note over 500');
select tests.create_user('m6q@x.test') as q \gset
select lives_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', null, 2)$q$, :'q', :'rcf'), 'flag quota: 1');
select lives_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', null, 2)$q$, :'q', :'rcm'), 'flag quota: 2');
select throws_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', null, 2)$q$, :'q', :'r_open2'),
  'P0001', 'rate_limited', 'flag quota: 3rd over the limit');

-- ================================================================ resolve flags
set local role service_role;
select public.admin_resolve_flags(:'adm', :'f1b', 'dismiss') as dz \gset
reset role;
select is((select count(*)::int from public.flags where target_id = :'rx' and status <> 'dismissed'), 0,
  'dismiss: every flag of the target dismissed');
select is((select status from public.reports where id = :'rx'), 'open', 'dismiss: hidden target restored');
select ok(jsonb_array_length(:'dz'::jsonb -> 'promote') > 0, 'dismiss: files go back to public');
select ok(exists (select 1 from public.moderation_log where action = 'dismiss_flags' and target_id = :'rx'), 'dismiss: logged');
select ok(exists (select 1 from public.moderation_log where action = 'restore' and target_id = :'rx'), 'dismiss: restore logged');
select throws_ok(format($q$select public.admin_resolve_flags(%L, %L, 'hide')$q$, :'adm', :'f1b'),
  'P0001', 'invalid_state', 'resolve: a flag that is not open');

select pg_temp.open(:'a', :'adm', :px, :py) as rhf \gset
select public.create_flag(:'b', 'report', :'rhf', 'spam', null, 1000) ->> 'flag_id' as fh \gset
select public.admin_resolve_flags(:'adm', :'fh', 'hide') is not null as x \gset
select is((select status from public.reports where id = :'rhf'), 'hidden', 'resolve hide: report hidden');
select is((select status from public.flags where id = :'fh'), 'actioned', 'resolve hide: flag actioned');

select pg_temp.open(:'a', :'adm', :px, :py) as rbn \gset
select (select comment_id from public.add_comment(:'rbn', :'c', 'สแปม', 1000)) as cm_ban \gset
select public.create_flag(:'b', 'comment', :'cm_ban', 'spam', null, 1000) ->> 'flag_id' as fb \gset
select public.admin_resolve_flags(:'adm', :'fb', 'ban') is not null as x \gset
select is((select status from public.comments where id = :'cm_ban'), 'hidden', 'resolve ban: comment hidden');
select ok((select banned_at is not null from public.profiles where id = :'c'), 'resolve ban: comment author banned');
select ok((select banned_at is null from public.profiles where id = :'a'), 'resolve ban: report author not banned');
select throws_ok(format($q$select public.admin_resolve_flags(%L, %L, 'nuke')$q$, :'adm', :'f2'::jsonb ->> 'flag_id'),
  'P0001', 'invalid_state', 'resolve: dismissed flag is not open');
select pg_temp.open(:'a', :'adm', :px, :py) as rnk \gset
select public.create_flag(:'b', 'report', :'rnk', 'spam', null, 1000) ->> 'flag_id' as fnk \gset
select throws_ok(format($q$select public.admin_resolve_flags(%L, %L, 'nuke')$q$, :'adm', :'fnk'),
  'P0001', 'invalid_request', 'resolve: unknown action');
select throws_ok(format($q$select public.admin_resolve_flags(%L, %L, 'hide')$q$, :'adm', gen_random_uuid()),
  'P0001', 'item_not_found', 'resolve: missing flag');

select pg_temp.open(:'adm2', :'adm', :px, :py) as radm \gset
select public.create_flag(:'b', 'report', :'radm', 'spam', null, 1000) ->> 'flag_id' as fadm \gset
select throws_ok(format($q$select public.admin_resolve_flags(%L, %L, 'ban')$q$, :'adm', :'fadm'),
  'P0001', 'cannot_ban_admin', 'resolve ban: an admin owner');
select is((select status from public.reports where id = :'radm'), 'open', 'resolve ban: rolled back, not hidden');

-- ================================================================ bans
select public.admin_set_ban(:'adm', :'e', true) is not null as x \gset
select banned_at as e_banned from public.profiles where id = :'e' \gset
select ok(:'e_banned' <> '', 'ban: banned_at set');
select public.admin_set_ban(:'adm', :'e', true) is not null as x \gset
select is((select banned_at from public.profiles where id = :'e'), :'e_banned'::timestamptz, 'ban: twice keeps the first time');
select public.admin_set_ban(:'adm', :'e', false) as ub \gset
select ok((select banned_at is null from public.profiles where id = :'e'), 'unban: banned_at cleared');
select is(:'ub'::jsonb -> 'report', 'null'::jsonb, 'ban: no public signal');
select throws_ok(format($q$select public.admin_set_ban(%L, %L, true)$q$, :'adm', :'adm2'),
  'P0001', 'cannot_ban_admin', 'ban: another admin');
select throws_ok(format($q$select public.admin_set_ban(%L, %L, true)$q$, :'adm', :'adm'),
  'P0001', 'cannot_ban_admin', 'ban: oneself');
select throws_ok(format($q$select public.admin_set_ban(%L, %L, true)$q$, :'adm', gen_random_uuid()),
  'P0001', 'item_not_found', 'ban: missing user');
select is((select count(*)::int from public.moderation_log where target_type = 'user' and target_id = :'e' and action = 'ban'), 2,
  'ban: logged each time');
select is((select count(*)::int from public.moderation_log where target_type = 'user' and target_id = :'e' and action = 'unban'), 1,
  'unban: logged');

-- ================================================================ public views
select ok(not exists (select 1 from public.report_photos ph where ph.kind = 'claim' and pg_temp.in_public(ph.storage_path)),
  'no claim photo in public_reports');
select ok(not exists (select 1 from public.public_comments pc join public.comments cm on cm.id = pc.id where cm.status = 'hidden'),
  'no hidden comment in public_comments');

-- ================================================================ restore clears open flags (final review I2)
select pg_temp.open(:'a', :'adm', :px, :py) as rr2 \gset
select public.create_flag(:'b', 'report', :'rr2', 'spam', null, 1000) is not null as x \gset
select public.create_flag(:'c', 'report', :'rr2', 'spam', null, 1000) is not null as x \gset
select public.create_flag(:'d', 'report', :'rr2', 'spam', null, 1000) is not null as x \gset
select is((select status from public.reports where id = :'rr2'), 'hidden', 'I2: three flags hide it');
select public.admin_restore(:'adm', 'report', :'rr2') is not null as x \gset
select is((select count(*)::int from public.flags where target_id = :'rr2' and status = 'open'), 0,
  'I2: restore dismisses the open flags of the target');
select is(public.create_flag(:'b', 'report', :'rr2', 'spam', null, 1000) ->> 'hidden', 'false',
  'I2: one repeat flag after a restore does not hide it again');
select is((select status from public.reports where id = :'rr2'), 'open', 'I2: still public');

-- ================================================================ ban logs the user's name (final review M6)
select public.admin_set_ban(:'adm', :'q', true) is not null as x \gset
select is((select detail ->> 'user_name' from public.moderation_log where action = 'ban' and target_id = :'q'),
          (select display_name from public.profiles where id = :'q'), 'M6: the ban log names the user');
-- ================================================================ privileges
select tests.as_anon();
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 9)$q$, :'a', :'rcf'), '42501', null, 'anon: create_fix_claim');
select throws_ok(format($q$select public.admin_review_fix_claim(%L, %L, true)$q$, :'a', :'claim_hidewait'), '42501', null, 'anon: admin_review_fix_claim');
select throws_ok(format($q$select public.admin_hide(%L, 'report', %L)$q$, :'a', :'rcf'), '42501', null, 'anon: admin_hide');
select throws_ok(format($q$select public.admin_restore(%L, 'report', %L)$q$, :'a', :'rcf'), '42501', null, 'anon: admin_restore');
select throws_ok(format($q$select public.admin_set_ban(%L, %L, true)$q$, :'a', :'b'), '42501', null, 'anon: admin_set_ban');
select throws_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', null, 9)$q$, :'a', :'rcf'), '42501', null, 'anon: create_flag');
select throws_ok(format($q$select public.admin_resolve_flags(%L, %L, 'hide')$q$, :'a', :'fnk'), '42501', null, 'anon: admin_resolve_flags');
select throws_ok(format($q$select public.hide_target(%L, 'report', %L, 'hide')$q$, :'a', :'rcf'), '42501', null, 'anon: hide_target');
select throws_ok(format($q$select public.report_public_paths(%L)$q$, :'rcf'), '42501', null, 'anon: report_public_paths');
select tests.as_user(:'a');
select throws_ok(format($q$select public.create_fix_claim(%L, %L, null, null, 9)$q$, :'a', :'rcf'), '42501', null, 'member: create_fix_claim');
select throws_ok(format($q$select public.admin_review_fix_claim(%L, %L, true)$q$, :'a', :'claim_hidewait'), '42501', null, 'member: admin_review_fix_claim');
select throws_ok(format($q$select public.admin_hide(%L, 'report', %L)$q$, :'a', :'rcf'), '42501', null, 'member: admin_hide');
select throws_ok(format($q$select public.admin_restore(%L, 'report', %L)$q$, :'a', :'rcf'), '42501', null, 'member: admin_restore');
select throws_ok(format($q$select public.admin_set_ban(%L, %L, true)$q$, :'a', :'b'), '42501', null, 'member: admin_set_ban');
select throws_ok(format($q$select public.create_flag(%L, 'report', %L, 'spam', null, 9)$q$, :'a', :'rcf'), '42501', null, 'member: create_flag');
select throws_ok(format($q$select public.admin_resolve_flags(%L, %L, 'hide')$q$, :'a', :'fnk'), '42501', null, 'member: admin_resolve_flags');
select throws_ok(format($q$select public.hide_target(%L, 'report', %L, 'hide')$q$, :'a', :'rcf'), '42501', null, 'member: hide_target');
select throws_ok(format($q$select public.report_public_paths(%L)$q$, :'rcf'), '42501', null, 'member: report_public_paths');
select tests.as_owner();

select * from finish();
rollback;
