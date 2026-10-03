-- Separate reservation dates, physical possession and deposit settlement.
alter table public.rentals drop constraint rentals_status_check,drop constraint rentals_days_check;
alter table public.rentals add constraint rentals_status_check check(status in('requested','accepted','pending_payment','reserved','out','review','disputed','complete','cancelled','payment_failed','declined','expired')),add constraint rentals_days_check check(days between 1 and 365);
alter table public.rentals
 add column daily_rate_cents integer,
 add column starts_at timestamptz,add column ends_at timestamptz,add column calendar_ends_at timestamptz,
 add column pickup_window_start timestamptz,add column pickup_window_end timestamptz,
 add column return_window_start timestamptz,add column return_window_end timestamptz,
 add column scheduled_pickup_at timestamptz,add column pickup_plan_confirmed_at timestamptz,
 add column owner_confirmed_at timestamptz,add column picked_up_at timestamptz,
 add column returned_at timestamptz,add column physical_returned_at timestamptz,
 add column item_ready boolean not null default false,
 add column expires_at timestamptz,add column checkout_expires_at timestamptz,
 add column pickup_location jsonb,add column return_location jsonb,add column window_request jsonb,
 add column review_deadline timestamptz,add column review_note text not null default '',
 add column review_holds integer not null default 0,
 add column deposit_refunded_cents integer not null default 0,
 add column damage_claim_cents integer not null default 0,
 add column damage_note text not null default '',add column damage_photos text[] not null default '{}',
 add column claim_deadline timestamptz,add column dispute_opened_at timestamptz,add column escalation_requested_at timestamptz;
update public.rentals set daily_rate_cents=greatest(1,rental_cents/greatest(days,1)),starts_at=created_at,
 ends_at=created_at+days*interval '1 day'+interval '2 hours',calendar_ends_at=created_at+days*interval '1 day'+interval '2 hours',
 pickup_window_start=created_at,pickup_window_end=greatest(created_at+interval '1 day',now()+interval '1 day'),
 return_window_start=created_at+days*interval '1 day',return_window_end=created_at+days*interval '1 day'+interval '2 hours',
 owner_confirmed_at=created_at,checkout_expires_at=created_at+interval '31 minutes',
 picked_up_at=case when status in('out','review','disputed','complete') then created_at end,
 returned_at=case when status in('review','disputed','complete') then updated_at end,
 physical_returned_at=case when status='complete' then completed_at end,item_ready=status='complete',
 review_deadline=case when status in('review','disputed') then now()+interval '48 hours' end,
 deposit_refunded_cents=least(deposit_cents,coalesce((select sum(greatest(amount_cents,0)) from public.credit_ledger l where l.rental_id=rentals.id and l.reason='deposit_refund'),0));
-- Legacy holds had no documented claims: restore their actionable inspection.
update public.rentals set status='review',review_note='Existing return held for owner inspection.' where status='disputed';
alter table public.rentals alter column daily_rate_cents set not null;
alter table public.rentals add constraint rental_deposit_accounting check(deposit_refunded_cents between 0 and deposit_cents and damage_claim_cents between 0 and deposit_cents),add constraint rental_locations_valid check((pickup_location is null or jsonb_typeof(pickup_location)='object') and(return_location is null or jsonb_typeof(return_location)='object'));
drop index public.rentals_one_active_tool;
create unique index rentals_one_checked_out_tool on public.rentals(tool_id) where status='out';
create index rentals_calendar_idx on public.rentals(tool_id,starts_at,calendar_ends_at) where status in('accepted','pending_payment','reserved','out');
-- available is the owner's listing preference. Availability comes from dated bookings.
update public.tools set available=true where archived_at is null and exists(select 1 from public.rentals r where r.tool_id=tools.id and r.status in('pending_payment','reserved','out','review'));
create table public.rental_extensions(
 id uuid primary key default gen_random_uuid(),rental_id uuid not null references public.rentals(id) on delete cascade,
 request_id uuid not null unique,status text not null default 'requested' check(status in('requested','approved','pending_payment','paid','declined','cancelled','payment_failed','expired')),
 return_window_start timestamptz not null,return_window_end timestamptz not null,
 extra_days integer not null check(extra_days between 1 and 30),rental_cents integer not null check(rental_cents>=0),fee_cents integer not null check(fee_cents>=0 and fee_cents<=rental_cents),
 credits_used_cents integer not null default 0 check(credits_used_cents>=0 and credits_used_cents<=rental_cents),amount_due_cents integer not null default 0 check(amount_due_cents>=0 and amount_due_cents<=rental_cents),
 expires_at timestamptz,checkout_expires_at timestamptz,stripe_checkout_session_id text unique,stripe_payment_intent_id text unique,created_at timestamptz not null default now(),paid_at timestamptz);
