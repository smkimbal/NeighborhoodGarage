-- Charge for the reserved interval, independently from pickup and inspection times.
alter table public.rentals
 add column pricing_basis text not null default 'legacy_daily' check(pricing_basis in('legacy_daily','reservation_window')),
 add column billing_starts_at timestamptz,
 add column billing_ends_at timestamptz,
 add column billing_returned_at timestamptz,
 add column rental_refunded_cents integer not null default 0,
 add column rental_fee_refunded_cents integer not null default 0;
update public.rentals set billing_starts_at=pickup_window_start,billing_ends_at=return_window_end,
 billing_returned_at=case when status in('review','disputed') then returned_at end;
alter table public.rentals alter column billing_starts_at set not null,alter column billing_ends_at set not null,
 add constraint rental_billing_interval check(billing_ends_at>billing_starts_at),
 add constraint rental_refund_accounting check(rental_refunded_cents between 0 and rental_cents and rental_fee_refunded_cents between 0 and fee_cents);
alter table public.rental_extensions add column billing_starts_at timestamptz,add column billing_ends_at timestamptz;
update public.rental_extensions e set billing_starts_at=case when e.status='paid' then e.return_window_end-e.extra_days*interval '1 day' else r.return_window_end end,billing_ends_at=e.return_window_end
 from public.rentals r where r.id=e.rental_id;

create function private.refund_unused_reservation(p_rental uuid) returns void
 language plpgsql security invoker set search_path='' as $$
declare r public.rentals;used integer;target integer;fee_target integer;delta integer;
begin
 select * into r from public.rentals where id=p_rental for update;
 if r.status not in('review','disputed','complete') or r.physical_state='out' or r.billing_returned_at is null then return;end if;
 -- A confirmed return freezes the clock. Never charge for time spent inspecting.
 used=least(r.rental_cents,greatest(0,round(r.daily_rate_cents*greatest(0,
  extract(epoch from(r.billing_returned_at-r.billing_starts_at)))/86400)::integer));
 target=greatest(r.rental_refunded_cents,r.rental_cents-used);
 fee_target=r.fee_cents-least(r.fee_cents,round((r.rental_cents-target)*.05)::integer);
 delta=target-r.rental_refunded_cents;
 if delta>0 then
  insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
  values(r.renter_id,r.id,delta,'early_return_rental_refund','early_return:'||r.id||':'||target)
  on conflict(idempotency_key) do nothing;
  perform private.rental_event(r.id,null,'early_return_rental_refund',
   jsonb_build_object('amountCents',delta,'totalRefundCents',target,'returnedAt',r.billing_returned_at));
 end if;
 update public.rentals set rental_refunded_cents=target,rental_fee_refunded_cents=fee_target where id=r.id;
end$$;
revoke all on function private.refund_unused_reservation(uuid) from public,anon,authenticated;
grant execute on function private.refund_unused_reservation(uuid) to service_role;

create or replace function private.finish_return(p_rental uuid,p_damage integer default 0)
 returns void language plpgsql security invoker set search_path='' as $$
declare r public.rentals;net_earnings integer;
begin
 select * into r from public.rentals where id=p_rental for update;
 if r.status='complete' then return;end if;
 if r.status not in('review','disputed') then raise exception 'Submit or record the physical return first.';end if;
 if p_damage is null or p_damage<0 or p_damage>r.damage_claim_cents then raise exception 'Invalid damage settlement.';end if;
 if r.physical_state<>'out' then update public.rentals set billing_returned_at=coalesce(billing_returned_at,returned_at,physical_returned_at,now()) where id=r.id;end if;
 perform private.refund_unused_reservation(r.id);
 select * into r from public.rentals where id=p_rental;
 net_earnings=r.owner_payout_cents-r.rental_refunded_cents+r.rental_fee_refunded_cents;
 perform private.refund_deposit(r.id,r.deposit_cents-p_damage);
 insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
 values(r.owner_id,r.id,net_earnings,'owner_earnings','owner_earnings:'||r.id) on conflict(idempotency_key) do nothing;
 if p_damage>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
 values(r.owner_id,r.id,p_damage,'agreed_damage','agreed_damage:'||r.id) on conflict(idempotency_key) do nothing;end if;
 update public.rentals set status='complete',completed_at=now(),payout_status='credited',
 calendar_ends_at=least(calendar_ends_at,now()),window_request=null where id=r.id;
 update public.rental_extensions set status='cancelled' where rental_id=r.id and status in('requested','approved');
