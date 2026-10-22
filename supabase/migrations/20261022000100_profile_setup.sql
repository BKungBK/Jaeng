-- Plan 9: signing up. A new member sets a nickname (their display name) and may add a profile
-- picture before using the app. `onboarded_at` is null until they have done that; everyone who
-- exists today counts as done. Pictures live in the public `avatars` bucket; only the API
-- (service role) writes them.

alter table public.profiles
  add column avatar_path text,
  add column onboarded_at timestamptz;

update public.profiles set onboarded_at = created_at;

-- Clients still write only `locale` (column grant in 20261016000500_rls.sql); the new columns change
-- through the functions below, which only service_role may call.

-- ---------------------------------------------------------------- avatars bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 1048576, array['image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------- public views: the picture follows the name
-- New column at the end of each view: create or replace view cannot reorder existing ones. The
-- picture shows exactly when the name does.
create or replace view public.public_reports as
select
  r.id,
  c.slug as category,
  c.icon,
  r.danger_level,
  r.title,
  r.description,
  r.status,
  extensions.st_x(r.public_location::extensions.geometry) as lng,
  extensions.st_y(r.public_location::extensions.geometry) as lat,
  r.place_name,
  r.confirm_count,
  r.comment_count,
  floor(extract(epoch from (coalesce(r.resolved_at, now()) - r.approved_at)) / 86400)::int as days_open,
  case when r.hide_author then null else p.display_name end as author_name,
  (select ph.storage_path
     from public.report_photos ph
    where ph.report_id = r.id and ph.kind = 'before'
    order by ph.created_at
    limit 1) as cover_photo_path,
  coalesce((select array_agg(t.name order by t.name)
              from public.report_tags rt
              join public.tags t on t.id = rt.tag_id
             where rt.report_id = r.id), '{}'::text[]) as tags,
  r.approved_at,
  r.resolved_at,
  coalesce((select jsonb_agg(
                     jsonb_build_object('path', ph.storage_path, 'kind', ph.kind, 'width', ph.width, 'height', ph.height)
                     order by ph.kind, ph.created_at)
              from public.report_photos ph
             where ph.report_id = r.id and ph.kind in ('before', 'after')), '[]'::jsonb) as photos,
  r.created_at,
  case when r.hide_author then null else p.avatar_path end as author_avatar
from public.reports r
join public.categories c on c.id = r.category_id
join public.profiles p on p.id = r.author_id
where r.status in ('open', 'fix_claimed', 'resolved');

create or replace view public.public_comments as
select
  cm.id,
  cm.report_id,
  cm.body,
  case when cm.author_id = r.author_id and r.hide_author then null else p.display_name end as author_name,
  cm.created_at,
  (cm.author_id = r.author_id) as by_reporter,
  (select ph.storage_path
     from public.report_photos ph
    where ph.id = cm.photo_id and ph.report_id = cm.report_id) as photo_path,
  case when cm.author_id = r.author_id and r.hide_author then null else p.avatar_path end as author_avatar
from public.comments cm
join public.profiles p on p.id = cm.author_id
join public.reports r on r.id = cm.report_id
where cm.status = 'visible'
  and cm.report_id in (select id from public.public_reports);

-- ---------------------------------------------------------------- admin reads carry the picture
create or replace function public.admin_person(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', pf.id, 'display_name', pf.display_name, 'email', u.email::text,
                            'role', pf.role, 'banned', pf.banned_at is not null, 'avatar_path', pf.avatar_path)
  from public.profiles pf
  left join auth.users u on u.id = pf.id
  where pf.id = p_id;
$$;

create or replace function public.admin_users(p_q text, p_limit int default 50)
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
      'avatar_path', pf.avatar_path,
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

-- ---------------------------------------------------------------- picture changes and their daily quota
create table public.avatar_uploads (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index avatar_uploads_user_idx on public.avatar_uploads (user_id, created_at);
alter table public.avatar_uploads enable row level security;

-- Sets (or, with a null path, clears) the picture and returns the path it replaces, so the API can
-- delete that file. A new picture counts against the daily limit; clearing one never does.
create function public.set_avatar(p_user uuid, p_path text, p_limit int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text;
begin
  perform public.lock_profile(p_user);
  if p_path is not null and (select count(*) from public.avatar_uploads au
                              where au.user_id = p_user and au.created_at > now() - interval '24 hours') >= p_limit then
    raise exception 'rate_limited';
  end if;
  select pf.avatar_path into v_previous from public.profiles pf where pf.id = p_user;
  if not found then
    raise exception 'item_not_found';
  end if;
  update public.profiles set avatar_path = p_path where id = p_user;
  if p_path is not null then
    insert into public.avatar_uploads (user_id) values (p_user);
  end if;
  return v_previous;
end;
$$;

-- Saves the nickname and marks the profile as set up. Calling it again keeps the first time.
create function public.complete_profile(p_user uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set display_name = p_name,
         onboarded_at = coalesce(onboarded_at, now())
   where id = p_user;
  if not found then
    raise exception 'item_not_found';
  end if;
end;
$$;

-- An admin takes a picture off a member; returns the path so the API can delete the file.
create function public.admin_remove_avatar(p_admin uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text;
  v_name text;
begin
  select pf.avatar_path, pf.display_name into v_previous, v_name
    from public.profiles pf where pf.id = p_user for update;
  if not found then
    raise exception 'item_not_found';
  end if;
  update public.profiles set avatar_path = null where id = p_user;
  perform public.log_action(p_admin, 'remove_avatar', 'user', p_user, jsonb_build_object('user_name', v_name));
  return v_previous;
end;
$$;

revoke execute on function public.set_avatar(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.complete_profile(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_remove_avatar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_avatar(uuid, text, int) to service_role;
grant execute on function public.complete_profile(uuid, text) to service_role;
grant execute on function public.admin_remove_avatar(uuid, uuid) to service_role;