create index rental_extensions_rental_idx on public.rental_extensions(rental_id,created_at);
create unique index rental_extensions_one_open on public.rental_extensions(rental_id) where status in('requested','approved','pending_payment');
create table public.rental_events(id uuid primary key default gen_random_uuid(),rental_id uuid not null references public.rentals(id) on delete cascade,actor_id uuid references public.profiles(id) on delete set null,action text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create index rental_events_rental_idx on public.rental_events(rental_id,created_at);
create index rental_events_actor_idx on public.rental_events(actor_id);
alter table public.rental_extensions enable row level security;alter table public.rental_events enable row level security;
revoke all on public.rental_extensions,public.rental_events from anon,authenticated;
grant select on public.rental_extensions,public.rental_events to authenticated;grant all on public.rental_extensions,public.rental_events to service_role;
create policy "participants view extensions" on public.rental_extensions for select to authenticated using((select private.session_allowed()) and exists(select 1 from public.rentals r where r.id=rental_id and(select auth.uid()) in(r.owner_id,r.renter_id)));
create policy "participants view handoff history" on public.rental_events for select to authenticated using((select private.session_allowed()) and exists(select 1 from public.rentals r where r.id=rental_id and(select auth.uid()) in(r.owner_id,r.renter_id)));
alter publication supabase_realtime add table public.rental_extensions,public.rental_events;
create function private.rental_event(p_rental uuid,p_actor uuid,p_action text,p_details jsonb default '{}') returns void language sql security invoker set search_path='' as $$insert into public.rental_events(rental_id,actor_id,action,details) values(p_rental,p_actor,p_action,p_details);$$;
create function private.booking_conflict(p_tool uuid,p_except uuid,p_start timestamptz,p_end timestamptz) returns void language plpgsql security invoker set search_path='' as $$begin
 -- Callers lock the tool before inspecting or changing its calendar.
 if exists(select 1 from public.rentals where tool_id=p_tool and id is distinct from p_except and status in('accepted','pending_payment','reserved','out') and(status<>'accepted' or expires_at>now()) and starts_at<p_end and calendar_ends_at>p_start) then raise exception 'Those dates overlap a confirmed booking. Choose another pickup or return window.';end if;
end$$;
create function private.refund_deposit(p_rental uuid,p_target integer) returns void language plpgsql security invoker set search_path='' as $$declare r public.rentals;delta integer;begin
 select * into r from public.rentals where id=p_rental for update;
 if p_target is null or p_target<r.deposit_refunded_cents or p_target>r.deposit_cents then raise exception 'Invalid deposit refund.';end if;
 delta=p_target-r.deposit_refunded_cents;
 if delta>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,delta,'deposit_refund','deposit_refund:'||r.id||':'||p_target) on conflict(idempotency_key) do nothing;update public.rentals set deposit_refunded_cents=p_target where id=r.id;end if;
end$$;
create function private.finish_return(p_rental uuid,p_damage integer default 0) returns void language plpgsql security invoker set search_path='' as $$declare r public.rentals;begin
 select * into r from public.rentals where id=p_rental for update;if r.status='complete' then return;end if;
 if r.status not in('review','disputed') then raise exception 'Submit or record the physical return first.';end if;
 if exists(select 1 from public.rental_extensions where rental_id=r.id and status='pending_payment') then raise exception 'Resolve the extension payment first using Check payment status or Cancel extension checkout.';end if;
 if p_damage is null or p_damage<0 or p_damage>r.damage_claim_cents then raise exception 'Invalid damage settlement.';end if;
 perform private.refund_deposit(r.id,r.deposit_cents-p_damage);
 insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.owner_id,r.id,r.owner_payout_cents,'owner_earnings','owner_earnings:'||r.id) on conflict(idempotency_key) do nothing;
 if p_damage>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.owner_id,r.id,p_damage,'agreed_damage','agreed_damage:'||r.id) on conflict(idempotency_key) do nothing;end if;
 update public.rentals set status='complete',completed_at=now(),physical_returned_at=coalesce(physical_returned_at,now()),item_ready=true,payout_status='credited',calendar_ends_at=least(calendar_ends_at,now()),window_request=null where id=r.id;
 update public.rental_extensions set status='cancelled' where rental_id=r.id and status in('requested','approved');
end$$;
create function public.request_rental(p_user uuid,p_tool uuid,p_request uuid,p_pickup_start timestamptz,p_pickup_end timestamptz,p_return_start timestamptz,p_return_end timestamptz) returns public.rentals language plpgsql security invoker set search_path='' as $$declare t public.tools;r public.rentals;d integer;begin
 if p_request is null or p_pickup_start is null or p_pickup_end is null or p_return_start is null or p_return_end is null or p_pickup_start<now()-interval '15 minutes' or p_pickup_start>now()+interval '1 year' or p_pickup_end<=p_pickup_start or p_pickup_end>p_pickup_start+interval '1 day' or p_return_start<p_pickup_end or p_return_end<=p_return_start or p_return_end>p_return_start+interval '1 day' then raise exception 'Choose valid pickup and return windows.';end if;
 d=greatest(1,ceil(extract(epoch from(p_return_start-p_pickup_start))/86400)::integer);if d>30 then raise exception 'Reserve 1–30 days. Request an extension later if needed.';end if;
 select * into t from public.tools where id=p_tool for update;select * into r from public.rentals where checkout_request_id=p_request;
 if found then if r.renter_id is distinct from p_user or r.tool_id is distinct from p_tool or r.pickup_window_start<>p_pickup_start or r.pickup_window_end<>p_pickup_end or r.return_window_start<>p_return_start or r.return_window_end<>p_return_end then raise exception 'Reservation request mismatch.';end if;return r;end if;
 if t.id is null or not t.available or t.archived_at is not null or t.owner_id=p_user then raise exception 'This listing is not accepting reservations.';end if;
 if not exists(select 1 from public.profiles where id=p_user and deletion_started_at is null) then raise exception 'Create your profile first.';end if;
 perform private.booking_conflict(t.id,null,p_pickup_start,p_return_end);
 if exists(select 1 from public.rentals where tool_id=t.id and renter_id=p_user and status='requested' and expires_at>now()) then raise exception 'You already have a request for this tool. Open My rentals.';end if;
 insert into public.rentals(tool_id,renter_id,owner_id,status,days,daily_rate_cents,rental_cents,deposit_cents,fee_cents,amount_due_cents,checkout_request_id,baseline_photo_path,baseline_condition,starts_at,ends_at,calendar_ends_at,pickup_window_start,pickup_window_end,return_window_start,return_window_end,expires_at)
 values(t.id,p_user,t.owner_id,'requested',d,t.rate_cents,t.rate_cents*d,t.deposit_cents,round(t.rate_cents*d*.05),t.rate_cents*d+t.deposit_cents,p_request,coalesce(t.baseline_photo_path,t.photo_path),t.condition,p_pickup_start,p_return_end,p_return_end,p_pickup_start,p_pickup_end,p_return_start,p_return_end,now()+interval '24 hours') returning * into r;
 perform private.rental_event(r.id,p_user,'requested');return r;
