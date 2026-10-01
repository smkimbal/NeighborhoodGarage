-- Keep settled receipts without retaining a deleted profile or tool.
alter table public.profiles add column deletion_started_at timestamptz;
alter table public.rentals alter column tool_id drop not null, alter column owner_id drop not null, alter column renter_id drop not null;
alter table public.rentals drop constraint rentals_tool_id_fkey, drop constraint rentals_owner_id_fkey, drop constraint rentals_renter_id_fkey;
alter table public.rentals add constraint rentals_tool_id_fkey foreign key(tool_id) references public.tools(id) on delete set null,
 add constraint rentals_owner_id_fkey foreign key(owner_id) references public.profiles(id) on delete set null,
 add constraint rentals_renter_id_fkey foreign key(renter_id) references public.profiles(id) on delete set null;
alter table public.reviews drop constraint reviews_subject_id_fkey, drop constraint reviews_tool_id_fkey;
alter table public.reviews add constraint reviews_subject_id_fkey foreign key(subject_id) references public.profiles(id) on delete set null,
 add constraint reviews_tool_id_fkey foreign key(tool_id) references public.tools(id) on delete set null;
-- The caller may edit public profile fields, never deletion state or payout setup.
revoke update on public.profiles from authenticated;
grant update(display_name,neighborhood,city,state,bio,avatar_path) on public.profiles to authenticated;
create or replace function private.session_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and deletion_started_at is null)
 and ((select auth.jwt()->>'aal')='aal2' or not exists(select 1 from auth.mfa_factors where user_id=(select auth.uid()) and status='verified'));
$$;
create function private.guard_deleting_participants() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('pending_payment','reserved','out','review','disputed') and
 (new.owner_id is null or new.renter_id is null or exists(select 1 from public.profiles where id in(new.owner_id,new.renter_id) and deletion_started_at is not null)) then
 raise exception 'This account is being deleted and cannot participate in rentals.';
 end if;
 return new;
end $$;
revoke all on function private.guard_deleting_participants() from public,anon,authenticated;
create trigger guard_deleting_participants before insert or update on public.rentals for each row execute function private.guard_deleting_participants();
create function public.begin_account_deletion(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 -- Serialize the eligibility check against checkout/return/payment transactions.
 lock table public.rentals in share row exclusive mode;
 if exists(select 1 from public.rentals where (owner_id=p_user or renter_id=p_user) and (status in ('pending_payment','reserved','out','review','disputed') or payout_status='pending')) then
 raise exception 'Finish or cancel active rentals, resolve disputes, and settle pending payouts before deleting your account.';
 end if;
 update public.profiles set deletion_started_at=coalesce(deletion_started_at,now()),stripe_onboarding_complete=false where id=p_user;
 if not found then raise exception 'Profile not found.';end if;
 update public.tools set available=false where owner_id=p_user;
end $$;
revoke all on function public.begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;
create function private.scrub_deleted_profile_receipts() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.deletion_started_at is null then raise exception 'Use the account deletion workflow first.';end if;
 update public.rentals set baseline_photo_path=null,baseline_condition=null where owner_id=old.id;
 update public.rentals set return_photo_path=null,assessment=null where renter_id=old.id;
 return old;
end $$;
revoke all on function private.scrub_deleted_profile_receipts() from public,anon,authenticated;
create trigger scrub_deleted_profile_receipts before delete on public.profiles for each row execute function private.scrub_deleted_profile_receipts();
