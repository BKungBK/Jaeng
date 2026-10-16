-- Test helpers shared by every pgTAP file. Committed (not rolled back) so later files can use them.
-- Lives only in the local test database: schema `tests` is not part of any migration.
begin;
select plan(1);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, '',
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), now()
  );
  return v_id;
end;
$$;

-- Act as a signed-in user for the rest of the transaction.
create or replace function tests.as_user(p_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Act as a visitor who is not signed in.
create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;

-- Back to the superuser that runs the tests.
create or replace function tests.as_owner()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select pass('test helpers installed');
select * from finish();
commit;
