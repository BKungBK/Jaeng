-- Photo buckets (spec 5.4). Only the API (service role) writes; no client storage policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos-private', 'photos-private', false, 5242880, array['image/webp', 'image/jpeg']),
  ('photos-public',  'photos-public',  true,  5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;
