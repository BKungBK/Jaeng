-- Plan 5 task 2: report review (approve / reject with edits and file moves), the moderation log,
-- and the plan 4 carry-over guards (a null quota counts as 0, the duplicate radius is clamped).
-- Every admin function is security definer, callable by service_role only, locks its target row
-- first and checks the state, so of two concurrent calls one succeeds and the other gets invalid_state.

-- ---------------------------------------------------------------- schema
alter table public.report_photos drop constraint report_photos_kind_check,
  add constraint report_photos_kind_check check (kind in ('before', 'after', 'comment', 'claim'));

-- The status a report had before it was hidden, so "restore" can put it back. Null unless hidden.
alter table public.reports add column hidden_from text
  check (hidden_from in ('pending_review', 'open', 'fix_claimed', 'resolved'));

-- null admin_id = the system (auto-hide after three flags).
alter table public.moderation_log alter column admin_id drop not null;

-- One open flag per member and target: repeats are ignored, so one person cannot hide anything alone.
create unique index flags_one_open_per_reporter on public.flags (target_type, target_id, reporter_id)
  where status = 'open';

-- ---------------------------------------------------------------- log + effect
create function public.log_action(p_admin uuid, p_action text, p_target_type text, p_target_id uuid,
                                  p_detail jsonb default '{}')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.moderation_log (admin_id, action, target_type, target_id, detail)
  values (p_admin, p_action, p_target_type, p_target_id, coalesce(p_detail, '{}'::jsonb));
$$;

-- What a moderation call changed for the public. "report" is the realtime signal: set while the
-- report is public, or hidden from a public status (the map must drop it); null otherwise.
create function public.moderation_effect(p_report uuid, p_promote jsonb default '[]', p_demote jsonb default '[]')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'report', (select jsonb_build_object('id', r.id, 'status', r.status,
                                         'confirm_count', r.confirm_count, 'comment_count', r.comment_count)
               from public.reports r
               where r.id = p_report
                 and (r.status in ('open', 'fix_claimed', 'resolved')
                      or (r.status = 'hidden' and r.hidden_from in ('open', 'fix_claimed', 'resolved')))),
    'promote', coalesce(p_promote, '[]'::jsonb),
    'demote', coalesce(p_demote, '[]'::jsonb));
$$;

-- ---------------------------------------------------------------- approve
-- Null p_category / p_danger / blank p_title keep the current value.
-- Location modes: keep | exact (true point) | fuzz (new random point <= 150 m) | point (admin pin,
-- inside Thailand and <= 1000 m from the true point). A hazard approved with 'keep' while its
-- published point equals the true point (e.g. the admin just changed the category to hazard) is
-- fuzzed: only 'exact', an explicit choice, publishes a hazard's true point.
create function public.admin_approve_report(
  p_admin uuid, p_report uuid, p_category text, p_danger int, p_title text,
  p_location_mode text, p_lng float8, p_lat float8
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.reports;
  v_cat public.categories;
  v_title text := nullif(btrim(p_title), '');
  v_public extensions.geography;
  v_promote jsonb;
  v_old_default text;
  v_detail jsonb := jsonb_build_object('location_mode', p_location_mode);
begin
  select * into v_r from public.reports r where r.id = p_report for update;
  if not found then
    raise exception 'report_not_found';
  end if;
  if v_r.status <> 'pending_review' then
    raise exception 'invalid_state';
  end if;

  if p_category is null then
    select * into v_cat from public.categories c where c.id = v_r.category_id;
  else
    select * into v_cat from public.categories c where c.slug = p_category;
    if not found then
      raise exception 'invalid_report';
    end if;
    v_detail := v_detail || jsonb_build_object('category', p_category);
  end if;
  select btrim(c.name_th || ' ' || coalesce(v_r.place_name, '')) into v_old_default
  from public.categories c where c.id = v_r.category_id;
  if p_danger is not null then
    if p_danger not between 0 and 3 then
      raise exception 'invalid_report';
    end if;
    v_detail := v_detail || jsonb_build_object('danger_level', p_danger);
  end if;
  if v_title is not null then
    if char_length(v_title) > 120 then
      raise exception 'invalid_report';
    end if;
    v_detail := v_detail || jsonb_build_object('title', v_title);
  end if;

  if p_location_mode is null or p_location_mode not in ('keep', 'exact', 'fuzz', 'point') then
    raise exception 'invalid_request';
  elsif p_location_mode = 'keep' then
    v_public := v_r.public_location;
  elsif p_location_mode = 'exact' then
    v_public := v_r.location;
  elsif p_location_mode = 'fuzz' then
    v_public := public.fuzz_point(v_r.location, 150);
  else
    if p_lng is null or p_lat is null
       or p_lng not between 97.3 and 105.7 or p_lat not between 5.6 and 20.5 then
      raise exception 'invalid_location';
    end if;
    v_public := extensions.st_point(p_lng, p_lat, 4326)::extensions.geography;
    if extensions.st_distance(v_public, v_r.location) > 1000 then
      raise exception 'invalid_location';
    end if;
  end if;

  -- 'point' too: a pin dropped on the exact true spot is not the explicit 'exact' choice
  if v_cat.slug = 'hazard' and p_location_mode in ('keep', 'point')
     and extensions.st_equals(v_public::extensions.geometry, v_r.location::extensions.geometry) then
    v_public := public.fuzz_point(v_r.location, 150);
  end if;

  -- reports_refresh_place renames place_name when public_location changes.
  update public.reports r
     set category_id = v_cat.id,
         danger_level = coalesce(p_danger, r.danger_level),
         title = coalesce(v_title, r.title),
         public_location = v_public,
         status = 'open',
         approved_at = now(),
         reject_reason = null
   where r.id = p_report;

  -- A default title names the category and the area of the old published point. Rebuild it from
  -- the new ones, so a hazard's title can never name the area of its true point.
  if v_title is null then
    update public.reports r
       set title = btrim(v_cat.name_th || ' ' || coalesce(r.place_name, ''))
     where r.id = p_report
       and r.title = v_old_default;
  end if;

  -- Photos move to the public bucket under the report's id; the API moves the files.
  with old as (
    select ph.id, ph.storage_path, ph.created_at
    from public.report_photos ph
    where ph.report_id = p_report and ph.kind = 'before'
  ), moved as (
    update public.report_photos ph
       set storage_path = p_report::text || '/' || ph.id::text || '.webp'
      from old
     where ph.id = old.id
    returning old.storage_path as from_path, ph.storage_path as to_path, old.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('from', from_path, 'to', to_path) order by created_at), '[]'::jsonb)
    into v_promote
  from moved;

  perform public.log_action(p_admin, 'approve_report', 'report', p_report, v_detail);
  return public.moderation_effect(p_report, v_promote);
