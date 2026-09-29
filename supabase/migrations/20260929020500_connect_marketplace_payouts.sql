-- Stripe Connect marketplace hardening and owner payout state.
alter table public.profiles
  add column if not exists stripe_account_id text unique,
  add column if not exists stripe_onboarding_complete boolean not null default false;

alter table public.rentals
  add column if not exists stripe_charge_id text unique,
  add column if not exists stripe_transfer_id text unique,
  add column if not exists owner_payout_cents integer generated always as (greatest(rental_cents - fee_cents, 0)) stored;

create index if not exists profiles_stripe_account_id_idx on public.profiles(stripe_account_id);

-- Stripe payout identifiers are server-maintained; users may only edit public profile fields.
revoke update on public.profiles from authenticated;
grant update(display_name, neighborhood, city, state, bio, avatar_path) on public.profiles to authenticated;

drop policy if exists "owners insert tools" on public.tools;
create policy "owners insert tools" on public.tools
for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.stripe_onboarding_complete = true
      and p.stripe_account_id is not null
  )
);