end$$;

create or replace function private.apply_paid_extension(p_extension uuid) returns void
 language plpgsql security invoker set search_path='' as $$
declare e public.rental_extensions;r public.rentals;updated public.rentals;before_net integer;after_net integer;
begin
 select * into e from public.rental_extensions where id=p_extension;
 select * into r from public.rentals where id=e.rental_id for update;
 if r.status in('cancelled','expired','declined','payment_failed') then
  insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
  values(r.renter_id,r.id,e.rental_cents,'unused_extension_refund','unused_extension:'||e.id) on conflict(idempotency_key) do nothing;
  perform private.rental_event(r.id,null,'unused_extension_refunded');return;
 end if;
 if r.status not in('reserved','out','review','disputed','complete') then raise exception 'Extension payment needs reconciliation.';end if;
 before_net=r.owner_payout_cents-r.rental_refunded_cents+r.rental_fee_refunded_cents;
 update public.rentals set days=greatest(1,ceil(extract(epoch from(e.return_window_end-billing_starts_at))/86400)::integer),
 rental_cents=rental_cents+e.rental_cents,fee_cents=fee_cents+e.fee_cents,
 return_window_start=e.return_window_start,return_window_end=e.return_window_end,ends_at=e.return_window_end,billing_ends_at=e.return_window_end,
 calendar_ends_at=case when status='complete' then calendar_ends_at else e.return_window_end end where id=r.id;
 -- A late verified extension payment refunds unused time without reopening settlement.
 if r.status='complete' or r.physical_returned_at is not null then perform private.refund_unused_reservation(r.id);end if;
 if r.status='complete' then
  select * into updated from public.rentals where id=r.id;
  after_net=updated.owner_payout_cents-updated.rental_refunded_cents+updated.rental_fee_refunded_cents;
  if after_net>before_net then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
   values(r.owner_id,r.id,after_net-before_net,'owner_extension_earnings','owner_extension:'||e.id) on conflict(idempotency_key) do nothing;end if;
 end if;
 perform private.rental_event(r.id,r.renter_id,'extension_paid',jsonb_build_object('extraDays',e.extra_days,'amountCents',e.rental_cents));
end$$;

create or replace function public.request_rental(p_user uuid,p_tool uuid,p_request uuid,p_pickup_start timestamptz,p_pickup_end timestamptz,p_return_start timestamptz,p_return_end timestamptz) returns public.rentals language plpgsql security invoker set search_path='' as $$declare t public.tools;r public.rentals;d integer;cost integer;begin
 if p_request is null or p_pickup_start is null or p_pickup_end is null or p_return_start is null or p_return_end is null or p_pickup_start<now()-interval '15 minutes' or p_pickup_start>now()+interval '1 year' or p_pickup_end<=p_pickup_start or p_pickup_end>p_pickup_start+interval '1 day' or p_return_start<p_pickup_end or p_return_end<=p_return_start or p_return_end>p_return_start+interval '1 day' then raise exception 'Choose valid pickup and return windows.';end if;
 d=greatest(1,ceil(extract(epoch from(p_return_end-p_pickup_start))/86400)::integer);if d>30 then raise exception 'Reserve up to 30 days including the full return window. Request an extension later if needed.';end if;
 select * into t from public.tools where id=p_tool for update;select * into r from public.rentals where checkout_request_id=p_request;
 if found then if r.renter_id is distinct from p_user or r.tool_id is distinct from p_tool or r.pickup_window_start<>p_pickup_start or r.pickup_window_end<>p_pickup_end or r.return_window_start<>p_return_start or r.return_window_end<>p_return_end then raise exception 'Reservation request mismatch.';end if;return r;end if;
 if t.id is null or not t.available or t.archived_at is not null or t.owner_id=p_user then raise exception 'This listing is not accepting reservations.';end if;
 if not exists(select 1 from public.profiles where id=p_user and deletion_started_at is null) then raise exception 'Create your profile first.';end if;
 perform private.booking_conflict(t.id,null,p_pickup_start,p_return_end);
 cost=round(t.rate_cents*extract(epoch from(p_return_end-p_pickup_start))/86400)::integer;
 if exists(select 1 from public.rentals where tool_id=t.id and renter_id=p_user and status='requested' and expires_at>now()) then raise exception 'You already have a request for this tool. Open My rentals.';end if;
 insert into public.rentals(tool_id,renter_id,owner_id,status,days,daily_rate_cents,rental_cents,deposit_cents,fee_cents,amount_due_cents,checkout_request_id,baseline_photo_path,baseline_condition,starts_at,ends_at,calendar_ends_at,pickup_window_start,pickup_window_end,return_window_start,return_window_end,expires_at,pricing_basis,billing_starts_at,billing_ends_at)
 values(t.id,p_user,t.owner_id,'requested',d,t.rate_cents,cost,t.deposit_cents,round(cost*.05),cost+t.deposit_cents,p_request,coalesce(t.baseline_photo_path,t.photo_path),t.condition,p_pickup_start,p_return_end,p_return_end,p_pickup_start,p_pickup_end,p_return_start,p_return_end,now()+interval '24 hours','reservation_window',p_pickup_start,p_return_end) returning * into r;
 perform private.rental_event(r.id,p_user,'requested');return r;
