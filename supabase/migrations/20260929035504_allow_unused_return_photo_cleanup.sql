-- Users can preview their own uploads and remove unused attempts, but never erase return evidence.
create policy "users view own return uploads" on storage.objects for select to authenticated
using(bucket_id='return-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "users delete unused return uploads" on storage.objects for delete to authenticated
using(bucket_id='return-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
and not exists(select 1 from public.rentals r where r.return_photo_path=name));
-- Intentionally service-only rate accounting; explicit denial documents the boundary.
create policy "no client ai usage access" on public.ai_usage for all to authenticated using(false) with check(false);