end$$;
-- Legacy frontends request owner approval instead of charging automatically.
create or replace function public.reserve_rental(p_user uuid,p_tool uuid,p_days integer,p_request uuid) returns public.rentals language plpgsql security invoker set search_path='' as $$declare r public.rentals;begin
 if p_days not between 1 and 30 then raise exception 'Reserve 1–30 days.';end if;
 select * into r from public.rentals where checkout_request_id=p_request;if found then if r.renter_id is distinct from p_user or r.tool_id is distinct from p_tool or r.days<>p_days then raise exception 'Reservation request mismatch.';end if;return r;end if;
 return public.request_rental(p_user,p_tool,p_request,date_trunc('minute',now()),date_trunc('minute',now())+interval '2 hours',date_trunc('minute',now())+p_days*interval '1 day',date_trunc('minute',now())+p_days*interval '1 day'+interval '2 hours');
end$$;
create function public.begin_rental_checkout(p_user uuid,p_rental uuid) returns public.rentals language plpgsql security invoker set search_path='' as $$declare r public.rentals;tid uuid;bal bigint;used integer;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));select tool_id into tid from public.rentals where id=p_rental;perform 1 from public.tools where id=tid for update;select * into r from public.rentals where id=p_rental for update;
 if r.renter_id is distinct from p_user then raise exception 'Rental not found.';end if;if r.status in('reserved','pending_payment') then return r;end if;
 if r.status<>'accepted' or r.owner_confirmed_at is null or r.expires_at<=now() then raise exception 'The owner must approve an active reservation before checkout.';end if;
 if r.pickup_plan_confirmed_at is null then raise exception 'Confirm a pickup plan before checkout.';end if;perform private.booking_conflict(tid,r.id,r.starts_at,r.calendar_ends_at);
 select coalesce(sum(amount_cents),0) into bal from public.credit_ledger where user_id=p_user;used=greatest(0,least(bal,r.rental_cents+r.deposit_cents));if r.rental_cents+r.deposit_cents-used between 1 and 49 then used=greatest(0,r.rental_cents+r.deposit_cents-50);end if;
 update public.rentals set credits_used_cents=used,amount_due_cents=rental_cents+deposit_cents-used,status=case when rental_cents+deposit_cents-used=0 then 'reserved' else 'pending_payment' end,checkout_expires_at=now()+interval '31 minutes',expires_at=null where id=r.id returning * into r;
 if used>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(p_user,r.id,-used,'rental_checkout','checkout:'||r.id);end if;perform private.rental_event(r.id,p_user,'checkout_started');return r;
end$$;
create or replace function public.finish_payment(p_event text,p_type text,p_session text,p_rental uuid,p_paid boolean,p_amount integer,p_currency text,p_intent text,p_payload jsonb) returns void language plpgsql security invoker set search_path='' as $$declare r public.rentals;tid uuid;begin
 if exists(select 1 from public.payment_events where id=p_event) then return;end if;select tool_id into tid from public.rentals where id=p_rental;perform 1 from public.tools where id=tid for update;select * into r from public.rentals where id=p_rental for update;
 if r.id is null then raise exception 'Rental not found for payment.';end if;if r.stripe_checkout_session_id is not null and r.stripe_checkout_session_id<>p_session then raise exception 'Checkout session mismatch.';end if;if r.amount_due_cents<>p_amount or p_currency<>'usd' then raise exception 'Payment amount or currency mismatch.';end if;
 if p_paid and r.status='pending_payment' then update public.rentals set status='reserved',stripe_checkout_session_id=p_session,stripe_payment_intent_id=p_intent where id=r.id;perform private.rental_event(r.id,r.renter_id,'payment_confirmed');
 elsif not p_paid and r.status='pending_payment' then update public.rentals set status='payment_failed',stripe_checkout_session_id=p_session where id=r.id;if r.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,r.credits_used_cents,'checkout_released','release:'||r.id) on conflict(idempotency_key) do nothing;end if;
 elsif p_paid and r.status in('cancelled','expired','declined','payment_failed') then raise exception 'Paid checkout requires reconciliation.';end if;
 insert into public.payment_events(id,event_type,payload) values(p_event,p_type,p_payload) on conflict(id) do nothing;