end$$;

create or replace function public.reserve_rental(p_user uuid,p_tool uuid,p_days integer,p_request uuid) returns public.rentals language plpgsql security invoker set search_path='' as $$declare r public.rentals;begin
 if p_days not between 1 and 30 then raise exception 'Reserve 1–30 days.';end if;
 select * into r from public.rentals where checkout_request_id=p_request;if found then if r.renter_id is distinct from p_user or r.tool_id is distinct from p_tool or r.days<>p_days then raise exception 'Reservation request mismatch.';end if;return r;end if;
 return public.request_rental(p_user,p_tool,p_request,date_trunc('minute',now()),date_trunc('minute',now())+interval '2 hours',date_trunc('minute',now())+p_days*interval '1 day'-interval '2 hours',date_trunc('minute',now())+p_days*interval '1 day');
end$$;

create or replace function public.request_rental_extension(p_user uuid,p_rental uuid,p_request uuid,p_start timestamptz,p_end timestamptz) returns public.rental_extensions language plpgsql security invoker set search_path='' as $$declare r public.rentals;e public.rental_extensions;d integer;cost integer;tid uuid;begin
 select tool_id into tid from public.rentals where id=p_rental;perform 1 from public.tools where id=tid for update;select * into r from public.rentals where id=p_rental for update;
 if r.renter_id is distinct from p_user or r.status not in('reserved','out') then raise exception 'An active renter can request an extension.';end if;
 select * into e from public.rental_extensions where request_id=p_request;if found then if e.rental_id<>r.id or e.return_window_start<>p_start or e.return_window_end<>p_end then raise exception 'Extension request mismatch.';end if;return e;end if;
 if p_request is null or p_start is null or p_end is null or p_start<r.return_window_start or p_end<=r.billing_ends_at or p_end<=p_start or p_end>p_start+interval '1 day' then raise exception 'Choose a later return window.';end if;
 d=ceil(extract(epoch from(p_end-r.billing_ends_at))/86400)::integer;if d>30 or ceil(extract(epoch from(p_end-r.billing_starts_at))/86400)>365 then raise exception 'Request up to 30 extra days at a time.';end if;perform private.booking_conflict(tid,r.id,r.starts_at,p_end);
 cost=round(r.daily_rate_cents*extract(epoch from(p_end-r.billing_ends_at))/86400)::integer;
 insert into public.rental_extensions(rental_id,request_id,return_window_start,return_window_end,extra_days,rental_cents,fee_cents,billing_starts_at,billing_ends_at) values(r.id,p_request,p_start,p_end,d,cost,round(cost*.05),r.billing_ends_at,p_end) returning * into e;
 perform private.rental_event(r.id,p_user,'extension_requested',jsonb_build_object('extraDays',d));return e;
end$$;

