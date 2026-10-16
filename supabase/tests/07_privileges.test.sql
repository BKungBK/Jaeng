begin;
select plan(9);

-- Every table in public has RLS, so a forgotten `enable row level security` fails here.
select is(
  array(select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1),
  '{}'::text[],
  'every public table has row level security');

-- Table-level SELECT only where a policy or the spec needs it (spec 5.3).
select ok(not has_table_privilege('anon', 'public.reports', 'select'), 'anon has no SELECT on reports');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon has no SELECT on profiles');
select ok(not has_table_privilege('authenticated', 'public.flags', 'select'), 'authenticated has no SELECT on flags');
select ok(has_table_privilege('anon', 'public.categories', 'select'), 'anon reads categories');
select ok(has_table_privilege('authenticated', 'public.reports', 'select'), 'authenticated reads own reports (RLS-scoped)');
select ok(has_table_privilege('anon', 'public.public_reports', 'select'), 'anon reads public_reports');

-- Tables added by later migrations start closed.
create table public.zz_privilege_probe (id int);
select ok(not has_table_privilege('anon', 'public.zz_privilege_probe', 'select'),
  'new tables give anon no SELECT by default');

-- Server-side helpers are not part of the client API.
select ok(not has_function_privilege('anon', 'public.area_name_at(float8, float8)', 'execute'),
  'anon cannot call area_name_at');

select * from finish();
rollback;