end$$;
create function private.valid_handoff_location(p_location jsonb) returns boolean language sql immutable security invoker set search_path='' as $$select coalesce(jsonb_typeof(p_location)='object' and p_location->>'type' in('place','owner_location') and length(btrim(p_location->>'label')) between 2 and 100 and((p_location->>'type'='place' and length(btrim(p_location->>'address')) between 3 and 300) or(p_location->>'type'='owner_location' and(p_location->>'lat')::numeric between -90 and 90 and(p_location->>'lng')::numeric between -180 and 180)),false);$$;
create or replace function public.change_rental(p_user uuid,p_rental uuid,p_action text,p_data jsonb default '{}') returns public.rentals language plpgsql security invoker set search_path='' as $$declare r public.rentals;t public.tools;tid uuid;ps timestamptz;pe timestamptz;rs timestamptz;re timestamptz;amount integer;photo text;begin
 select tool_id into tid from public.rentals where id=p_rental;select * into t from public.tools where id=tid for update;select * into r from public.rentals where id=p_rental for update;
 if r.id is null or p_user is null or p_user is distinct from r.owner_id and p_user is distinct from r.renter_id then raise exception 'Rental not found.';end if;
 if p_action='accept' and p_user=r.owner_id and r.status='requested' then
  if r.expires_at<=now() or r.pickup_window_end<=now() then raise exception 'This request expired. Ask the renter for new dates.';end if;if not private.valid_handoff_location(p_data->'pickupLocation') or not private.valid_handoff_location(p_data->'returnLocation') then raise exception 'Choose clear pickup and return locations.';end if;perform private.booking_conflict(t.id,r.id,r.starts_at,r.calendar_ends_at);
  update public.rentals set status='accepted',owner_confirmed_at=now(),expires_at=now()+interval '24 hours',pickup_location=p_data->'pickupLocation',return_location=p_data->'returnLocation' where id=r.id;
 elsif p_action='decline' and p_user=r.owner_id and r.status='requested' then update public.rentals set status='declined',review_note=left(coalesce(p_data->>'note',''),500) where id=r.id;
 elsif p_action='set-location' and p_user=r.owner_id and r.status in('accepted','pending_payment','reserved','out') then
  if not private.valid_handoff_location(p_data->'pickupLocation') or not private.valid_handoff_location(p_data->'returnLocation') then raise exception 'Choose clear pickup and return locations.';end if;update public.rentals set pickup_location=p_data->'pickupLocation',return_location=p_data->'returnLocation' where id=r.id;
 elsif p_action='schedule' and p_user=r.renter_id and r.status in('accepted','reserved') then
  ps=(p_data->>'pickupAt')::timestamptz;if ps is null or ps<r.pickup_window_start or ps>r.pickup_window_end or ps<now()-interval '15 minutes' then raise exception 'Choose a time in the owner-approved pickup window, or request a different window.';end if;update public.rentals set scheduled_pickup_at=ps,pickup_plan_confirmed_at=now() where id=r.id;
 elsif p_action='pickup' and p_user=r.renter_id and r.status='reserved' then
  if upper(coalesce(p_data->>'code',''))<>t.tracking_code and lower(coalesce(p_data->>'code',''))<>t.id::text then raise exception 'Tracking code does not match this item.';end if;
  if r.pickup_window_start>now()+interval '15 minutes' or r.pickup_window_end<now()-interval '15 minutes' then raise exception 'Pickup is outside the agreed window. Request a new window from the owner.';end if;
  if exists(select 1 from public.rentals where tool_id=t.id and id<>r.id and(status='out' or status in('review','disputed') and not item_ready)) then raise exception 'The previous tool handoff or inspection must be completed first.';end if;update public.rentals set status='out',picked_up_at=now() where id=r.id;
 elsif p_action='return' and p_user=r.renter_id and r.status='out' then
  photo=p_data->>'photo';if split_part(photo,'/',1) is distinct from p_user::text or split_part(photo,'/',2) is distinct from r.id::text or not exists(select 1 from storage.objects where bucket_id='return-photos' and name=photo) then raise exception 'Upload a return photo for this rental.';end if;
  if p_data->>'handoff' not in('scan','dropoff') or p_data->>'handoff' is null then raise exception 'Choose a handoff method.';end if;
  if p_data->>'handoff'='scan' and upper(coalesce(p_data->>'code',''))<>t.tracking_code and lower(coalesce(p_data->>'code',''))<>t.id::text then raise exception 'Tracking code does not match this item.';end if;
  update public.rentals set status='review',returned_at=now(),return_photo_path=photo,handoff_method=p_data->>'handoff',assessment=p_data->'assessment',review_deadline=now()+interval '48 hours' where id=r.id;
 elsif p_action in('hold-review','dispute') and p_user=r.owner_id and r.status in('review','disputed') then
  if length(btrim(coalesce(p_data->>'note','')))<10 then raise exception 'Explain the inspection still needed (at least 10 characters).';end if;if r.review_holds>=1 then raise exception 'The review was already extended. Inspect, refund, or document a damage claim.';end if;
  update public.rentals set review_note=left(p_data->>'note',1000),review_holds=review_holds+1,review_deadline=least(coalesce(returned_at,now())+interval '72 hours',greatest(coalesce(review_deadline,now()),now())+interval '24 hours') where id=r.id;
 elsif p_action='received' and p_user=r.owner_id and r.status in('review','disputed') then update public.rentals set physical_returned_at=coalesce(physical_returned_at,now()) where id=r.id;
 elsif p_action='mark-ready' and p_user=r.owner_id and r.status in('review','disputed') then if r.physical_returned_at is null then raise exception 'Confirm receipt before making the item ready.';end if;update public.rentals set item_ready=true where id=r.id;
 elsif p_action='approve' and p_user=r.owner_id and r.status in('review','disputed') then perform private.finish_return(r.id,0);
 elsif p_action='approve' and p_user=r.owner_id and r.status='complete' then return r;
 elsif p_action='claim-damage' and p_user=r.owner_id and r.status in('review','disputed') then
  amount=(p_data->>'amountCents')::integer;photo=p_data->>'photo';if amount is null or amount<=0 or amount>r.deposit_cents-r.deposit_refunded_cents or(r.damage_claim_cents>0 and amount>r.damage_claim_cents) then raise exception 'A claim must fit the remaining deposit and can only be reduced after submission.';end if;
  if length(btrim(coalesce(p_data->>'note','')))<20 or split_part(photo,'/',1) is distinct from p_user::text or split_part(photo,'/',2) is distinct from r.id::text or not exists(select 1 from storage.objects where bucket_id='return-photos' and name=photo) then raise exception 'Provide an inspection photo and an itemized damage explanation. Normal wear is not chargeable.';end if;
  update public.rentals set status='disputed',physical_returned_at=coalesce(physical_returned_at,now()),damage_claim_cents=amount,damage_note=left(p_data->>'note',2000),damage_photos=array[photo],claim_deadline=coalesce(claim_deadline,now()+interval '7 days') where id=r.id;perform private.refund_deposit(r.id,r.deposit_cents-amount);
 elsif p_action='accept-claim' and p_user=r.renter_id and r.status='disputed' and r.damage_claim_cents>0 then perform private.finish_return(r.id,r.damage_claim_cents);
 elsif p_action='contest-claim' and p_user=r.renter_id and r.status='disputed' then
  if length(btrim(coalesce(p_data->>'note','')))<10 then raise exception 'Explain why you dispute the deduction.';end if;update public.rentals set dispute_opened_at=coalesce(dispute_opened_at,now()),escalation_requested_at=coalesce(escalation_requested_at,now()) where id=r.id;
 elsif p_action='escalate' and r.status in('review','disputed') then update public.rentals set escalation_requested_at=coalesce(escalation_requested_at,now()) where id=r.id;
 elsif p_action='deadline-refund' and r.status in('review','disputed') then
  if coalesce(r.claim_deadline,r.review_deadline)>now() or coalesce(r.claim_deadline,r.review_deadline) is null then raise exception 'The review deadline has not passed.';end if;perform private.finish_return(r.id,0);
 elsif p_action='correct-handoff' and p_user=r.owner_id then
  if length(btrim(coalesce(p_data->>'note','')))<10 then raise exception 'Record a reason for the correction.';end if;
  if p_data->>'physicalState'='returned' and r.status='out' then update public.rentals set status='review',returned_at=now(),physical_returned_at=now(),review_deadline=now()+interval '48 hours',review_note=left(p_data->>'note',1000) where id=r.id;
  elsif p_data->>'physicalState'='out' and r.status in('reserved','review','disputed') and r.deposit_refunded_cents=0 and r.damage_claim_cents=0 then
   if exists(select 1 from public.rentals where tool_id=t.id and id<>r.id and status='out') then raise exception 'Another rental already has possession. Correct that handoff first.';end if;
   update public.rentals set status='out',picked_up_at=coalesce(picked_up_at,now()),returned_at=null,physical_returned_at=null,item_ready=false,review_deadline=null where id=r.id;
  else raise exception 'This correction would conflict with payment or deposit settlement. Use the current review or booking actions.';end if;
 elsif p_action='request-window' and r.status in('accepted','reserved','out') then
  ps=(p_data->>'pickupStart')::timestamptz;pe=(p_data->>'pickupEnd')::timestamptz;rs=(p_data->>'returnStart')::timestamptz;re=(p_data->>'returnEnd')::timestamptz;
  if ps is null or pe is null or rs is null or re is null or pe<=ps or pe>ps+interval '1 day' or rs<pe or re<=rs or re>rs+interval '1 day' or ceil(extract(epoch from(rs-ps))/86400)::integer<>r.days then raise exception 'Keep the agreed rental length and windows of up to 24 hours. Use Request extension for extra days.';end if;
  if r.status<>'out' and pe<=now() then raise exception 'Choose a future pickup window.';end if;if r.status='out' and(ps<>r.pickup_window_start or pe<>r.pickup_window_end) then raise exception 'Only the return window can change after pickup.';end if;
  if exists(select 1 from public.rental_extensions where rental_id=r.id and status in('approved','pending_payment')) then raise exception 'Resolve the approved extension before changing windows.';end if;
  update public.rentals set window_request=jsonb_build_object('requestedBy',p_user,'pickupStart',ps,'pickupEnd',pe,'returnStart',rs,'returnEnd',re) where id=r.id;
 elsif p_action in('approve-window','decline-window') and r.window_request is not null and r.status in('accepted','reserved','out') then
  if(r.window_request->>'requestedBy')::uuid=p_user then raise exception 'The other participant must approve the change.';end if;
  if p_action='approve-window' then
   if exists(select 1 from public.rental_extensions where rental_id=r.id and status in('approved','pending_payment')) then raise exception 'Resolve the approved extension before changing windows.';end if;
   ps=(r.window_request->>'pickupStart')::timestamptz;pe=(r.window_request->>'pickupEnd')::timestamptz;rs=(r.window_request->>'returnStart')::timestamptz;re=(r.window_request->>'returnEnd')::timestamptz;perform private.booking_conflict(t.id,r.id,ps,re);
   update public.rentals set starts_at=ps,ends_at=re,calendar_ends_at=re,pickup_window_start=ps,pickup_window_end=pe,return_window_start=rs,return_window_end=re,scheduled_pickup_at=null,pickup_plan_confirmed_at=null,window_request=null where id=r.id;
  else update public.rentals set window_request=null where id=r.id;end if;
 elsif p_action='cancel' and r.status in('requested','accepted','pending_payment','reserved') then
  if exists(select 1 from public.rental_extensions where rental_id=r.id and status='pending_payment') then raise exception 'Resolve the extension payment first using Check extension payment or Cancel extension.';end if;
  if r.status='pending_payment' and coalesce((p_data->>'paymentSafe')::boolean,false) is not true then raise exception 'Verify checkout expiration before cancelling.';end if;
  if r.status='reserved' then perform private.refund_deposit(r.id,r.deposit_cents);insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,r.rental_cents,'cancelled_rental_refund','cancelled_rental:'||r.id) on conflict(idempotency_key) do nothing;
  elsif r.status='pending_payment' and r.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,r.credits_used_cents,'checkout_released','release:'||r.id) on conflict(idempotency_key) do nothing;end if;
  update public.rentals set status='cancelled',window_request=null where id=r.id;
  update public.rental_extensions set status='cancelled' where rental_id=r.id and status in('requested','approved');
 else raise exception 'This action is unavailable for the current booking. Refresh to see its next step.';end if;
 perform private.rental_event(r.id,p_user,p_action,jsonb_strip_nulls(jsonb_build_object('note',left(p_data->>'note',2000),'physicalState',p_data->>'physicalState','amountCents',p_data->'amountCents')));select * into r from public.rentals where id=p_rental;return r;
