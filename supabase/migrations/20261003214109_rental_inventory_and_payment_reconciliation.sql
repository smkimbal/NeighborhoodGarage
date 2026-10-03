-- Financial settlement and physical possession are independent.
alter table public.rentals add column physical_state text not null default 'pending_pickup'
 check(physical_state in('pending_pickup','out','return_reported','returned','ready')),
 add column physical_expected_return_at timestamptz;
update public.rentals set physical_state=case
 when status='out' then 'out' when item_ready then 'ready'
 when physical_returned_at is not null then 'returned'
 when status in('review','disputed') then 'return_reported' else 'pending_pickup' end;
-- Earlier deadline refunds inferred receipt. Preserve actual owner confirmations.
update public.rentals r set physical_state='return_reported',physical_returned_at=null,item_ready=false
 where r.status='complete' and exists(select 1 from public.rental_events e where e.rental_id=r.id and e.action='deadline_refund')
 and not exists(select 1 from public.rental_events e where e.rental_id=r.id and e.actor_id=r.owner_id
 and(e.action in('received','mark-ready','approve') or e.action='correct-handoff' and e.details->>'physicalState'='returned'));
create unique index rentals_one_physical_checkout on public.rentals(tool_id) where physical_state='out';
create index rentals_unready_tool_idx on public.rentals(tool_id) where physical_state in('out','return_reported','returned');
create index rental_extensions_pending_checkout_idx on public.rental_extensions(checkout_expires_at) where status='pending_payment';
create index rentals_pending_checkout_idx on public.rentals(checkout_expires_at) where status='pending_payment';
-- Payment retries and extension cancellation must not reopen a settled calendar.
create function private.keep_settled_calendar() returns trigger language plpgsql set search_path='' as $$begin
 if old.status='complete' and new.status='complete' then new.calendar_ends_at=old.calendar_ends_at;end if;return new;
end$$;
revoke all on function private.keep_settled_calendar() from public,anon,authenticated;
create trigger rental_settled_calendar before update on public.rentals for each row execute function private.keep_settled_calendar();

create or replace function private.finish_return(p_rental uuid,p_damage integer default 0)
 returns void language plpgsql security invoker set search_path='' as $$declare r public.rentals;begin
 select * into r from public.rentals where id=p_rental for update;
 if r.status='complete' then return;end if;
 if r.status not in('review','disputed') then raise exception 'Submit or record the physical return first.';end if;
 if p_damage is null or p_damage<0 or p_damage>r.damage_claim_cents then raise exception 'Invalid damage settlement.';end if;
 perform private.refund_deposit(r.id,r.deposit_cents-p_damage);
 insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
 values(r.owner_id,r.id,r.owner_payout_cents,'owner_earnings','owner_earnings:'||r.id) on conflict(idempotency_key) do nothing;
 if p_damage>0 then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
 values(r.owner_id,r.id,p_damage,'agreed_damage','agreed_damage:'||r.id) on conflict(idempotency_key) do nothing;end if;
 -- Do not infer receipt or readiness from approval, a timer or payment state.
 update public.rentals set status='complete',completed_at=now(),payout_status='credited',
 calendar_ends_at=least(calendar_ends_at,now()),window_request=null where id=r.id;
 update public.rental_extensions set status='cancelled' where rental_id=r.id and status in('requested','approved');
end$$;

create or replace function private.apply_paid_extension(p_extension uuid)
 returns void language plpgsql security invoker set search_path='' as $$declare e public.rental_extensions;r public.rentals;begin
 select * into e from public.rental_extensions where id=p_extension;
 select * into r from public.rentals where id=e.rental_id for update;
 if r.status in('cancelled','expired','declined','payment_failed') then
  insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
  values(r.renter_id,r.id,e.rental_cents,'unused_extension_refund','unused_extension:'||e.id) on conflict(idempotency_key) do nothing;
  perform private.rental_event(r.id,null,'unused_extension_refunded');return;
 end if;
 if r.status not in('reserved','out','review','disputed','complete') then raise exception 'Extension payment needs reconciliation.';end if;
 update public.rentals set days=days+e.extra_days,rental_cents=rental_cents+e.rental_cents,fee_cents=fee_cents+e.fee_cents,
 return_window_start=e.return_window_start,return_window_end=e.return_window_end,ends_at=e.return_window_end,
 calendar_ends_at=case when status='complete' then calendar_ends_at else e.return_window_end end where id=r.id;
 -- A delayed verified payment may arrive after the deposit was settled.
 if r.status='complete' then insert into public.credit_ledger(user_id,rental_id,amount_cents,reason,idempotency_key)
 values(r.owner_id,r.id,e.rental_cents-e.fee_cents,'owner_extension_earnings','owner_extension:'||e.id) on conflict(idempotency_key) do nothing;end if;
 perform private.rental_event(r.id,r.renter_id,'extension_paid',jsonb_build_object('extraDays',e.extra_days));
