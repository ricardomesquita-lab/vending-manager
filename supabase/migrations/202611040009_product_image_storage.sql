begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Product photos are publicly readable') then
    create policy "Product photos are publicly readable" on storage.objects
      for select to public using (bucket_id = 'product-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Administrators can upload product photos') then
    create policy "Administrators can upload product photos" on storage.objects
      for insert to authenticated with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.current_user_role()) = 'administrator'
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Administrators can update product photos') then
    create policy "Administrators can update product photos" on storage.objects
      for update to authenticated using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.current_user_role()) = 'administrator'
      ) with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.current_user_role()) = 'administrator'
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Administrators can delete product photos') then
    create policy "Administrators can delete product photos" on storage.objects
      for delete to authenticated using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.current_user_role()) = 'administrator'
      );
  end if;
end $$;

commit;