end$$;
create function public.request_rental_extension(p_user uuid,p_rental uuid,p_request uuid,p_start timestamptz,p_end timestamptz) returns public.rental_extensions language plpgsql security invoker set search_path='' as $$declare r public.rentals;e public.rental_extensions;d integer;tid uuid;begin
 select tool_id into tid from public.rentals where id=p_rental;perform 1 from public.tools where id=tid for update;select * into r from public.rentals where id=p_rental for update;
 if r.renter_id is distinct from p_user or r.status not in('reserved','out') then raise exception 'An active renter can request an extension.';end if;
 select * into e from public.rental_extensions where request_id=p_request;if found then if e.rental_id<>r.id or e.return_window_start<>p_start or e.return_window_end<>p_end then raise exception 'Extension request mismatch.';end if;return e;end if;
 if p_request is null or p_start is null or p_end is null or p_start<=r.return_window_start or p_end<=p_start or p_end>p_start+interval '1 day' then raise exception 'Choose a later return window.';end if;
 d=ceil(extract(epoch from(p_start-r.return_window_start))/86400)::integer;if d>30 or r.days+d>365 then raise exception 'Request up to 30 extra days at a time.';end if;perform private.booking_conflict(tid,r.id,r.starts_at,p_end);
 insert into public.rental_extensions(rental_id,request_id,return_window_start,return_window_end,extra_days,rental_cents,fee_cents) values(r.id,p_request,p_start,p_end,d,r.daily_rate_cents*d,round(r.daily_rate_cents*d*.05)) returning * into e;
 perform private.rental_event(r.id,p_user,'extension_requested',jsonb_build_object('extraDays',d));return e;
