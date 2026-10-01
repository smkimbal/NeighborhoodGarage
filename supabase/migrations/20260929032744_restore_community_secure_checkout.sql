-- Restore sandbox-optional MFA without querying auth tables as the browser role.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.session_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and (
   (select auth.jwt()->>'aal') = 'aal2' or not exists (
     select 1 from auth.mfa_factors where user_id=(select auth.uid()) and status='verified'
   )
 );
$$;
revoke all on function private.session_allowed() from public, anon;
grant execute on function private.session_allowed() to authenticated;
do $$ declare t text; begin
 foreach t in array array['profiles','tools','rentals','credit_ledger','messages','reviews'] loop
  execute format('drop policy if exists %I on public.%I','mfa required when enrolled',t);
  execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select private.session_allowed())) with check ((select private.session_allowed()))','mfa required when enrolled',t);
 end loop;
end $$;
drop policy if exists "ng storage mfa when enrolled" on storage.objects;
create policy "ng storage mfa when enrolled" on storage.objects as restrictive for all to authenticated
using (bucket_id not in ('tool-photos','return-photos','avatars') or (select private.session_allowed()))
with check (bucket_id not in ('tool-photos','return-photos','avatars') or (select private.session_allowed()));

-- Drafting/publishing does not need payout credentials. Checkout does.
drop policy if exists "owners insert tools" on public.tools;
create policy "owners insert tools" on public.tools for insert to authenticated with check ((select auth.uid())=owner_id);
alter table public.tools add column if not exists baseline_photo_path text;
alter table public.tools add constraint tools_coordinates_valid check (
 (approximate_lat is null and approximate_lng is null) or
 (approximate_lat between -90 and 90 and approximate_lng between -180 and 180));
alter table public.tools add constraint tools_prices_bounded check (rate_cents<=100000 and deposit_cents<=1000000);
-- Prevent edits/deletion of the baseline during an active loan, including through direct API calls.
create function private.guard_tool() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())='authenticated' and TG_OP <> 'INSERT' and exists (
  select 1 from public.rentals where tool_id=old.id and status in ('pending_payment','reserved','out','review','disputed')
 ) then raise exception 'A tool in an active rental cannot be changed.'; end if;
 if TG_OP='DELETE' then return old; end if;
 if new.photo_path is not null and split_part(new.photo_path,'/',1)<>new.owner_id::text then raise exception 'Invalid tool photo owner.'; end if;
 if new.baseline_photo_path is not null and split_part(new.baseline_photo_path,'/',1)<>new.owner_id::text then raise exception 'Invalid baseline photo owner.'; end if;
 new.approximate_lat=round(new.approximate_lat::numeric,2);
 new.approximate_lng=round(new.approximate_lng::numeric,2);
 return new;
end $$;
revoke all on function private.guard_tool() from public,anon,authenticated;
create trigger guard_tool before insert or update or delete on public.tools for each row execute function private.guard_tool();

alter table public.reviews add column if not exists tool_id uuid references public.tools(id), add column if not exists subject_id uuid references public.profiles(id);
update public.reviews v set tool_id=r.tool_id,subject_id=r.owner_id from public.rentals r where r.id=v.rental_id;
create index reviews_tool_id_idx on public.reviews(tool_id);
create index reviews_subject_id_idx on public.reviews(subject_id);
create function private.review_subject() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select tool_id,owner_id into new.tool_id,new.subject_id from public.rentals where id=new.rental_id and renter_id=new.author_id and status='complete';
 if new.tool_id is null then raise exception 'Only the renter can review a completed rental.'; end if;
 return new;
end $$;
revoke all on function private.review_subject() from public,anon,authenticated;
create trigger review_subject before insert on public.reviews for each row execute function private.review_subject();

alter table public.rentals add column if not exists baseline_photo_path text,
 add column if not exists baseline_condition text,
 add column if not exists checkout_request_id uuid unique,
 add column if not exists payout_status text not null default 'not_due' check(payout_status in('not_due','pending','paid'));
