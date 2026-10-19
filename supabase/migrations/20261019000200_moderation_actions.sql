-- Plan 5 task 3: fix claims, flags with auto-hide, hide / restore and bans. Same rules as task 2:
-- security definer, service_role only, the target row is locked before its state is checked, every
-- change is logged in the same transaction, and each call returns a moderation_effect jsonb.

-- ---------------------------------------------------------------- photo paths that are public
-- The files of a report that sit in photos-public while the report is public: before/after photos,
-- and comment photos whose comment is visible. Claim photos are never public before approval, and the
-- photo of a comment hidden on its own stays private when the report is restored (ruling 1).
create function public.report_public_paths(p_report uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(ph.storage_path order by ph.created_at, ph.id), '[]'::jsonb)
  from public.report_photos ph
  where ph.report_id = p_report
    and (ph.kind in ('before', 'after')
         or (ph.kind = 'comment'
             and exists (select 1 from public.comments cm where cm.photo_id = ph.id and cm.status = 'visible')));
$$;

-- ---------------------------------------------------------------- fix claims
create function public.create_fix_claim(p_user uuid, p_report uuid, p_note text, p_photo uuid, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_note text := nullif(btrim(p_note), '');
  v_claim uuid;
begin
  perform public.lock_profile(p_user);
  if (select count(*) from public.fix_claims fc
      where fc.claimant_id = p_user and fc.created_at > now() - interval '24 hours') >= coalesce(p_limit, 0) then
    raise exception 'rate_limited';
  end if;

  select r.status into v_status from public.reports r where r.id = p_report for update;
  if not found or v_status not in ('open', 'fix_claimed', 'resolved') then
    raise exception 'report_not_found';
  end if;
  if v_status = 'resolved' then
    raise exception 'already_resolved';
  end if;
  if v_status = 'fix_claimed' then
    raise exception 'claim_pending';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'invalid_note';
  end if;

  -- The photo stays in the claimant's private folder until an admin approves the claim.
  if p_photo is not null then
    perform public.claim_photos(p_user, array[p_photo]);
    update public.report_photos ph set report_id = p_report, kind = 'claim' where ph.id = p_photo;
  end if;

  insert into public.fix_claims (report_id, claimant_id, note, photo_id)
  values (p_report, p_user, v_note, p_photo)
  returning id into v_claim;
  update public.reports r set status = 'fix_claimed' where r.id = p_report;

  return public.moderation_effect(p_report) || jsonb_build_object('claim_id', v_claim);
end;
$$;

-- Approve: the report is resolved and the claim photo becomes a public 'after' photo.
-- Reject: the report goes back to open; approved_at is kept, so "days open" keeps counting (spec 3.8).
create function public.admin_review_fix_claim(p_admin uuid, p_claim uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.fix_claims;
  v_status text;
  v_promote jsonb := '[]'::jsonb;
begin
  select * into v_c from public.fix_claims fc where fc.id = p_claim for update;
  if not found then
    raise exception 'item_not_found';
  end if;
  if v_c.status <> 'pending' or p_approve is null then
    raise exception 'invalid_state';
  end if;
  -- A report hidden while the claim waits keeps the claim pending, but it cannot be reviewed.
  select r.status into v_status from public.reports r where r.id = v_c.report_id for update;
  if v_status is distinct from 'fix_claimed' then
    raise exception 'invalid_state';
  end if;

  update public.fix_claims fc
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = p_admin,
         reviewed_at = now()
   where fc.id = p_claim;

  if p_approve then
    update public.reports r set status = 'resolved', resolved_at = now() where r.id = v_c.report_id;
    with old as (
      select ph.id, ph.storage_path from public.report_photos ph
      where ph.id = v_c.photo_id and ph.kind = 'claim'
    ), moved as (
      update public.report_photos ph
         set kind = 'after', storage_path = v_c.report_id::text || '/' || ph.id::text || '.webp'
        from old
       where ph.id = old.id
      returning old.storage_path as from_path, ph.storage_path as to_path
    )
    select coalesce(jsonb_agg(jsonb_build_object('from', from_path, 'to', to_path)), '[]'::jsonb)
      into v_promote
    from moved;
    perform public.log_action(p_admin, 'approve_claim', 'report', v_c.report_id,
                              jsonb_build_object('claim_id', p_claim));
  else
    update public.reports r set status = 'open', resolved_at = null where r.id = v_c.report_id;
    perform public.log_action(p_admin, 'reject_claim', 'report', v_c.report_id,
                              jsonb_build_object('claim_id', p_claim));
  end if;

  return public.moderation_effect(v_c.report_id, v_promote);
end;
$$;

-- ---------------------------------------------------------------- hide / restore
-- Internal: p_admin is null for the system (auto-hide). p_action is 'hide' or 'auto_hide'.
create function public.hide_target(p_admin uuid, p_target_type text, p_target_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_report uuid;
  v_photo uuid;
  v_demote jsonb := '[]'::jsonb;
begin
  if p_target_type = 'report' then
    select r.status into v_status from public.reports r where r.id = p_target_id for update;
    if not found then
      raise exception 'report_not_found';
    end if;
    if v_status in ('hidden', 'rejected') then
      raise exception 'invalid_state';
    end if;
    if v_status in ('open', 'fix_claimed', 'resolved') then
      v_demote := public.report_public_paths(p_target_id);
    end if;
    update public.reports r set hidden_from = v_status, status = 'hidden' where r.id = p_target_id;
    v_report := p_target_id;
  elsif p_target_type = 'comment' then
    select cm.status, cm.report_id, cm.photo_id into v_status, v_report, v_photo
    from public.comments cm where cm.id = p_target_id for update;
    if not found then
      raise exception 'item_not_found';
    end if;
    if v_status = 'hidden' then
      raise exception 'invalid_state';
    end if;
    select r.status into v_status from public.reports r where r.id = v_report for update;
    if v_photo is not null and v_status in ('open', 'fix_claimed', 'resolved') then
      select coalesce(jsonb_agg(ph.storage_path), '[]'::jsonb) into v_demote
      from public.report_photos ph where ph.id = v_photo and ph.report_id = v_report;
    end if;
    update public.comments cm set status = 'hidden' where cm.id = p_target_id;
  else
    raise exception 'invalid_request';
  end if;

  perform public.log_action(p_admin, p_action, p_target_type, p_target_id,
                            jsonb_build_object('target_type', p_target_type));
  return public.moderation_effect(v_report, '[]'::jsonb, v_demote);
end;
$$;

create function public.admin_hide(p_admin uuid, p_target_type text, p_target_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.hide_target(p_admin, p_target_type, p_target_id, 'hide');
$$;

-- Puts a hidden report back in the status it had (pending_review when unknown), or a hidden comment
-- back to visible, and lists the files to move back to photos-public when the report is public.
create function public.admin_restore(p_admin uuid, p_target_type text, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_from text;
  v_report uuid;
  v_photo uuid;
  v_paths jsonb := '[]'::jsonb;
begin
  if p_target_type = 'report' then
    select r.status, r.hidden_from into v_status, v_from from public.reports r where r.id = p_target_id for update;
    if not found then
      raise exception 'report_not_found';
    end if;
    if v_status <> 'hidden' then
      raise exception 'invalid_state';
    end if;
    v_status := coalesce(v_from, 'pending_review');
    update public.reports r set status = v_status, hidden_from = null where r.id = p_target_id;
    if v_status in ('open', 'fix_claimed', 'resolved') then
      v_paths := public.report_public_paths(p_target_id);
    end if;
    v_report := p_target_id;
  elsif p_target_type = 'comment' then
    select cm.status, cm.report_id, cm.photo_id into v_status, v_report, v_photo
    from public.comments cm where cm.id = p_target_id for update;
    if not found then
      raise exception 'item_not_found';
    end if;
    if v_status <> 'hidden' then
      raise exception 'invalid_state';
    end if;
    select r.status into v_status from public.reports r where r.id = v_report for update;
    update public.comments cm set status = 'visible' where cm.id = p_target_id;
    if v_photo is not null and v_status in ('open', 'fix_claimed', 'resolved') then
      select coalesce(jsonb_agg(ph.storage_path), '[]'::jsonb) into v_paths
      from public.report_photos ph where ph.id = v_photo and ph.report_id = v_report;
    end if;
  else
    raise exception 'invalid_request';
  end if;

  -- Restoring is the admin's decision that the content may stay: its open flags are settled, so one
  -- more flag (even a repeat from an earlier flagger) cannot hide it again at once.
  update public.flags f set status = 'dismissed'
  where f.target_type = p_target_type and f.target_id = p_target_id and f.status = 'open';

  perform public.log_action(p_admin, 'restore', p_target_type, p_target_id,
                            jsonb_build_object('target_type', p_target_type));
  return public.moderation_effect(
    v_report,
    (select coalesce(jsonb_agg(jsonb_build_object('from', p, 'to', p)), '[]'::jsonb)
     from jsonb_array_elements_text(v_paths) p));
end;
$$;

-- ---------------------------------------------------------------- bans
create function public.admin_set_ban(p_admin uuid, p_user uuid, p_banned boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select pf.role into v_role from public.profiles pf where pf.id = p_user for update;
  if not found then
    raise exception 'item_not_found';
  end if;
  if v_role = 'admin' then
    raise exception 'cannot_ban_admin';
  end if;
  if p_banned is null then
    raise exception 'invalid_request';
  end if;
  update public.profiles pf
     set banned_at = case when p_banned then coalesce(pf.banned_at, now()) else null end
   where pf.id = p_user;
  perform public.log_action(p_admin, case when p_banned then 'ban' else 'unban' end, 'user', p_user,
                            jsonb_build_object('user_name', (select pf.display_name from public.profiles pf where pf.id = p_user)));
  return public.moderation_effect(null);
end;
$$;

-- ---------------------------------------------------------------- flags
-- One open flag per member and target (a repeat changes nothing). Three distinct members with open
-- flags hide the target (spec 6.2; comments too). The target row is locked first, so concurrent
-- flags are counted one after another and exactly one of them hides it.
create function public.create_flag(p_user uuid, p_target_type text, p_target_id uuid, p_reason text,
                                   p_note text, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_report uuid;
  v_flag uuid;
  v_count int;
begin
  perform public.lock_profile(p_user);
  if (select count(*) from public.flags f
      where f.reporter_id = p_user and f.created_at > now() - interval '24 hours') >= coalesce(p_limit, 0) then
    raise exception 'rate_limited';
  end if;

  if p_target_type = 'report' then
    perform 1 from public.reports r where r.id = p_target_id for update;
    if not exists (select 1 from public.public_reports pr where pr.id = p_target_id) then
      raise exception 'report_not_found';
    end if;
  elsif p_target_type = 'comment' then
    select cm.report_id into v_report from public.comments cm
    where cm.id = p_target_id and cm.status = 'visible' for update;
    if not found or not exists (select 1 from public.public_reports pr where pr.id = v_report) then
      raise exception 'item_not_found';
    end if;
  else
    raise exception 'invalid_request';
  end if;
  if p_reason is null or p_reason not in ('spam', 'false', 'personal_attack', 'privacy', 'other') then
    raise exception 'invalid_request';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'invalid_note';
  end if;

  insert into public.flags (target_type, target_id, reporter_id, reason, note)
  values (p_target_type, p_target_id, p_user, p_reason, v_note)
  on conflict (target_type, target_id, reporter_id) where status = 'open' do nothing
  returning id into v_flag;
  if v_flag is null then
    select f.id into v_flag from public.flags f
    where f.target_type = p_target_type and f.target_id = p_target_id
      and f.reporter_id = p_user and f.status = 'open';
  end if;

  select count(distinct f.reporter_id) into v_count from public.flags f
  where f.target_type = p_target_type and f.target_id = p_target_id and f.status = 'open';
  if v_count >= 3 then
    return public.hide_target(null, p_target_type, p_target_id, 'auto_hide')
           || jsonb_build_object('flag_id', v_flag, 'hidden', true);
  end if;
  return public.moderation_effect(null) || jsonb_build_object('flag_id', v_flag, 'hidden', false);
end;
$$;

-- Resolves every open flag of the target of p_flag:
--   dismiss: flags dismissed; a hidden target is restored
--   hide:    target hidden (unless it already is); flags actioned
--   ban:     as hide, then the target's owner is banned (cannot_ban_admin rolls everything back)
create function public.admin_resolve_flags(p_admin uuid, p_flag uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.flags;
  v_hidden boolean;
  v_owner uuid;
  v_effect jsonb;
begin
  select * into v_f from public.flags f where f.id = p_flag for update;
  if not found then
    raise exception 'item_not_found';
  end if;
  if v_f.status <> 'open' then
    raise exception 'invalid_state';
  end if;
  if p_action is null or p_action not in ('dismiss', 'hide', 'ban') then
    raise exception 'invalid_request';
  end if;
  -- the target first (the order create_flag and hide_target lock in), then its open flags
  if v_f.target_type = 'report' then
    perform 1 from public.reports r where r.id = v_f.target_id for update;
  else
    perform 1 from public.comments cm where cm.id = v_f.target_id for update;
  end if;
  perform 1 from public.flags f
  where f.target_type = v_f.target_type and f.target_id = v_f.target_id and f.status = 'open'
  for update;

  if v_f.target_type = 'report' then
    select r.status = 'hidden', r.author_id into v_hidden, v_owner from public.reports r where r.id = v_f.target_id;
  else
    select cm.status = 'hidden', cm.author_id into v_hidden, v_owner from public.comments cm where cm.id = v_f.target_id;
  end if;
  if v_owner is null then
    raise exception 'item_not_found';
  end if;

  if p_action = 'dismiss' then
    update public.flags f set status = 'dismissed'
    where f.target_type = v_f.target_type and f.target_id = v_f.target_id and f.status = 'open';
    if v_hidden then
      v_effect := public.admin_restore(p_admin, v_f.target_type, v_f.target_id);
    else
      v_effect := public.moderation_effect(null);
    end if;
    perform public.log_action(p_admin, 'dismiss_flags', v_f.target_type, v_f.target_id,
                              jsonb_build_object('target_type', v_f.target_type));
  else
    if v_hidden then
      v_effect := public.moderation_effect(null);
    else
      v_effect := public.hide_target(p_admin, v_f.target_type, v_f.target_id, 'hide');
    end if;
    update public.flags f set status = 'actioned'
    where f.target_type = v_f.target_type and f.target_id = v_f.target_id and f.status = 'open';
    if p_action = 'ban' then
      perform public.admin_set_ban(p_admin, v_owner, true);
    end if;
  end if;
  return v_effect;
end;
$$;

-- ---------------------------------------------------------------- privileges
revoke execute on function public.report_public_paths(uuid) from public, anon, authenticated;
revoke execute on function public.create_fix_claim(uuid, uuid, text, uuid, int) from public, anon, authenticated;
revoke execute on function public.admin_review_fix_claim(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.hide_target(uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_hide(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.admin_restore(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.admin_set_ban(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.create_flag(uuid, text, uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public.admin_resolve_flags(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.create_fix_claim(uuid, uuid, text, uuid, int) to service_role;
grant execute on function public.admin_review_fix_claim(uuid, uuid, boolean) to service_role;
grant execute on function public.admin_hide(uuid, text, uuid) to service_role;
grant execute on function public.admin_restore(uuid, text, uuid) to service_role;
grant execute on function public.admin_set_ban(uuid, uuid, boolean) to service_role;
grant execute on function public.create_flag(uuid, text, uuid, text, text, int) to service_role;
grant execute on function public.admin_resolve_flags(uuid, uuid, text) to service_role;
