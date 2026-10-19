-- Plan 5 task 4: what the admin page reads. Each function returns jsonb shaped like the types in
-- packages/shared/admin.ts, with photos as PhotoRef ({path, width, height}); the API adds URLs.
-- Real names, e-mail addresses and true locations leave the database only through these functions,
-- which only service_role may call (the API checks the caller is an admin first).

-- ---------------------------------------------------------------- helpers (internal)
create function public.admin_person(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', pf.id, 'display_name', pf.display_name, 'email', u.email::text,
                            'role', pf.role, 'banned', pf.banned_at is not null)
  from public.profiles pf
  left join auth.users u on u.id = pf.id
  where pf.id = p_id;
$$;

create function public.admin_photo(p_photo uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
  from public.report_photos ph
  where ph.id = p_photo;
$$;

-- The first 'before' photo of a report, or null.
create function public.admin_cover(p_report uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_photo(ph.id)
  from public.report_photos ph
  where ph.report_id = p_report and ph.kind = 'before'
  order by ph.created_at, ph.id
  limit 1;
$$;

create function public.admin_before_photos(p_report uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.admin_photo(ph.id) order by ph.created_at, ph.id), '[]'::jsonb)
  from public.report_photos ph
  where ph.report_id = p_report and ph.kind = 'before';
$$;

-- ---------------------------------------------------------------- counts
create function public.admin_counts()
returns table (reports int, claims int, flags int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.reports r where r.status = 'pending_review'),
    (select count(*)::int from public.fix_claims fc join public.reports r on r.id = fc.report_id
      where fc.status = 'pending' and r.status = 'fix_claimed'),
    (select count(*)::int from (select distinct f.target_type, f.target_id from public.flags f where f.status = 'open') s);
$$;

-- ---------------------------------------------------------------- queues
create function public.admin_queue_reports(p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.created_at, s.id), '[]'::jsonb)
  from (
    select r.id, r.created_at, jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'description', r.description,
      'category', c.slug,
      'danger_level', r.danger_level,
      'created_at', r.created_at,
      'place_name', r.place_name,
      'hide_author', r.hide_author,
      'profanity_flag', r.profanity_flag,
      'tags', coalesce((select jsonb_agg(t.name order by t.name)
                          from public.report_tags rt join public.tags t on t.id = rt.tag_id
                         where rt.report_id = r.id), '[]'::jsonb),
      'lng', extensions.st_x(r.location::extensions.geometry),
      'lat', extensions.st_y(r.location::extensions.geometry),
      'public_lng', extensions.st_x(r.public_location::extensions.geometry),
      'public_lat', extensions.st_y(r.public_location::extensions.geometry),
      'author', public.admin_person(r.author_id),
      'photos', public.admin_before_photos(r.id)) as item
    from public.reports r
    join public.categories c on c.id = r.category_id
    where r.status = 'pending_review'
    order by r.created_at, r.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) s;
$$;

-- Only claims whose report is fix_claimed: a claim on a hidden report waits until it is restored.
create function public.admin_queue_claims(p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.created_at, s.id), '[]'::jsonb)
  from (
    select fc.id, fc.created_at, jsonb_build_object(
      'id', fc.id,
      'note', fc.note,
      'created_at', fc.created_at,
      'claimant', public.admin_person(fc.claimant_id),
      'photo', public.admin_photo(fc.photo_id),
      'report', jsonb_build_object(
        'id', r.id,
        'title', r.title,
        'category', c.slug,
        'danger_level', r.danger_level,
        'place_name', r.place_name,
        'days_open', floor(extract(epoch from (now() - coalesce(r.approved_at, r.created_at))) / 86400)::int,
        'photos', public.admin_before_photos(r.id))) as item
    from public.fix_claims fc
    join public.reports r on r.id = fc.report_id
    join public.categories c on c.id = r.category_id
    where fc.status = 'pending' and r.status = 'fix_claimed'
    order by fc.created_at, fc.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) s;
$$;

-- One item per target with open flags, oldest open flag first. flag_id is that oldest flag.
create function public.admin_queue_flags(p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select f.target_type, f.target_id, min(f.created_at) as first_at,
           (array_agg(f.id order by f.created_at, f.id))[1] as flag_id
    from public.flags f
    where f.status = 'open'
    group by f.target_type, f.target_id
  )
  select coalesce(jsonb_agg(s.item order by s.first_at, s.flag_id), '[]'::jsonb)
  from (
    select t.first_at, t.flag_id, jsonb_build_object(
      'flag_id', t.flag_id,
      'target_type', t.target_type,
      'target_id', t.target_id,
      'hidden', case when t.target_type = 'report' then r.status = 'hidden' else cm.status = 'hidden' end,
      'flags', (select jsonb_agg(jsonb_build_object('reason', f.reason, 'note', f.note,
                                                    'reporter_name', pf.display_name, 'created_at', f.created_at)
                                 order by f.created_at, f.id)
                  from public.flags f join public.profiles pf on pf.id = f.reporter_id
                 where f.target_type = t.target_type and f.target_id = t.target_id and f.status = 'open'),
      'report', jsonb_build_object('id', r.id, 'title', r.title, 'status', r.status, 'category', c.slug,
                                   'danger_level', r.danger_level, 'photo', public.admin_cover(r.id)),
      'comment', case when cm.id is null then null
                      else jsonb_build_object('id', cm.id, 'body', cm.body, 'photo', public.admin_photo(cm.photo_id)) end,
      'author', public.admin_person(coalesce(cm.author_id, r.author_id))) as item
    from t
    left join public.comments cm on t.target_type = 'comment' and cm.id = t.target_id
    join public.reports r on r.id = case when t.target_type = 'report' then t.target_id else cm.report_id end
    join public.categories c on c.id = r.category_id
    order by t.first_at, t.flag_id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) s;
