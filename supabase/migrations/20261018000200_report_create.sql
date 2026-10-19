-- Plan 4 task 3: creating reports, the photo registry, the duplicate check and merge,
-- daily quotas and the orphan-photo sweep. Every rule that must hold under concurrent
-- requests lives here; the API only validates shapes and calls these as service_role.
--
-- Quotas lock the caller's profiles row first (select ... for update), so parallel calls of
-- the same user serialise and the count they read is never stale.

-- Reports with words from the profanity list are accepted but flagged for admins (spec 6.2).
alter table public.reports add column profanity_flag boolean not null default false;

-- ---------------------------------------------------------------- public_comments.photo_path
-- New column at the end: create or replace view cannot reorder existing ones.
-- The path shows only when the photo belongs to the same report as the comment.
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
    where ph.id = cm.photo_id and ph.report_id = cm.report_id) as photo_path
from public.comments cm
join public.profiles p on p.id = cm.author_id
join public.reports r on r.id = cm.report_id
where cm.status = 'visible'
  and cm.report_id in (select id from public.public_reports);

-- ---------------------------------------------------------------- quota helper
-- Locks the user's profile row; every quota check calls this before counting.
-- (A missing profile needs no error here: the insert that follows fails on its foreign key.)
create function public.lock_profile(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.profiles pf where pf.id = p_user for update;
end;
$$;

-- ---------------------------------------------------------------- photos
create function public.register_photo(
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
      where ph.uploader_id = p_uploader and ph.created_at > now() - interval '24 hours') >= p_limit then
    raise exception 'rate_limited';
  end if;

  insert into public.report_photos (id, report_id, uploader_id, kind, storage_path, width, height, blurred)
  values (p_id, null, p_uploader, 'before', p_path, p_width, p_height, coalesce(p_blurred, false));
end;
$$;

-- Locks and checks a list of fresh uploads: 1..4 distinct ids, each an unattached 'before'
-- photo of p_user. Row locks make a concurrent double submit see the photos as taken.
create function public.claim_photos(p_user uuid, p_photo_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := coalesce(cardinality(p_photo_ids), 0);
  v_ok int;
begin
  if v_n not between 1 and 4
     or array_position(p_photo_ids, null) is not null
     or (select count(distinct x) from unnest(p_photo_ids) x) <> v_n then
    raise exception 'invalid_photos';
  end if;

  select count(*) into v_ok
  from (select 1 from public.report_photos ph
        where ph.id = any (p_photo_ids)
          and ph.uploader_id = p_user
          and ph.report_id is null
          and ph.kind = 'before'
        for update) s;
  if v_ok <> v_n then
    raise exception 'invalid_photos';
  end if;
end;
$$;

-- ---------------------------------------------------------------- create_report
create function public.create_report(
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
      where r.author_id = p_user and r.created_at > now() - interval '24 hours') >= p_limit then
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

-- ---------------------------------------------------------------- duplicates
-- Searches the published point only: searching the true location of a hazard would let a
-- caller narrow it down by probing (trilateration). Returns no coordinates or distances.
create function public.find_duplicates(p_lng float8, p_lat float8, p_category text, p_radius float8 default 50)
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
                              extensions.st_point(p_lng, p_lat, 4326)::extensions.geography, p_radius)
  order by extensions.st_distance(r.public_location,
                                  extensions.st_point(p_lng, p_lat, 4326)::extensions.geography), pr.id
  limit 3;
$$;

-- ---------------------------------------------------------------- add_comment (with quota)
drop function public.add_comment(uuid, uuid, text);

-- p_photo is set by merge_duplicate only: it must already be a comment photo of this report
-- uploaded by p_user and not used by another comment.
create function public.add_comment(p_report uuid, p_user uuid, p_body text, p_limit int, p_photo uuid default null)
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
      where cm.author_id = p_user and cm.created_at > now() - interval '24 hours') >= p_limit then
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

