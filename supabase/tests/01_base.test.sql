begin;
select plan(9);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'categories', 'categories table exists');
select has_table('public', 'admin_areas', 'admin_areas table exists');

-- A new auth user gets a profile automatically.
select tests.create_user('a@x.test') as uid \gset
select results_eq(
  format($q$select role, locale from public.profiles where id = %L$q$, :'uid'),
  $$values ('user'::text, 'th'::text)$$,
  'new user gets a profile with role user and locale th'
);
select matches(
  (select display_name from public.profiles where id = :'uid'),
  '^เพื่อนบ้าน[0-9]{4}$',
  'default display name is เพื่อนบ้าน + 4 digits'
);

select is((select count(*)::int from public.categories), 8, 'eight core categories');
select is(
  (select array_agg(slug order by sort) from public.categories),
  array['road','light','water','flood','waste','tree','hazard','other']::text[],
  'category slugs in display order'
);
select results_eq(
  $$select default_level::int from public.categories where slug in ('flood','waste') order by slug$$,
  $$values (2), (0)$$,
  'flood defaults to level 2, waste to level 0'
);

select throws_ok(
  format($q$update public.profiles set role = 'god' where id = %L$q$, :'uid'),
  '23514',
  null,
  'role must be user or admin'
);

select * from finish();
rollback;