end$$;
create function public.change_rental_extension(p_user uuid,p_extension uuid,p_action text,p_safe boolean default false) returns public.rental_extensions language plpgsql security invoker set search_path='' as $$declare e public.rental_extensions;r public.rentals;tid uuid;begin
 select r0.tool_id into tid from public.rentals r0 join public.rental_extensions e0 on e0.rental_id=r0.id where e0.id=p_extension;perform 1 from public.tools where id=tid for update;
 select * into r from public.rentals where id=(select rental_id from public.rental_extensions where id=p_extension) for update;select * into e from public.rental_extensions where id=p_extension for update;
 if r.id is null or p_user is null or p_user is distinct from r.owner_id and p_user is distinct from r.renter_id then raise exception 'Extension not found.';end if;
 if p_action='approve' and p_user=r.owner_id and e.status='requested' and r.status in('reserved','out') then
  perform private.booking_conflict(tid,r.id,r.starts_at,e.return_window_end);update public.rental_extensions set status='approved',expires_at=now()+interval '24 hours' where id=e.id;update public.rentals set calendar_ends_at=e.return_window_end where id=r.id;
 elsif p_action='decline' and p_user=r.owner_id and e.status='requested' then update public.rental_extensions set status='declined' where id=e.id;
 elsif p_action='cancel' and e.status in('requested','approved','pending_payment') then
  if e.status='pending_payment' and not p_safe then raise exception 'Verify extension checkout expiration first.';end if;if e.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,e.credits_used_cents,'extension_released','extension_release:'||e.id) on conflict(idempotency_key) do nothing;end if;
  update public.rental_extensions set status='cancelled' where id=e.id;update public.rentals set calendar_ends_at=ends_at where id=r.id;
 else raise exception 'This extension action is unavailable.';end if;perform private.rental_event(r.id,p_user,'extension_'||p_action);select * into e from public.rental_extensions where id=p_extension;return e;
end$$;
create function private.apply_paid_extension(p_extension uuid) returns void language plpgsql security invoker set search_path='' as $$declare e public.rental_extensions;r public.rentals;begin
 select * into e from public.rental_extensions where id=p_extension;select * into r from public.rentals where id=e.rental_id for update;if r.status not in('reserved','out','review','disputed') then raise exception 'Extension payment needs reconciliation before closing this rental.';end if;
 update public.rentals set days=days+e.extra_days,rental_cents=rental_cents+e.rental_cents,fee_cents=fee_cents+e.fee_cents,return_window_start=e.return_window_start,return_window_end=e.return_window_end,ends_at=e.return_window_end,calendar_ends_at=e.return_window_end where id=r.id;perform private.rental_event(r.id,r.renter_id,'extension_paid',jsonb_build_object('extraDays',e.extra_days));
end$$;
create function public.begin_extension_checkout(p_user uuid,p_extension uuid) returns public.rental_extensions language plpgsql security invoker set search_path='' as $$declare e public.rental_extensions;r public.rentals;tid uuid;bal bigint;used integer;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));select r0.tool_id into tid from public.rentals r0 join public.rental_extensions e0 on e0.rental_id=r0.id where e0.id=p_extension;perform 1 from public.tools where id=tid for update;
 select * into r from public.rentals where id=(select rental_id from public.rental_extensions where id=p_extension) for update;select * into e from public.rental_extensions where id=p_extension for update;
 if r.renter_id is distinct from p_user then raise exception 'Extension not found.';end if;if e.status in('paid','pending_payment') then return e;end if;
 if e.status<>'approved' or e.expires_at<=now() or r.status not in('reserved','out') then raise exception 'The owner must approve an active extension before payment.';end if;perform private.booking_conflict(tid,r.id,r.starts_at,e.return_window_end);
 select coalesce(sum(amount_cents),0) into bal from public.credit_ledger where user_id=p_user;used=greatest(0,least(bal,e.rental_cents));if e.rental_cents-used between 1 and 49 then used=greatest(0,e.rental_cents-50);end if;
 update public.rental_extensions set credits_used_cents=used,amount_due_cents=rental_cents-used,checkout_expires_at=now()+interval '31 minutes',status=case when rental_cents-used=0 then 'paid' else 'pending_payment' end,paid_at=case when rental_cents-used=0 then now() end where id=e.id returning * into e;
 if used>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(p_user,r.id,-used,'extension_checkout','extension_checkout:'||e.id);end if;if e.status='paid' then perform private.apply_paid_extension(e.id);end if;return e;
