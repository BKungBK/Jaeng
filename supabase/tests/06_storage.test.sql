begin;
select plan(4);

select results_eq(
  $$select id, public from storage.buckets where id in ('photos-private', 'photos-public') order by id$$,
  $$values ('photos-private'::text, false), ('photos-public'::text, true)$$,
  'photo buckets exist with the right visibility'
);
select is(
  (select array_agg(distinct file_size_limit) from storage.buckets where id in ('photos-private', 'photos-public')),
  array[5242880::bigint],
  'both buckets cap files at 5 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'photos-public'),
  array['image/webp', 'image/jpeg'],
  'public bucket accepts webp and jpeg only'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'photos-private'),
  array['image/webp', 'image/jpeg'],
  'private bucket accepts webp and jpeg only'
);

select * from finish();
rollback;