end$$;

alter function public.change_rental(uuid,uuid,text,jsonb) set schema private;
alter function private.change_rental(uuid,uuid,text,jsonb) rename to change_rental_before_inventory;
revoke all on function private.change_rental_before_inventory(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.change_rental_before_inventory(uuid,uuid,text,jsonb) to service_role;
create function public.change_rental(p_user uuid,p_rental uuid,p_action text,p_data jsonb default '{}')
 returns public.rentals language plpgsql security invoker set search_path='' as $$
declare r public.rentals;t public.tools;photo text;expected timestamptz;begin
 select * into t from public.tools where id=(select tool_id from public.rentals where id=p_rental) for update;
 select * into r from public.rentals where id=p_rental for update;
 if r.id is null or p_user is null or p_user is distinct from r.owner_id and p_user is distinct from r.renter_id then raise exception 'Rental not found.';end if;
 if p_action='pickup' and exists(select 1 from public.rentals x where x.tool_id=t.id and x.id<>r.id
 and x.physical_state in('out','return_reported','returned')) then raise exception 'The previous physical handoff must be received and marked ready by the owner.';end if;
 if p_action='correct-handoff' and p_user=r.owner_id and r.status in('reserved','out','review','disputed','complete') then
  if length(btrim(coalesce(p_data->>'note','')))<10 then raise exception 'Record a reason for the correction.';end if;
  if p_data->>'physicalState'='out' then
   if exists(select 1 from public.rentals x where x.tool_id=t.id and x.id<>r.id and x.physical_state='out') then raise exception 'Another rental has physical possession. Correct that handoff first.';end if;
   expected=nullif(p_data->>'expectedReturn','')::timestamptz;
   if expected is not null and(expected<now() or expected>now()+interval '1 year') then raise exception 'Choose a future approximate return date within one year.';end if;
   update public.rentals set physical_state='out',physical_returned_at=null,item_ready=false,physical_expected_return_at=expected,
    picked_up_at=coalesce(picked_up_at,now()),status=case when status='reserved' then 'out' else status end,
    review_note=left(p_data->>'note',1000) where id=r.id;
  elsif p_data->>'physicalState'='returned' and r.physical_state in('out','return_reported','returned') then
   update public.rentals set physical_state='returned',physical_returned_at=now(),physical_expected_return_at=null,item_ready=false,
    returned_at=coalesce(returned_at,now()),status=case when status='out' then 'review' else status end,
    review_deadline=case when status='out' then now()+interval '48 hours' else review_deadline end,
    review_note=left(p_data->>'note',1000) where id=r.id;
  else raise exception 'Choose the actual physical handoff state.';end if;
  perform private.rental_event(r.id,p_user,p_action,jsonb_build_object('note',left(p_data->>'note',1000),'physicalState',p_data->>'physicalState'));
 elsif p_action='return' and p_user=r.renter_id and r.physical_state='out' and r.status in('review','disputed','complete') then
  photo=p_data->>'photo';
  if split_part(photo,'/',1) is distinct from p_user::text or split_part(photo,'/',2) is distinct from r.id::text
   or not exists(select 1 from storage.objects where bucket_id='return-photos' and name=photo) then raise exception 'Upload a return photo for this rental.';end if;
  if p_data->>'handoff' is null or p_data->>'handoff' not in('scan','dropoff') then raise exception 'Choose a handoff method.';end if;
  if p_data->>'handoff'='scan' and upper(coalesce(p_data->>'code',''))<>t.tracking_code and lower(coalesce(p_data->>'code',''))<>t.id::text then raise exception 'Tracking code does not match this item.';end if;
  update public.rentals set physical_state='return_reported',returned_at=now(),physical_returned_at=null,
   physical_expected_return_at=null,item_ready=false,return_photo_path=photo,handoff_method=p_data->>'handoff',assessment=p_data->'assessment' where id=r.id;
  perform private.rental_event(r.id,p_user,'physical_return_reported');
 elsif p_action in('received','mark-ready') and p_user=r.owner_id and r.status in('review','disputed','complete') then
  if r.physical_state not in('return_reported','returned','ready') then raise exception 'Record the physical return first.';end if;
  if p_action='mark-ready' and r.physical_returned_at is null then raise exception 'Confirm physical receipt before making the tool ready.';end if;
  update public.rentals set physical_state=case when p_action='mark-ready' then 'ready' else 'returned' end,
   physical_returned_at=coalesce(physical_returned_at,now()),item_ready=p_action='mark-ready',physical_expected_return_at=null where id=r.id;
  perform private.rental_event(r.id,p_user,p_action);
 else
  perform private.change_rental_before_inventory(p_user,p_rental,p_action,p_data);
  if p_action='pickup' then update public.rentals set physical_state='out' where id=r.id;
  elsif p_action='return' then update public.rentals set physical_state='return_reported',physical_returned_at=null,item_ready=false,physical_expected_return_at=null where id=r.id;
  elsif p_action='claim-damage' then update public.rentals set physical_returned_at=r.physical_returned_at,physical_state=r.physical_state,item_ready=r.item_ready where id=r.id;
  end if;
  if p_action='approve' and p_user=r.owner_id and coalesce((p_data->>'confirmReceipt')::boolean,false) then
   update public.rentals set physical_state='ready',physical_returned_at=coalesce(physical_returned_at,now()),item_ready=true,physical_expected_return_at=null where id=r.id;
   perform private.rental_event(r.id,p_user,'mark-ready',jsonb_build_object('source','owner_approval'));
  end if;
 end if;
 select * into r from public.rentals where id=p_rental;return r;
end$$;
revoke all on function public.change_rental(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.change_rental(uuid,uuid,text,jsonb) to service_role;

create or replace function public.process_rental_deadlines() returns integer language plpgsql security invoker set search_path='' as $$declare x record;n integer=0;begin
 for x in select id,tool_id,status from public.rentals where(status in('requested','accepted') and expires_at<now())
  or(status in('review','disputed') and coalesce(claim_deadline,review_deadline)<now()) order by tool_id loop
  if not exists(select 1 from public.tools where id=x.tool_id for update skip locked) then continue;end if;
  perform 1 from public.rentals where id=x.id for update;
  if x.status in('requested','accepted') then update public.rentals set status='expired' where id=x.id and status in('requested','accepted') and expires_at<now();
  elsif exists(select 1 from public.rentals where id=x.id and status in('review','disputed') and coalesce(claim_deadline,review_deadline)<now()) then
   perform private.finish_return(x.id,0);perform private.rental_event(x.id,null,'deadline_refund');end if;n=n+1;
 end loop;
 for x in select e.id,e.rental_id,r.tool_id from public.rental_extensions e join public.rentals r on r.id=e.rental_id
  where e.status='approved' and e.expires_at<now() order by r.tool_id loop
  if not exists(select 1 from public.tools where id=x.tool_id for update skip locked) then continue;end if;
  perform 1 from public.rentals where id=x.rental_id for update;
  update public.rental_extensions set status='expired' where id=x.id and status='approved' and expires_at<now();
  if found then update public.rentals set calendar_ends_at=case when status='complete' then calendar_ends_at else ends_at end where id=x.rental_id;end if;
 end loop;return n;
end$$;
create or replace function public.rental_availability(p_ids uuid[]) returns table(tool_id uuid,rented boolean,inspection_pending boolean,expected_return timestamptz,booked_ranges jsonb)
 language sql security invoker set search_path='' as $$
 select t.id,exists(select 1 from public.rentals r where r.tool_id=t.id and r.physical_state='out'),
 exists(select 1 from public.rentals r where r.tool_id=t.id and r.physical_state in('return_reported','returned')),
 (select max(coalesce(r.physical_expected_return_at,r.return_window_end)) from public.rentals r where r.tool_id=t.id and r.physical_state='out'),
 coalesce((select jsonb_agg(jsonb_build_object('start',r.starts_at,'end',r.calendar_ends_at) order by r.starts_at)
  from public.rentals r where r.tool_id=t.id and r.status in('accepted','pending_payment','reserved','out')
  and r.calendar_ends_at>now() and(r.status<>'accepted' or expires_at>now())),'[]'::jsonb)
 from public.tools t where t.id=any(p_ids) and t.archived_at is null;
$$;
create or replace function public.begin_account_deletion(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$begin
 lock table public.rentals in share row exclusive mode;
 if exists(select 1 from public.rentals r where(owner_id=p_user or renter_id=p_user)
  and(status in('requested','accepted','pending_payment','reserved','out','review','disputed') or payout_status='pending'
  or physical_state in('out','return_reported','returned') or exists(select 1 from public.rental_extensions e where e.rental_id=r.id and e.status='pending_payment')))
 then raise exception 'Finish or cancel active bookings, physical handoffs and pending payments before deleting your account.';end if;
 update public.profiles set deletion_started_at=coalesce(deletion_started_at,now()),stripe_onboarding_complete=false where id=p_user;
 if not found then raise exception 'Profile not found.';end if;update public.tools set available=false where owner_id=p_user;
end$$;
create or replace function private.guard_tool() returns trigger language plpgsql security definer set search_path='' as $$begin
 if(select auth.jwt()->>'role')='authenticated' and TG_OP<>'INSERT' and exists(select 1 from public.rentals
  where tool_id=old.id and(status in('requested','accepted','pending_payment','reserved','out','review','disputed') or physical_state in('out','return_reported','returned')))
 then raise exception 'Resolve active bookings and physical handoffs before changing this listing.';end if;
 if TG_OP='DELETE' then return old;end if;
 if new.photo_path is not null and split_part(new.photo_path,'/',1)<>new.owner_id::text or new.baseline_photo_path is not null and split_part(new.baseline_photo_path,'/',1)<>new.owner_id::text then raise exception 'Invalid tool photo owner.';end if;
 new.approximate_lat=round(new.approximate_lat::numeric,2);new.approximate_lng=round(new.approximate_lng::numeric,2);return new;
end$$;

-- A narrowly authenticated background endpoint; the raw token stays in Vault.
create table private.rental_maintenance_credentials(id boolean primary key default true check(id),token_hash bytea not null,endpoint_url text not null);
alter table private.rental_maintenance_credentials enable row level security;
revoke all on private.rental_maintenance_credentials from public,anon,authenticated;
grant select on private.rental_maintenance_credentials to service_role;
create function public.rental_maintenance_authorized(p_token text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_token is not null and length(p_token)=64 and exists(select 1 from private.rental_maintenance_credentials where token_hash=sha256(convert_to(p_token,'UTF8')));
$$;
revoke all on function public.rental_maintenance_authorized(text) from public,anon,authenticated;
grant execute on function public.rental_maintenance_authorized(text) to service_role;
-- Called by the database operator after the endpoint is deployed, never by clients.
create function private.configure_rental_maintenance(p_project_url text) returns void language plpgsql security invoker set search_path='' as $$declare token text;begin
 if p_project_url !~ '^https://[a-z0-9]{20}[.]supabase[.]co$' then raise exception 'Use this project Supabase API origin.';end if;
 if not exists(select 1 from pg_extension where extname='supabase_vault') or not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Vault and Cron are required.';end if;
 execute 'create extension if not exists pg_net';
 select decrypted_secret into token from vault.decrypted_secrets where name='ng_rental_maintenance_token' limit 1;
 if token is null then token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');perform vault.create_secret(token,'ng_rental_maintenance_token');end if;
 insert into private.rental_maintenance_credentials(id,token_hash,endpoint_url)
 values(true,sha256(convert_to(token,'UTF8')),p_project_url||'/functions/v1/rental-maintenance')
 on conflict(id) do update set token_hash=excluded.token_hash,endpoint_url=excluded.endpoint_url;
 perform cron.schedule('ng-rental-reconciliation','*/5 * * * *',$job$
  select net.http_post(url:=(select endpoint_url from private.rental_maintenance_credentials where id),
   headers:=jsonb_build_object('Content-Type','application/json','x-rental-maintenance-token',
    (select decrypted_secret from vault.decrypted_secrets where name='ng_rental_maintenance_token' limit 1)),body:='{}'::jsonb,timeout_milliseconds:=55000);
 $job$);
end$$;
revoke all on function private.configure_rental_maintenance(text) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