end$$;
create function public.finish_extension_payment(p_event text,p_type text,p_session text,p_extension uuid,p_paid boolean,p_amount integer,p_currency text,p_intent text,p_payload jsonb) returns void language plpgsql security invoker set search_path='' as $$declare e public.rental_extensions;tid uuid;begin
 if exists(select 1 from public.payment_events where id=p_event) then return;end if;select r.tool_id into tid from public.rentals r join public.rental_extensions x on x.rental_id=r.id where x.id=p_extension;perform 1 from public.tools where id=tid for update;
 perform 1 from public.rentals where id=(select rental_id from public.rental_extensions where id=p_extension) for update;select * into e from public.rental_extensions where id=p_extension for update;
 if e.id is null or e.amount_due_cents<>p_amount or p_currency<>'usd' then raise exception 'Extension payment amount or currency mismatch.';end if;if e.stripe_checkout_session_id is not null and e.stripe_checkout_session_id<>p_session then raise exception 'Extension session mismatch.';end if;
 if p_paid and e.status='pending_payment' then update public.rental_extensions set status='paid',paid_at=now(),stripe_checkout_session_id=p_session,stripe_payment_intent_id=p_intent where id=e.id;perform private.apply_paid_extension(e.id);
 elsif not p_paid and e.status='pending_payment' then update public.rental_extensions set status='payment_failed',stripe_checkout_session_id=p_session where id=e.id;if e.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) select r.renter_id,r.id,e.credits_used_cents,'extension_released','extension_release:'||e.id from public.rentals r where r.id=e.rental_id on conflict(idempotency_key) do nothing;end if;update public.rentals set calendar_ends_at=ends_at where id=e.rental_id;
 elsif p_paid and e.status in('cancelled','expired','payment_failed') then raise exception 'Paid extension requires reconciliation.';end if;
 insert into public.payment_events(id,event_type,payload) values(p_event,p_type,p_payload) on conflict(id) do nothing;
end$$;
create function public.release_uncreated_checkout(p_user uuid,p_rental uuid,p_extension uuid default null) returns void language plpgsql security invoker set search_path='' as $$declare r public.rentals;e public.rental_extensions;tid uuid;begin
 select tool_id into tid from public.rentals where id=p_rental;perform 1 from public.tools where id=tid for update;select * into r from public.rentals where id=p_rental for update;
 if r.id is null or p_user is null or p_user is distinct from r.renter_id and p_user is distinct from r.owner_id then raise exception 'Rental not found.';end if;
 if p_extension is null then
  if r.status<>'pending_payment' or r.stripe_checkout_session_id is not null or r.checkout_expires_at>now() then raise exception 'Check the existing payment session before releasing checkout.';end if;
  update public.rentals set status='payment_failed' where id=r.id;if r.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,r.credits_used_cents,'checkout_released','release:'||r.id) on conflict(idempotency_key) do nothing;end if;
 else
  select * into e from public.rental_extensions where id=p_extension and rental_id=r.id for update;
  if e.id is null or e.status<>'pending_payment' or e.stripe_checkout_session_id is not null or e.checkout_expires_at>now() then raise exception 'Check the existing extension payment before releasing checkout.';end if;
  update public.rental_extensions set status='payment_failed' where id=e.id;if e.credits_used_cents>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key) values(r.renter_id,r.id,e.credits_used_cents,'extension_released','extension_release:'||e.id) on conflict(idempotency_key) do nothing;end if;update public.rentals set calendar_ends_at=ends_at where id=r.id;
 end if;perform private.rental_event(r.id,p_user,'payment_creation_expired');
end$$;
create function public.process_rental_deadlines() returns integer language plpgsql security invoker set search_path='' as $$declare x record;n integer=0;begin
 for x in select id,tool_id,status from public.rentals where(status in('requested','accepted') and expires_at<now()) or(status in('review','disputed') and coalesce(claim_deadline,review_deadline)<now() and not exists(select 1 from public.rental_extensions e where e.rental_id=rentals.id and e.status='pending_payment')) order by tool_id loop
  if not exists(select 1 from public.tools where id=x.tool_id for update skip locked) then continue;end if;perform 1 from public.rentals where id=x.id for update;
  if x.status in('requested','accepted') then update public.rentals set status='expired' where id=x.id and status in('requested','accepted') and expires_at<now();
  elsif exists(select 1 from public.rentals where id=x.id and status in('review','disputed') and coalesce(claim_deadline,review_deadline)<now()) then perform private.finish_return(x.id,0);perform private.rental_event(x.id,null,'deadline_refund');end if;n=n+1;
 end loop;
 for x in select e.id,e.rental_id,r.tool_id from public.rental_extensions e join public.rentals r on r.id=e.rental_id where e.status='approved' and e.expires_at<now() order by r.tool_id loop
  if not exists(select 1 from public.tools where id=x.tool_id for update skip locked) then continue;end if;perform 1 from public.rentals where id=x.rental_id for update;update public.rental_extensions set status='expired' where id=x.id and status='approved' and expires_at<now();if found then update public.rentals set calendar_ends_at=ends_at where id=x.rental_id;end if;
 end loop;return n;
