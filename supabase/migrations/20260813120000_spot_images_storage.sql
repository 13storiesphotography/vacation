-- Spot image uploads: public bucket, vacation-scoped write for spot editors.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-images',
  'spot-images',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (bucket is public; policy still required for authenticated clients).
drop policy if exists "spot_images_public_read" on storage.objects;
create policy "spot_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'spot-images');

drop policy if exists "spot_images_editor_insert" on storage.objects;
create policy "spot_images_editor_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'spot-images'
    and (storage.foldername(name))[1] is not null
    and public.is_vacation_spots_editor(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "spot_images_editor_update" on storage.objects;
create policy "spot_images_editor_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'spot-images'
    and (storage.foldername(name))[1] is not null
    and public.is_vacation_spots_editor(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'spot-images'
    and (storage.foldername(name))[1] is not null
    and public.is_vacation_spots_editor(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "spot_images_editor_delete" on storage.objects;
create policy "spot_images_editor_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'spot-images'
    and (storage.foldername(name))[1] is not null
    and public.is_vacation_spots_editor(((storage.foldername(name))[1])::uuid)
  );
