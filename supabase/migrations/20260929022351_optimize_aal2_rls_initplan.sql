do $$
declare t text;
begin
  foreach t in array array['profiles','tools','rentals','credit_ledger','messages','reviews']
  loop
    execute format('drop policy if exists %I on public.%I', 'aal2 required', t);
    execute format($p$
      create policy %I on public.%I
      as restrictive
      for all
      to authenticated
      using (((select auth.jwt())->>'aal') = 'aal2')
      with check (((select auth.jwt())->>'aal') = 'aal2')
    $p$, 'aal2 required', t);
  end loop;
end $$;

drop policy if exists "ng storage requires aal2" on storage.objects;
create policy "ng storage requires aal2"
on storage.objects
as restrictive
for all
to authenticated
using (
  bucket_id not in ('tool-photos','return-photos','avatars')
  or ((select auth.jwt())->>'aal') = 'aal2'
)
with check (
  bucket_id not in ('tool-photos','return-photos','avatars')
  or ((select auth.jwt())->>'aal') = 'aal2'
);