end$$;
create function public.rental_availability(p_ids uuid[]) returns table(tool_id uuid,rented boolean,inspection_pending boolean,expected_return timestamptz,booked_ranges jsonb) language sql security invoker set search_path='' as $$
 select t.id,exists(select 1 from public.rentals r where r.tool_id=t.id and r.status='out'),exists(select 1 from public.rentals r where r.tool_id=t.id and r.status in('review','disputed') and not r.item_ready),
 (select max(r.return_window_end) from public.rentals r where r.tool_id=t.id and r.status='out'),
 coalesce((select jsonb_agg(jsonb_build_object('start',r.starts_at,'end',r.calendar_ends_at) order by r.starts_at) from public.rentals r where r.tool_id=t.id and r.status in('accepted','pending_payment','reserved','out') and r.calendar_ends_at>now() and(r.status<>'accepted' or expires_at>now())),'[]'::jsonb)
 from public.tools t where t.id=any(p_ids) and t.archived_at is null;
$$;
-- New RPCs are service-only. Identity and MFA are verified in Edge, never accepted from the caller.
revoke all on function public.request_rental(uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,timestamptz),public.begin_rental_checkout(uuid,uuid),public.request_rental_extension(uuid,uuid,uuid,timestamptz,timestamptz),public.change_rental_extension(uuid,uuid,text,boolean),public.begin_extension_checkout(uuid,uuid),public.finish_extension_payment(text,text,text,uuid,boolean,integer,text,text,jsonb),public.release_uncreated_checkout(uuid,uuid,uuid),public.process_rental_deadlines(),public.rental_availability(uuid[]) from public,anon,authenticated;
grant execute on function public.request_rental(uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,timestamptz),public.begin_rental_checkout(uuid,uuid),public.request_rental_extension(uuid,uuid,uuid,timestamptz,timestamptz),public.change_rental_extension(uuid,uuid,text,boolean),public.begin_extension_checkout(uuid,uuid),public.finish_extension_payment(text,text,text,uuid,boolean,integer,text,text,jsonb),public.release_uncreated_checkout(uuid,uuid,uuid),public.process_rental_deadlines(),public.rental_availability(uuid[]) to service_role;
revoke all on function private.rental_event(uuid,uuid,text,jsonb),private.booking_conflict(uuid,uuid,timestamptz,timestamptz),private.refund_deposit(uuid,integer),private.finish_return(uuid,integer),private.valid_handoff_location(jsonb),private.apply_paid_extension(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;grant execute on function private.rental_event(uuid,uuid,text,jsonb),private.booking_conflict(uuid,uuid,timestamptz,timestamptz),private.refund_deposit(uuid,integer),private.finish_return(uuid,integer),private.valid_handoff_location(jsonb),private.apply_paid_extension(uuid) to service_role;
create or replace function private.guard_deleting_participants() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status in('requested','accepted','pending_payment','reserved','out','review','disputed') and(new.owner_id is null or new.renter_id is null or exists(select 1 from public.profiles where id in(new.owner_id,new.renter_id) and deletion_started_at is not null)) then raise exception 'This account is being deleted and cannot participate in rentals.';end if;return new;
end$$;
create or replace function public.begin_account_deletion(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$begin
 lock table public.rentals in share row exclusive mode;if exists(select 1 from public.rentals where(owner_id=p_user or renter_id=p_user) and(status in('requested','accepted','pending_payment','reserved','out','review','disputed') or payout_status='pending')) then raise exception 'Finish or cancel active bookings and resolve returns before deleting your account.';end if;
 update public.profiles set deletion_started_at=coalesce(deletion_started_at,now()),stripe_onboarding_complete=false where id=p_user;if not found then raise exception 'Profile not found.';end if;update public.tools set available=false where owner_id=p_user;
end$$;
create or replace function private.guard_tool() returns trigger language plpgsql security definer set search_path='' as $$begin
 if(select auth.jwt()->>'role')='authenticated' and TG_OP<>'INSERT' and exists(select 1 from public.rentals where tool_id=old.id and status in('requested','accepted','pending_payment','reserved','out','review','disputed')) then raise exception 'Resolve active requests or rentals before changing this listing.';end if;if TG_OP='DELETE' then return old;end if;
 if new.photo_path is not null and split_part(new.photo_path,'/',1)<>new.owner_id::text or new.baseline_photo_path is not null and split_part(new.baseline_photo_path,'/',1)<>new.owner_id::text then raise exception 'Invalid tool photo owner.';end if;new.approximate_lat=round(new.approximate_lat::numeric,2);new.approximate_lng=round(new.approximate_lng::numeric,2);return new;
end$$;
drop policy "rental participants view returns" on storage.objects;
create policy "rental participants view returns" on storage.objects for select to authenticated using(bucket_id='return-photos' and exists(select 1 from public.rentals r where(r.return_photo_path=name or name=any(r.damage_photos)) and(select auth.uid()) in(r.renter_id,r.owner_id)));
drop policy "users delete unused return uploads" on storage.objects;
create policy "users delete unused return uploads" on storage.objects for delete to authenticated using(bucket_id='return-photos' and(storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.rentals r where r.return_photo_path=name or name=any(r.damage_photos)));
create or replace function private.scrub_deleted_profile_receipts() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.deletion_started_at is null then raise exception 'Use the account deletion workflow first.';end if;update public.rental_events set details='{}' where rental_id in(select id from public.rentals where owner_id=old.id or renter_id=old.id);
 update public.rentals set pickup_location=null,return_location=null,window_request=null,damage_photos='{}',damage_note='',review_note='',assessment=null where owner_id=old.id or renter_id=old.id;
 update public.rentals set baseline_photo_path=null,baseline_condition=null where owner_id=old.id;update public.rentals set return_photo_path=null where renter_id=old.id;return old;
end$$;
-- A five-minute background sweep prevents deposits depending on either person opening the app.
do $$begin if exists(select 1 from pg_available_extensions where name='pg_cron') then execute 'create extension if not exists pg_cron';execute $job$select cron.schedule('ng-rental-deadlines','*/5 * * * *','select public.process_rental_deadlines();')$job$;end if;end$$;
notify pgrst,'reload schema';
