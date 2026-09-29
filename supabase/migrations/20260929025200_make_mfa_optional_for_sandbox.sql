-- Sandbox: make TOTP MFA optional while still enforcing AAL2 for accounts that enable it.
do $$
declare t text;
begin
  foreach t in array array['profiles','tools','rentals','credit_ledger','messages','reviews']
  loop
    execute format('drop policy if exists %I on public.%I', 'aal2 required', t);
    execute format('drop policy if exists %I on public.%I', 'mfa required when enrolled', t);
    execute format($p$
      create policy %I on public.%I
      as restrictive
      for all
      to authenticated
      using (
        array[((select auth.jwt())->>'aal')] <@ (
          select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
          from auth.mfa_factors
          where user_id = (select auth.uid()) and status = 'verified'
        )
      )
      with check (
        array[((select auth.jwt())->>'aal')] <@ (
          select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
          from auth.mfa_factors
          where user_id = (select auth.uid()) and status = 'verified'
        )
      )
    $p$, 'mfa required when enrolled', t);
  end loop;
end $$;

drop policy if exists "ng storage requires aal2" on storage.objects;
drop policy if exists "ng storage mfa when enrolled" on storage.objects;
create policy "ng storage mfa when enrolled"
on storage.objects
as restrictive
for all
to authenticated
using (
  bucket_id not in ('tool-photos','return-photos','avatars')
  or array[((select auth.jwt())->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status='verified'
  )
)
with check (
  bucket_id not in ('tool-photos','return-photos','avatars')
  or array[((select auth.jwt())->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status='verified'
  )
);
