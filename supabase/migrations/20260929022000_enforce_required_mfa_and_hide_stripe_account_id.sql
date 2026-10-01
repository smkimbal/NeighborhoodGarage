do $$
declare t text;
begin
  foreach t in array array['profiles','tools','rentals','credit_ledger','messages','reviews']
  loop
    execute format('drop policy if exists %I on public.%I', 'mfa required when enrolled', t);
    execute format('drop policy if exists %I on public.%I', 'aal2 required', t);
    execute format($p$
      create policy %I on public.%I
      as restrictive
      for all
      to authenticated
      using ((select auth.jwt()->>'aal') = 'aal2')
      with check ((select auth.jwt()->>'aal') = 'aal2')
    $p$, 'aal2 required', t);
  end loop;
end $$;

revoke select on public.profiles from authenticated;
grant select(id, display_name, neighborhood, city, state, bio, avatar_path, created_at, updated_at, stripe_onboarding_complete)
on public.profiles to authenticated;

drop policy if exists "ng storage requires aal2" on storage.objects;
create policy "ng storage requires aal2"
on storage.objects
as restrictive
for all
to authenticated
using (
  bucket_id not in ('tool-photos','return-photos','avatars')
  or (select auth.jwt()->>'aal') = 'aal2'
)
with check (
  bucket_id not in ('tool-photos','return-photos','avatars')
  or (select auth.jwt()->>'aal') = 'aal2'
);