-- ---------------------------------------------------------------- merge_duplicate
-- "Me too, with a photo" on an existing report: confirm (never toggles off), move the first
-- photo onto the report as a comment photo, and add a comment that shows it. Any error rolls
-- the whole call back, so a failed merge never leaves a stray +1.
create function public.merge_duplicate(p_target uuid, p_user uuid, p_photo_ids uuid[], p_limit int)
returns table (confirmed boolean, status text, confirm_count int, comment_count int, comment_id uuid, moved jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_photo uuid;
  v_from text;
  v_to text;
  v_comment uuid;
begin
  perform public.lock_profile(p_user);

  perform 1 from public.reports r where r.id = p_target for update;
  select pr.status into v_status from public.public_reports pr where pr.id = p_target;
  if v_status is null then
    raise exception 'report_not_found';
  end if;
  if v_status = 'resolved' then
    raise exception 'report_resolved';
  end if;

  perform public.claim_photos(p_user, p_photo_ids);

  insert into public.confirmations (report_id, user_id) values (p_target, p_user)
  on conflict do nothing;

  v_photo := p_photo_ids[1];
  v_to := p_target::text || '/' || v_photo::text || '.webp';
  select ph.storage_path into v_from from public.report_photos ph where ph.id = v_photo;
  update public.report_photos ph
     set report_id = p_target, kind = 'comment', storage_path = v_to
   where ph.id = v_photo;

  select a.comment_id into v_comment
  from public.add_comment(p_target, p_user, 'เจอเหมือนกัน แนบรูปเพิ่ม', p_limit, v_photo) a;

  return query
    select true, r.status, r.confirm_count, r.comment_count, v_comment,
           jsonb_build_array(jsonb_build_object('from', v_from, 'to', v_to))
    from public.reports r where r.id = p_target;
end;
$$;

-- ---------------------------------------------------------------- orphan sweep
-- Deleting is the claim: two sweepers running at once never get the same row.
create function public.delete_orphan_photos(p_older_than interval)
returns table (id uuid, storage_path text)
language sql
security definer
set search_path = public
as $$
  delete from public.report_photos ph
  where ph.report_id is null and ph.created_at < now() - p_older_than
  returning ph.id, ph.storage_path;
$$;

-- ---------------------------------------------------------------- tag suggestions
-- Only tags on published reports are suggested, so a tag on a report still waiting for
-- review is never shown to anyone.
create function public.suggest_tags(q text, max_rows int default 8)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select t.name
  from public.tags t
  join public.report_tags rt on rt.tag_id = t.id
  where rt.report_id in (select pr.id from public.public_reports pr)
    and t.name like '%' || public.escape_like(lower(ltrim(btrim(coalesce(q, '')), '#'))) || '%' escape '\'
  group by t.name
  order by count(*) desc, t.name
  limit greatest(least(coalesce(max_rows, 8), 20), 0);
$$;

-- ---------------------------------------------------------------- privileges
revoke execute on function public.lock_profile(uuid) from public, anon, authenticated;
revoke execute on function public.claim_photos(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.register_photo(uuid, uuid, text, int, int, boolean, int) from public, anon, authenticated;
revoke execute on function public.create_report(uuid, text, float8, float8, uuid[], text, text, int, text[], boolean, boolean, int)
  from public, anon, authenticated;
revoke execute on function public.find_duplicates(float8, float8, text, float8) from public, anon, authenticated;
revoke execute on function public.add_comment(uuid, uuid, text, int, uuid) from public, anon, authenticated;
revoke execute on function public.merge_duplicate(uuid, uuid, uuid[], int) from public, anon, authenticated;
revoke execute on function public.delete_orphan_photos(interval) from public, anon, authenticated;
revoke execute on function public.suggest_tags(text, int) from public;

grant execute on function public.register_photo(uuid, uuid, text, int, int, boolean, int) to service_role;
grant execute on function public.create_report(uuid, text, float8, float8, uuid[], text, text, int, text[], boolean, boolean, int)
  to service_role;
grant execute on function public.find_duplicates(float8, float8, text, float8) to service_role;
grant execute on function public.add_comment(uuid, uuid, text, int, uuid) to service_role;
grant execute on function public.merge_duplicate(uuid, uuid, uuid[], int) to service_role;
grant execute on function public.delete_orphan_photos(interval) to service_role;
grant execute on function public.suggest_tags(text, int) to anon, authenticated, service_role;