end;
$$;

-- ---------------------------------------------------------------- reject
-- Only a report waiting for review can be rejected; a public one is hidden instead.
-- 'other' with a note stores the note itself as the reason (the /me page shows it as written).
create function public.admin_reject_report(p_admin uuid, p_report uuid, p_reason text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_note text := nullif(btrim(p_note), '');
begin
  select r.status into v_status from public.reports r where r.id = p_report for update;
  if not found then
    raise exception 'report_not_found';
  end if;
  if v_status <> 'pending_review' then
    raise exception 'invalid_state';
  end if;
  if p_reason is null or p_reason not in ('duplicate', 'not_public', 'inappropriate', 'insufficient', 'other') then
    raise exception 'invalid_request';
  end if;
  if char_length(v_note) > 200 then
    raise exception 'invalid_note';
  end if;

  update public.reports r
     set status = 'rejected',
         reject_reason = case when p_reason = 'other' and v_note is not null then v_note else p_reason end
   where r.id = p_report;

  perform public.log_action(p_admin, 'reject_report', 'report', p_report,
                            jsonb_strip_nulls(jsonb_build_object('reason', p_reason, 'note', v_note)));
  return public.moderation_effect(p_report);
end;
$$;

-- ---------------------------------------------------------------- plan 4 carry-over
-- A null quota counts as 0 (every call is rate_limited) instead of switching the quota off.
-- register_photo, create_report, add_comment: `create or replace` with the SAME signature and a body
-- copied line for line from 20261018000200_report_create.sql, except `>= p_limit` becomes
-- `>= coalesce(p_limit, 0)`. (merge_duplicate calls add_comment, so it is covered too.)

create or replace function public.register_photo(
  p_id uuid, p_uploader uuid, p_path text, p_width int, p_height int, p_blurred boolean, p_limit int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.lock_profile(p_uploader);
  if (select count(*) from public.report_photos ph
      where ph.uploader_id = p_uploader and ph.created_at > now() - interval '24 hours') >= coalesce(p_limit, 0) then
    raise exception 'rate_limited';
  end if;

  insert into public.report_photos (id, report_id, uploader_id, kind, storage_path, width, height, blurred)
  values (p_id, null, p_uploader, 'before', p_path, p_width, p_height, coalesce(p_blurred, false));
end;
$$;

create or replace function public.create_report(
  p_user uuid, p_category text, p_lng float8, p_lat float8, p_photo_ids uuid[], p_title text,
  p_description text, p_danger int, p_tags text[], p_hide_author boolean, p_flagged boolean, p_limit int
)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.categories;
  v_location extensions.geography;
  v_public extensions.geography;
  v_place text;
  v_title text;
  v_danger int;
  v_desc text := nullif(btrim(p_description), '');
  v_tags text[];
  v_id uuid;
begin
  perform public.lock_profile(p_user);
  if (select count(*) from public.reports r
      where r.author_id = p_user and r.created_at > now() - interval '24 hours') >= coalesce(p_limit, 0) then
    raise exception 'rate_limited';
  end if;

  select * into v_cat from public.categories c where c.slug = p_category;
  if not found or p_lng is null or p_lat is null then
    raise exception 'invalid_report';
  end if;

  perform public.claim_photos(p_user, p_photo_ids);

  -- Tags arrive normalised from the API; normalise again so a direct caller cannot break the rules.
  select coalesce(array_agg(distinct t), '{}') into v_tags
  from (select lower(ltrim(btrim(x), '#')) as t from unnest(coalesce(p_tags, '{}'::text[])) x) s;
  if cardinality(v_tags) > 5
     or exists (select 1 from unnest(v_tags) t where t is null or char_length(t) not between 1 and 30) then
    raise exception 'invalid_report';
  end if;

  v_danger := coalesce(p_danger, v_cat.default_level);
  if v_danger not between 0 and 3 or char_length(coalesce(v_desc, '')) > 1000 then
    raise exception 'invalid_report';
  end if;

  -- Hazards never publish the true point; the place name and default title come from the
  -- published point so they cannot leak it either.
  v_location := extensions.st_point(p_lng, p_lat, 4326)::extensions.geography;
  v_public := case when v_cat.slug = 'hazard' then public.fuzz_point(v_location, 150) else v_location end;
  v_place := public.area_name_at(extensions.st_x(v_public::extensions.geometry),
                                 extensions.st_y(v_public::extensions.geometry));
  v_title := coalesce(nullif(btrim(p_title), ''), btrim(v_cat.name_th || ' ' || coalesce(v_place, '')));
  if char_length(v_title) > 120 then
    raise exception 'invalid_report';
  end if;

  insert into public.reports (author_id, category_id, danger_level, title, description, status,
                              location, public_location, place_name, hide_author, profanity_flag, approved_at)
  values (p_user, v_cat.id, v_danger, v_title, v_desc, 'pending_review',
          v_location, v_public, v_place, coalesce(p_hide_author, false), coalesce(p_flagged, false), null)
  returning reports.id into v_id;

  update public.report_photos ph set report_id = v_id where ph.id = any (p_photo_ids);

  if cardinality(v_tags) > 0 then
    insert into public.tags (name) select unnest(v_tags) on conflict (name) do nothing;
    insert into public.report_tags (report_id, tag_id)
      select v_id, t.id from public.tags t where t.name = any (v_tags)
      on conflict do nothing;
  end if;

  return query select v_id, 'pending_review'::text;
end;
$$;

-- Searches the published point only: searching the true location of a hazard would let a
-- caller narrow it down by probing (trilateration). Returns no coordinates or distances.
-- The radius is clamped to 0..200 m whatever the caller passes.
create or replace function public.find_duplicates(p_lng float8, p_lat float8, p_category text, p_radius float8 default 50)
returns table (id uuid, title text, category text, status text, danger_level int, confirm_count int, cover_photo_path text)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.title, pr.category, pr.status, pr.danger_level::int, pr.confirm_count, pr.cover_photo_path
  from public.public_reports pr
  join public.reports r on r.id = pr.id
  where pr.category = p_category
    and pr.status in ('open', 'fix_claimed')
    and extensions.st_dwithin(r.public_location,
                              extensions.st_point(p_lng, p_lat, 4326)::extensions.geography,
                              least(greatest(coalesce(p_radius, 50), 0), 200))
  order by extensions.st_distance(r.public_location,
                                  extensions.st_point(p_lng, p_lat, 4326)::extensions.geography), pr.id
  limit 3;
$$;

create or replace function public.add_comment(p_report uuid, p_user uuid, p_body text, p_limit int, p_photo uuid default null)
returns table (comment_id uuid, status text, confirm_count int, comment_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.lock_profile(p_user);

  perform 1 from public.public_reports pr where pr.id = p_report;
  if not found then
    raise exception 'report_not_found';
  end if;

  if (select count(*) from public.comments cm
      where cm.author_id = p_user and cm.created_at > now() - interval '24 hours') >= coalesce(p_limit, 0) then
    raise exception 'rate_limited';
  end if;

  if p_photo is not null and not exists (
       select 1 from public.report_photos ph
       where ph.id = p_photo and ph.uploader_id = p_user and ph.report_id = p_report and ph.kind = 'comment'
         and not exists (select 1 from public.comments cm where cm.photo_id = p_photo)) then
    raise exception 'invalid_photos';
  end if;

  insert into public.comments (report_id, author_id, body, photo_id)
  values (p_report, p_user, btrim(p_body), p_photo)
  returning id into v_id;

  return query
    select v_id, r.status, r.confirm_count, r.comment_count
    from public.reports r where r.id = p_report;
end;
$$;

-- ---------------------------------------------------------------- privileges
revoke execute on function public.log_action(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.moderation_effect(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_approve_report(uuid, uuid, text, int, text, text, float8, float8)
  from public, anon, authenticated;
revoke execute on function public.admin_reject_report(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.log_action(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.moderation_effect(uuid, jsonb, jsonb) to service_role;
grant execute on function public.admin_approve_report(uuid, uuid, text, int, text, text, float8, float8) to service_role;
grant execute on function public.admin_reject_report(uuid, uuid, text, text) to service_role;