$$;

-- Hidden reports (latest change first), then hidden comments (newest first).
create function public.admin_hidden(p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select jsonb_agg(s.item order by s.at desc, s.id)
              from (select r.id, r.updated_at as at, jsonb_build_object(
                             'target_type', 'report',
                             'target_id', r.id,
                             'report', jsonb_build_object('id', r.id, 'title', r.title, 'category', c.slug,
                                                          'danger_level', r.danger_level, 'photo', public.admin_cover(r.id)),
                             'comment', null) as item
                      from public.reports r join public.categories c on c.id = r.category_id
                     where r.status = 'hidden'
                     order by r.updated_at desc, r.id
                     limit least(greatest(coalesce(p_limit, 50), 1), 100)) s), '[]'::jsonb)
    ||
    coalesce((select jsonb_agg(s.item order by s.at desc, s.id)
              from (select cm.id, cm.created_at as at, jsonb_build_object(
                             'target_type', 'comment',
                             'target_id', cm.id,
                             'report', jsonb_build_object('id', r.id, 'title', r.title, 'category', c.slug,
                                                          'danger_level', r.danger_level,
                                                          'photo', coalesce(public.admin_photo(cm.photo_id), public.admin_cover(r.id))),
                             'comment', jsonb_build_object('id', cm.id, 'body', cm.body)) as item
                      from public.comments cm
                      join public.reports r on r.id = cm.report_id
                      join public.categories c on c.id = r.category_id
                     where cm.status = 'hidden'
                     order by cm.created_at desc, cm.id
                     limit least(greatest(coalesce(p_limit, 50), 1), 100)) s), '[]'::jsonb);
$$;

-- ---------------------------------------------------------------- users and log
-- Searches the display name or the e-mail; % and _ in q are literal. Blank q lists everyone.
create function public.admin_users(p_q text, p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.created_at desc, s.id), '[]'::jsonb)
  from (
    select pf.id, pf.created_at, jsonb_build_object(
      'id', pf.id,
      'display_name', pf.display_name,
      'email', u.email::text,
      'role', pf.role,
      'banned_at', pf.banned_at,
      'created_at', pf.created_at,
      'report_count', (select count(*)::int from public.reports r where r.author_id = pf.id),
      'comment_count', (select count(*)::int from public.comments cm where cm.author_id = pf.id)) as item
    from public.profiles pf
    left join auth.users u on u.id = pf.id
    where nullif(btrim(coalesce(p_q, '')), '') is null
       or pf.display_name ilike '%' || public.escape_like(btrim(p_q)) || '%' escape '\'
       or u.email ilike '%' || public.escape_like(btrim(p_q)) || '%' escape '\'
    order by pf.created_at desc, pf.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) s;
$$;

-- Newest first; p_before pages backwards by id. admin_name is null for the system.
create function public.admin_log(p_before bigint, p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.id desc), '[]'::jsonb)
  from (
    select l.id, jsonb_build_object(
      'id', l.id,
      'created_at', l.created_at,
      'action', l.action,
      'target_type', l.target_type,
      'target_id', l.target_id,
      'detail', l.detail,
      'admin_name', pf.display_name) as item
    from public.moderation_log l
    left join public.profiles pf on pf.id = l.admin_id
    where p_before is null or l.id < p_before
    order by l.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) s;
$$;

-- ---------------------------------------------------------------- privileges
revoke execute on function public.admin_person(uuid) from public, anon, authenticated;
revoke execute on function public.admin_photo(uuid) from public, anon, authenticated;
revoke execute on function public.admin_cover(uuid) from public, anon, authenticated;
revoke execute on function public.admin_before_photos(uuid) from public, anon, authenticated;
revoke execute on function public.admin_counts() from public, anon, authenticated;
revoke execute on function public.admin_queue_reports(int) from public, anon, authenticated;
revoke execute on function public.admin_queue_claims(int) from public, anon, authenticated;
revoke execute on function public.admin_queue_flags(int) from public, anon, authenticated;
revoke execute on function public.admin_hidden(int) from public, anon, authenticated;
revoke execute on function public.admin_users(text, int) from public, anon, authenticated;
revoke execute on function public.admin_log(bigint, int) from public, anon, authenticated;

grant execute on function public.admin_counts() to service_role;
grant execute on function public.admin_queue_reports(int) to service_role;
grant execute on function public.admin_queue_claims(int) to service_role;
grant execute on function public.admin_queue_flags(int) to service_role;
grant execute on function public.admin_hidden(int) to service_role;
grant execute on function public.admin_users(text, int) to service_role;
grant execute on function public.admin_log(bigint, int) to service_role;