-- Immutable images: users may delete unused uploads, never photographs used as evidence.
drop policy if exists "owners manage tool photos" on storage.objects;
drop policy if exists "owners delete tool photos" on storage.objects;
create policy "owners delete unused tool photos" on storage.objects for delete to authenticated using (
 bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.tools t where t.photo_path=name or t.baseline_photo_path=name)
 and not exists(select 1 from public.rentals r where r.baseline_photo_path=name)
);

-- All money mutations below run atomically and are callable only by service_role.
create function public.reserve_rental(p_user uuid,p_tool uuid,p_days integer,p_request uuid)
returns public.rentals language plpgsql security invoker set search_path='' as $$
declare t public.tools; r public.rentals; bal bigint; cost integer; used integer;
begin
 if p_days not between 1 and 30 or p_request is null then raise exception 'Invalid checkout request.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into r from public.rentals where checkout_request_id=p_request;
 if found then
  if r.renter_id<>p_user or r.tool_id<>p_tool or r.days<>p_days then raise exception 'Checkout request mismatch.'; end if;
  return r;
 end if;
 select * into t from public.tools where id=p_tool for update;
 if not found or not t.available or t.owner_id=p_user then raise exception 'This tool is unavailable.'; end if;
 if not exists(select 1 from public.profiles where id=t.owner_id and stripe_onboarding_complete and stripe_account_id is not null) then raise exception 'This owner must finish payout setup before accepting rentals.'; end if;
 select coalesce(sum(amount_cents),0) into bal from public.credit_ledger where user_id=p_user;
 cost=t.rate_cents*p_days;
 used=greatest(0,least(bal,cost+t.deposit_cents));
 -- Stripe USD minimum: leave at least 50 cents for a partial card payment.
 if cost+t.deposit_cents-used between 1 and 49 then used=greatest(0,cost+t.deposit_cents-50); end if;
 insert into public.rentals(tool_id,renter_id,owner_id,status,days,rental_cents,deposit_cents,fee_cents,credits_used_cents,amount_due_cents,checkout_request_id,baseline_photo_path,baseline_condition)
 values(t.id,p_user,t.owner_id,case when cost+t.deposit_cents-used=0 then 'reserved' else 'pending_payment' end,p_days,cost,t.deposit_cents,round(cost*.05),used,cost+t.deposit_cents-used,p_request,coalesce(t.baseline_photo_path,t.photo_path),t.condition) returning * into r;
 if used>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(p_user,r.id,-used,'rental_checkout','checkout:'||r.id); end if;
 update public.tools set available=false where id=t.id;
 return r;
end $$;

create function public.finish_payment(p_event text,p_type text,p_session text,p_rental uuid,p_paid boolean,p_amount integer,p_currency text,p_intent text,p_payload jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.rentals;
begin
 if exists(select 1 from public.payment_events where id=p_event) then return; end if;
 select * into r from public.rentals where id=p_rental for update;
 if not found then raise exception 'Rental not found for payment event.'; end if;
 if r.stripe_checkout_session_id is not null and r.stripe_checkout_session_id<>p_session then raise exception 'Checkout session mismatch.'; end if;
 if r.amount_due_cents<>p_amount or p_currency<>'usd' then raise exception 'Payment amount or currency mismatch.'; end if;
 if p_paid and r.status='pending_payment' then
  update public.rentals set status='reserved',stripe_checkout_session_id=p_session,stripe_payment_intent_id=p_intent where id=r.id;
 elsif not p_paid and r.status='pending_payment' then
  update public.rentals set status='payment_failed',stripe_checkout_session_id=p_session where id=r.id;
  if r.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,r.credits_used_cents,'checkout_released','release:'||r.id) on conflict(idempotency_key) do nothing; end if;
  update public.tools set available=true where id=r.tool_id;
 elsif p_paid and r.status in ('cancelled','payment_failed') then
  raise exception 'Paid checkout reached a released reservation; reconcile payment before proceeding.';
 end if;
 insert into public.payment_events(id,event_type,payload) values(p_event,p_type,p_payload) on conflict(id) do nothing;
