-- Report detail panel (plan 3): photos on the public view, anonymous reporter comments,
-- own-confirmation reads, and atomic me-too / comment functions for the API.

-- New columns go at the end: create or replace view cannot reorder existing ones.
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
  r.created_at
from public.reports r
join public.categories c on c.id = r.category_id
join public.profiles p on p.id = r.author_id
where r.status in ('open', 'fix_claimed')
   or (r.status = 'resolved' and r.resolved_at > now() - interval '30 days');

create or replace view public.public_comments as
select
  cm.id,
  cm.report_id,
  cm.body,
  case when cm.author_id = r.author_id and r.hide_author then null else p.display_name end as author_name,
  cm.created_at,
  (cm.author_id = r.author_id) as by_reporter
from public.comments cm
join public.profiles p on p.id = cm.author_id
join public.reports r on r.id = cm.report_id
where cm.status = 'visible'
  and cm.report_id in (select id from public.public_reports);

-- Members may see which reports they have confirmed, and nothing else in the table.
create policy confirmations_select_own on public.confirmations
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.confirmations to authenticated;

-- Toggle a "me too". The report row is locked first so rapid clicks serialise.
create function public.toggle_confirmation(p_report uuid, p_user uuid)
returns table (confirmed boolean, status text, confirm_count int, comment_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_deleted int;
begin
  perform 1 from public.reports r where r.id = p_report for update;
  select pr.status into v_status from public.public_reports pr where pr.id = p_report;
  if v_status is null then
    raise exception 'report_not_found';
  end if;
  if v_status = 'resolved' then
    raise exception 'report_resolved';
  end if;

  delete from public.confirmations c where c.report_id = p_report and c.user_id = p_user;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    insert into public.confirmations (report_id, user_id) values (p_report, p_user);
  end if;

  return query
    select v_deleted = 0, r.status, r.confirm_count, r.comment_count
    from public.reports r where r.id = p_report;
end;
$$;

create function public.add_comment(p_report uuid, p_user uuid, p_body text)
returns table (comment_id uuid, status text, confirm_count int, comment_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform 1 from public.public_reports pr where pr.id = p_report;
  if not found then
    raise exception 'report_not_found';
  end if;

  insert into public.comments (report_id, author_id, body)
  values (p_report, p_user, btrim(p_body))
  returning id into v_id;

  return query
    select v_id, r.status, r.confirm_count, r.comment_count
    from public.reports r where r.id = p_report;
end;
$$;

revoke execute on function public.toggle_confirmation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.add_comment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.toggle_confirmation(uuid, uuid) to service_role;
grant execute on function public.add_comment(uuid, uuid, text) to service_role;