-- Keep the possession, authorization and review state machine; replace only timing rules.
alter function public.change_rental(uuid,uuid,text,jsonb) set schema private;
alter function private.change_rental(uuid,uuid,text,jsonb) rename to change_rental_before_window_pricing;
revoke all on function private.change_rental_before_window_pricing(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.change_rental_before_window_pricing(uuid,uuid,text,jsonb) to service_role;
create function public.change_rental(p_user uuid,p_rental uuid,p_action text,p_data jsonb default '{}')
 returns public.rentals language plpgsql security invoker set search_path='' as $$
declare r public.rentals;updated public.rentals;t public.tools;ps timestamptz;pe timestamptz;rs timestamptz;re timestamptz;cost integer;d integer;
begin
 select * into t from public.tools where id=(select tool_id from public.rentals where id=p_rental) for update;
 select * into r from public.rentals where id=p_rental for update;
 if r.id is null or p_user is null or p_user is distinct from r.owner_id and p_user is distinct from r.renter_id then raise exception 'Rental not found.';end if;
 if p_action in('request-window','approve-window','decline-window') then
  if r.status not in('accepted','reserved','out') then raise exception 'Window changes are unavailable for this booking.';end if;
  if p_action='request-window' then
   ps=(p_data->>'pickupStart')::timestamptz;pe=(p_data->>'pickupEnd')::timestamptz;rs=(p_data->>'returnStart')::timestamptz;re=(p_data->>'returnEnd')::timestamptz;
  else
   if r.window_request is null then raise exception 'No window request is pending.';end if;
   if(r.window_request->>'requestedBy')::uuid=p_user then raise exception 'The other participant must approve the change.';end if;
   ps=(r.window_request->>'pickupStart')::timestamptz;pe=(r.window_request->>'pickupEnd')::timestamptz;rs=(r.window_request->>'returnStart')::timestamptz;re=(r.window_request->>'returnEnd')::timestamptz;
  end if;
  if p_action<>'decline-window' then
   if ps is null or pe is null or rs is null or re is null or pe<=ps or pe>ps+interval '1 day' or rs<pe or re<=rs or re>rs+interval '1 day' then raise exception 'Choose ordered pickup and return windows of up to 24 hours each.';end if;
   if exists(select 1 from public.rental_extensions where rental_id=r.id and status in('approved','pending_payment')) then raise exception 'Resolve the approved extension before changing windows.';end if;
   if r.status='accepted' and(re-ps>interval '30 days' or pe<=now()) then raise exception 'Choose future windows reserving up to 30 days.';end if;
   if r.status='reserved' and(re-ps<>r.billing_ends_at-r.billing_starts_at or pe<=now()) then raise exception 'Move both windows together to keep the paid reservation duration, or request an extension for more time.';end if;
   if r.status='out' and(ps<>r.pickup_window_start or pe<>r.pickup_window_end or re>r.billing_ends_at) then raise exception 'After pickup, only the return window can move within prepaid time. Request an extension for a later return.';end if;
  end if;
  if p_action='request-window' then
   update public.rentals set window_request=jsonb_build_object('requestedBy',p_user,'pickupStart',ps,'pickupEnd',pe,'returnStart',rs,'returnEnd',re) where id=r.id;
  elsif p_action='approve-window' then
   perform private.booking_conflict(t.id,r.id,ps,re);
   if r.status='accepted' then
    d=greatest(1,ceil(extract(epoch from(re-ps))/86400)::integer);cost=round(r.daily_rate_cents*extract(epoch from(re-ps))/86400)::integer;
    update public.rentals set days=d,rental_cents=cost,fee_cents=round(cost*.05),amount_due_cents=cost+deposit_cents,
     pricing_basis='reservation_window',billing_starts_at=ps,billing_ends_at=re where id=r.id;
   elsif r.status='reserved' then update public.rentals set billing_starts_at=ps,billing_ends_at=re where id=r.id;end if;
   update public.rentals set starts_at=ps,ends_at=re,calendar_ends_at=re,pickup_window_start=ps,pickup_window_end=pe,
    return_window_start=rs,return_window_end=re,scheduled_pickup_at=case when status='out' then scheduled_pickup_at end,
    pickup_plan_confirmed_at=case when status='out' then pickup_plan_confirmed_at end,window_request=null where id=r.id;
  else update public.rentals set window_request=null where id=r.id;end if;
  perform private.rental_event(r.id,p_user,p_action);
 else
  updated=private.change_rental_before_window_pricing(p_user,p_rental,p_action,p_data);
  if r.status<>'complete' and(p_action='return' or p_action='correct-handoff' and p_data->>'physicalState'='returned') then
   update public.rentals set billing_returned_at=coalesce(billing_returned_at,returned_at,now()) where id=r.id;
  elsif p_action='correct-handoff' and p_data->>'physicalState'='out' and r.status<>'complete' and r.rental_refunded_cents=0 then
   update public.rentals set billing_returned_at=null where id=r.id;
  end if;
  if p_action='received' and updated.physical_returned_at is not null then perform private.refund_unused_reservation(r.id);end if;
 end if;
 select * into r from public.rentals where id=p_rental;return r;
end$$;
revoke all on function public.change_rental(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.change_rental(uuid,uuid,text,jsonb) to service_role;

-- Reject sub-minimum card amounts before any credits or dates enter payment hold.
create or replace function public.begin_rental_checkout(p_user uuid,p_rental uuid) returns public.rentals language plpgsql security invoker set search_path='' as $$declare r public.rentals;tid uuid;bal bigint;used integer;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));select tool_id into tid from public.rentals where id=p_rental;perform 1 from public.tools where id=tid for update;select * into r from public.rentals where id=p_rental for update;
 if r.renter_id is distinct from p_user then raise exception 'Rental not found.';end if;if r.status in('reserved','pending_payment') then return r;end if;
 if r.status<>'accepted' or r.owner_confirmed_at is null or r.expires_at<=now() then raise exception 'The owner must approve an active reservation before checkout.';end if;
 if r.pickup_plan_confirmed_at is null then raise exception 'Confirm a pickup plan before checkout.';end if;perform private.booking_conflict(tid,r.id,r.starts_at,r.calendar_ends_at);
 select coalesce(sum(amount_cents),0) into bal from public.credit_ledger where user_id=p_user;used=greatest(0,least(bal,r.rental_cents+r.deposit_cents));if r.rental_cents+r.deposit_cents-used between 1 and 49 then used=greatest(0,r.rental_cents+r.deposit_cents-50);end if;
 if r.rental_cents+r.deposit_cents-used between 1 and 49 then raise exception 'A card payment must be at least $0.50. Use enough credits to cover this reservation or request a longer window before checkout.';end if;
 update public.rentals set credits_used_cents=used,amount_due_cents=rental_cents+deposit_cents-used,status=case when rental_cents+deposit_cents-used=0 then 'reserved' else 'pending_payment' end,checkout_expires_at=now()+interval '31 minutes',expires_at=null where id=r.id returning * into r;
 if used>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(p_user,r.id,-used,'rental_checkout','checkout:'||r.id);end if;perform private.rental_event(r.id,p_user,'checkout_started');return r;