end $$;

create function public.change_rental(p_user uuid,p_rental uuid,p_action text,p_data jsonb default '{}')
returns public.rentals language plpgsql security invoker set search_path='' as $$
declare r public.rentals; t public.tools;
begin
 select * into r from public.rentals where id=p_rental for update;
 if not found then raise exception 'Rental not found.'; end if;
 if p_action='pickup' and r.renter_id=p_user and r.status='reserved' then
  select * into t from public.tools where id=r.tool_id;
  if upper(p_data->>'code') is distinct from t.tracking_code then raise exception 'Tracking code does not match.'; end if;
  update public.rentals set status='out' where id=r.id;
 elsif p_action='return' and r.renter_id=p_user and r.status='out' then
  if split_part(p_data->>'photo','/',1)<>p_user::text or split_part(p_data->>'photo','/',2)<>r.id::text or not exists(select 1 from storage.objects where bucket_id='return-photos' and name=p_data->>'photo') then raise exception 'Upload a return photo for this rental.'; end if;
  if p_data->>'handoff' not in ('scan','dropoff') then raise exception 'Invalid handoff method.'; end if;
  if p_data->>'handoff'='scan' then
   select * into t from public.tools where id=r.tool_id;
   if upper(p_data->>'code') is distinct from t.tracking_code then raise exception 'Tracking code does not match.'; end if;
  end if;
  update public.rentals set status='review',return_photo_path=p_data->>'photo',handoff_method=p_data->>'handoff',assessment=p_data->'assessment' where id=r.id;
 elsif p_action='approve' and r.owner_id=p_user and r.status='review' then
  insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,r.deposit_cents,'deposit_refund','deposit_refund:'||r.id) on conflict(idempotency_key) do nothing;
  update public.rentals set status='complete',completed_at=now(),payout_status='pending' where id=r.id;
  update public.tools set available=true where id=r.tool_id;
 elsif p_action='approve' and r.owner_id=p_user and r.status='complete' then null;
 elsif p_action='dispute' and r.owner_id=p_user and r.status='review' then
  update public.rentals set status='disputed' where id=r.id;
 elsif p_action='cancel' and r.renter_id=p_user and r.status='pending_payment' then
  update public.rentals set status='cancelled' where id=r.id;
  if r.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,r.credits_used_cents,'checkout_released','release:'||r.id) on conflict(idempotency_key) do nothing; end if;
  update public.tools set available=true where id=r.tool_id;
 else raise exception 'This action is not available for this rental.';
 end if;
 select * into r from public.rentals where id=p_rental;
 return r;
end $$;

create table public.ai_usage(id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now());
create index ai_usage_user_time_idx on public.ai_usage(user_id,created_at);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
create function public.take_ai_slot(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,1));
 if (select count(*) from public.ai_usage where user_id=p_user and created_at>now()-interval '1 hour')>=12 then raise exception 'AI scan limit reached. Please try again in an hour.'; end if;
 delete from public.ai_usage where user_id=p_user and created_at<now()-interval '1 day';
 insert into public.ai_usage(user_id) values(p_user);
end $$;
revoke all on function public.reserve_rental(uuid,uuid,integer,uuid), public.finish_payment(text,text,text,uuid,boolean,integer,text,text,jsonb),public.change_rental(uuid,uuid,text,jsonb),public.take_ai_slot(uuid) from public,anon,authenticated;
grant execute on function public.reserve_rental(uuid,uuid,integer,uuid),public.finish_payment(text,text,text,uuid,boolean,integer,text,text,jsonb),public.change_rental(uuid,uuid,text,jsonb),public.take_ai_slot(uuid) to service_role;
grant all on public.ai_usage to service_role;
grant usage,select on sequence public.ai_usage_id_seq to service_role;
