-- Row level security (spec 5.3). The browser only reads; every write goes through the API,
-- which uses the service role and bypasses RLS.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.admin_areas enable row level security;
alter table public.reports enable row level security;
alter table public.report_photos enable row level security;
alter table public.tags enable row level security;
alter table public.report_tags enable row level security;
alter table public.confirmations enable row level security;
alter table public.comments enable row level security;
alter table public.fix_claims enable row level security;
alter table public.flags enable row level security;
alter table public.moderation_log enable row level security;

-- No client writes anywhere, now or in tables added later.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

-- The one exception: users rename themselves and pick a language. Never role or banned_at.
grant update (display_name, locale) on public.profiles to authenticated;

create policy categories_select_all on public.categories
  for select to anon, authenticated using (true);

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- For the "ของฉัน" page: a reporter sees their own reports in every status.
create policy reports_select_own on public.reports
  for select to authenticated using (author_id = auth.uid());

grant select on public.public_reports, public.public_comments to anon, authenticated;
grant execute on function public.reports_in_bbox(float8, float8, float8, float8, int[], text[], text[], text)
  to anon, authenticated;
grant execute on function public.stats_in_bbox(float8, float8, float8, float8) to anon, authenticated;
