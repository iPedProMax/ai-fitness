-- AI Fitness staging migration: private, small meal-history thumbnails only.
-- This does not upload images. The browser creates WebP <= 96 KiB before upload.
-- Review against the correct staging project before production use.
begin;

alter table public.meals add column if not exists thumbnail_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-thumbnails', 'meal-thumbnails', false, 98304, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 98304, allowed_mime_types = array['image/webp'];

-- Only signed-in owners can upload/read/remove their thumbnails in the matching user folder.
-- Object filenames: <auth uid>/<meal id>.webp. Not a publicly readable bucket.
drop policy if exists "meal_thumbnail_owner_read" on storage.objects;
create policy "meal_thumbnail_owner_read" on storage.objects for select to authenticated
using (bucket_id = 'meal-thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "meal_thumbnail_owner_insert" on storage.objects;
create policy "meal_thumbnail_owner_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'meal-thumbnails' and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' and
  exists (select 1 from public.meals m where m.id::text=replace(split_part(name,'/',2),'.webp','') and m.user_id=(select auth.uid()))
);

drop policy if exists "meal_thumbnail_owner_delete" on storage.objects;
create policy "meal_thumbnail_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'meal-thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
