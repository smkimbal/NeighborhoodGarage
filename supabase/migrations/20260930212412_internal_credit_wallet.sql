-- Internal credits never call Stripe. Existing pending/paid payouts are not converted.
alter table public.rentals drop constraint rentals_payout_status_check;
alter table public.rentals add constraint rentals_payout_status_check check(payout_status in ('not_due','pending','paid','credited'));
create or replace function public.reserve_rental(p_user uuid,p_tool uuid,p_days integer,p_request uuid)
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


create or replace function public.change_rental(p_user uuid,p_rental uuid,p_action text,p_data jsonb default '{}')
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
  insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.owner_id,r.id,r.owner_payout_cents,'owner_earnings','owner_earnings:'||r.id) on conflict(idempotency_key) do nothing;
  update public.rentals set status='complete',completed_at=now(),payout_status='credited' where id=r.id;
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
revoke all on function public.reserve_rental(uuid,uuid,integer,uuid),public.change_rental(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_rental(uuid,uuid,integer,uuid),public.change_rental(uuid,uuid,text,jsonb) to service_role;

create table public.credit_withdrawals (
 id uuid primary key, user_id uuid references public.profiles(id) on delete set null,
 amount_cents integer not null check(amount_cents>=100), destination text not null,
 status text not null default 'pending' check(status in('pending','paid')),
 stripe_transfer_id text unique, created_at timestamptz not null default now(), paid_at timestamptz
);
create index credit_withdrawals_user_idx on public.credit_withdrawals(user_id,created_at);
alter table public.credit_withdrawals enable row level security;
revoke all on public.credit_withdrawals from anon,authenticated;
grant select on public.credit_withdrawals to authenticated;
grant all on public.credit_withdrawals to service_role;
create policy "own withdrawals" on public.credit_withdrawals for select to authenticated using(user_id=(select auth.uid()) and (select private.session_allowed()));
create function public.reserve_credit_withdrawal(p_user uuid,p_amount integer,p_request uuid)
returns public.credit_withdrawals language plpgsql security invoker set search_path='' as $$
declare w public.credit_withdrawals; dest text; bal bigint;
begin
 if p_request is null or p_amount is null or p_amount<100 then raise exception 'Minimum withdrawal is $1.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into w from public.credit_withdrawals where id=p_request;
 if found then
  if w.user_id is distinct from p_user or w.amount_cents<>p_amount then raise exception 'Withdrawal request mismatch.';end if;
  return w;
 end if;
 select stripe_account_id into dest from public.profiles where id=p_user and deletion_started_at is null and stripe_onboarding_complete for update;
 if dest is null then raise exception 'Complete Stripe payout setup before withdrawing.';end if;
 if exists(select 1 from public.credit_withdrawals where user_id=p_user and status='pending') then raise exception 'Resolve the pending withdrawal first.';end if;
 select coalesce(sum(amount_cents),0) into bal from public.credit_ledger where user_id=p_user;
 if bal<p_amount then raise exception 'Insufficient credits.';end if;
 insert into public.credit_withdrawals(id,user_id,amount_cents,destination) values(p_request,p_user,p_amount,dest) returning * into w;
 insert into public.credit_ledger(user_id,amount_cents,reason,idempotency_key) values(p_user,-p_amount,'withdrawal_hold','withdrawal:'||p_request);
 return w;
end $$;
revoke all on function public.reserve_credit_withdrawal(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.reserve_credit_withdrawal(uuid,integer,uuid) to service_role;
-- Lock the same account as withdrawal reservation before allowing deletion.
create function private.guard_wallet_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deletion_started_at is not null then
  perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
  if exists(select 1 from public.credit_withdrawals where user_id=new.id and status='pending') then raise exception 'Resolve the pending withdrawal before deleting your account.';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_wallet_deletion() from public,anon,authenticated;
create trigger guard_wallet_deletion before update of deletion_started_at on public.profiles for each row execute function private.guard_wallet_deletion();