end$$;

-- Reject sub-minimum card amounts before any credits or dates enter payment hold.
create or replace function public.begin_extension_checkout(p_user uuid,p_extension uuid) returns public.rental_extensions language plpgsql security invoker set search_path='' as $$declare e public.rental_extensions;r public.rentals;tid uuid;bal bigint;used integer;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));select r0.tool_id into tid from public.rentals r0 join public.rental_extensions e0 on e0.rental_id=r0.id where e0.id=p_extension;perform 1 from public.tools where id=tid for update;
 select * into r from public.rentals where id=(select rental_id from public.rental_extensions where id=p_extension) for update;select * into e from public.rental_extensions where id=p_extension for update;
 if r.renter_id is distinct from p_user then raise exception 'Extension not found.';end if;if e.status in('paid','pending_payment') then return e;end if;
 if e.status<>'approved' or e.expires_at<=now() or r.status not in('reserved','out') then raise exception 'The owner must approve an active extension before payment.';end if;perform private.booking_conflict(tid,r.id,r.starts_at,e.return_window_end);
 select coalesce(sum(amount_cents),0) into bal from public.credit_ledger where user_id=p_user;used=greatest(0,least(bal,e.rental_cents));if e.rental_cents-used between 1 and 49 then used=greatest(0,e.rental_cents-50);end if;
 if e.rental_cents-used between 1 and 49 then raise exception 'A card payment must be at least $0.50. Use enough credits to cover this extension or request more time.';end if;
 update public.rental_extensions set credits_used_cents=used,amount_due_cents=rental_cents-used,checkout_expires_at=now()+interval '31 minutes',status=case when rental_cents-used=0 then 'paid' else 'pending_payment' end,paid_at=case when rental_cents-used=0 then now() end where id=e.id returning * into e;
 if used>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(p_user,r.id,-used,'extension_checkout','extension_checkout:'||e.id);end if;if e.status='paid' then perform private.apply_paid_extension(e.id);end if;return e;
end$$;
