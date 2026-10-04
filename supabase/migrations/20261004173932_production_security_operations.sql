-- Production hardening. New financial entries compensate history; no destructive backfill.
create table private.operator_accounts(user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
revoke all on private.operator_accounts from public,anon,authenticated;
grant all on private.operator_accounts to service_role;
create table public.support_cases(
 id uuid primary key default gen_random_uuid(), rental_id uuid references public.rentals(id),
 reporter_id uuid references public.profiles(id) on delete set null, subject_id uuid references public.profiles(id) on delete set null,
 kind text not null check(kind in('payment','not_received','damage','safety','abuse','withdrawal','deletion')),
 status text not null default 'open' check(status in('open','investigating','resolved')),
 financial_hold boolean not null default false, dedupe_key text unique, description text not null default '', resolution text not null default '',
 assigned_to uuid references auth.users(id), due_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz
);
create index support_cases_queue on public.support_cases(status,due_at);
alter table public.support_cases enable row level security;
revoke all on public.support_cases from anon,authenticated;grant select on public.support_cases to authenticated;grant all on public.support_cases to service_role;
create policy "own support cases" on public.support_cases for select to authenticated using((reporter_id=(select auth.uid()) or subject_id=(select auth.uid())) and (select private.session_allowed()));
create table private.operation_audit(id bigint generated always as identity primary key,actor_id uuid,action text not null,subject text,details jsonb not null default '{}',created_at timestamptz not null default now());
revoke all on private.operation_audit from public,anon,authenticated;grant select,insert on private.operation_audit to service_role;grant usage on sequence private.operation_audit_id_seq to service_role;
create table private.account_restrictions(user_id uuid primary key,reason text not null,created_at timestamptz not null default now());
revoke all on private.account_restrictions from public,anon,authenticated;grant all on private.account_restrictions to service_role;
create table private.rate_windows(user_id uuid,scope text,window_start timestamptz not null default now(),requests integer not null default 1,primary key(user_id,scope));
revoke all on private.rate_windows from public,anon,authenticated;grant all on private.rate_windows to service_role;
create function public.check_request_access(p_user uuid,p_scope text,p_limit integer default 60) returns void language plpgsql security invoker set search_path='' as $$
declare count_now integer;
begin
 if not exists(select 1 from public.profiles where id=p_user and (deletion_started_at is null or p_scope='support')) or (p_scope<>'support' and exists(select 1 from private.account_restrictions where user_id=p_user)) then raise exception 'Account unavailable. Contact support.';end if;
 insert into private.rate_windows(user_id,scope) values(p_user,p_scope) on conflict(user_id,scope) do update set
 requests=case when private.rate_windows.window_start<now()-interval '1 minute' then 1 else private.rate_windows.requests+1 end,
 window_start=case when private.rate_windows.window_start<now()-interval '1 minute' then now() else private.rate_windows.window_start end returning requests into count_now;
 if count_now>p_limit then raise exception 'Too many requests. Wait a minute and retry.';end if;
end $$;
create function public.operator_allowed(p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from private.operator_accounts where user_id=p_user);$$;
revoke all on function public.check_request_access(uuid,text,integer),public.operator_allowed(uuid) from public,anon,authenticated;
grant execute on function public.check_request_access(uuid,text,integer),public.operator_allowed(uuid) to service_role;

create table public.notifications(id bigint generated always as identity primary key,user_id uuid references public.profiles(id) on delete cascade,rental_id uuid references public.rentals(id),message text not null,dedupe_key text unique,created_at timestamptz not null default now(),read_at timestamptz);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;grant select on public.notifications to authenticated;grant update(read_at) on public.notifications to authenticated;grant all on public.notifications to service_role;grant usage on sequence public.notifications_id_seq to service_role;
create policy "own notifications" on public.notifications to authenticated using(user_id=(select auth.uid()) and (select private.session_allowed())) with check(user_id=(select auth.uid()) and (select private.session_allowed()));
create table private.notification_delivery(notification_id bigint primary key references public.notifications(id) on delete cascade,attempts integer not null default 0,next_attempt_at timestamptz not null default now(),delivered_at timestamptz,last_error text);
revoke all on private.notification_delivery from public,anon,authenticated;grant all on private.notification_delivery to service_role;
create function private.queue_notification() returns trigger language plpgsql security definer set search_path='' as $$begin insert into private.notification_delivery(notification_id) values(new.id);return new;end $$;
create trigger queue_notification after insert on public.notifications for each row execute function private.queue_notification();
create function private.notify_rental_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(user_id,rental_id,message,dedupe_key)
 select p,new.rental_id,'Rental update: '||replace(new.action,'_',' '),'event:'||new.id||':'||p
 from public.rentals r cross join lateral unnest(array[r.owner_id,r.renter_id]) p where r.id=new.rental_id and p is not null and p is distinct from new.actor_id on conflict(dedupe_key) do nothing;
 return new;
end $$;
create trigger notify_rental_event after insert on public.rental_events for each row execute function private.notify_rental_event();
revoke all on function private.queue_notification(),private.notify_rental_event() from public,anon,authenticated;

-- Quotes are persisted before a Checkout Session; fee revenue is never rental credit.
alter table public.rentals add column processing_fee_cents integer not null default 0 check(processing_fee_cents>=0);
alter table public.rental_extensions add column processing_fee_cents integer not null default 0 check(processing_fee_cents>=0);
alter table public.credit_topups add column processing_fee_cents integer not null default 0 check(processing_fee_cents>=0);
create table public.payment_receipts(
 charge_id text primary key,payment_intent_id text not null,session_id text not null,
 wallet_account uuid not null,rental_id uuid references public.rentals(id),extension_id uuid references public.rental_extensions(id),topup_id uuid references public.credit_topups(id),
 principal_cents integer not null check(principal_cents>0),processing_fee_cents integer not null default 0,
 actual_fee_cents integer,available_at timestamptz,refunded_cents integer not null default 0,disputed_cents integer not null default 0,
 dispute_active boolean not null default false,reversed_cents integer not null default 0,event_created bigint not null default 0,created_at timestamptz not null default now()
);
alter table public.payment_receipts enable row level security;
revoke all on public.payment_receipts from anon,authenticated;grant select on public.payment_receipts to authenticated;grant all on public.payment_receipts to service_role;
create policy "own verified receipts" on public.payment_receipts for select to authenticated using(wallet_account=(select auth.uid()) and (select private.session_allowed()));
-- Allow compensating entries against retained wallet identities after profile deletion.
create or replace function private.credit_entry_account() returns trigger language plpgsql security invoker set search_path='' as $$begin
 new.wallet_account=coalesce(new.wallet_account,new.user_id);
 if new.wallet_account is null or new.user_id is not null and new.wallet_account<>new.user_id then raise exception 'Credit account mismatch.';end if;return new;
end $$;
create or replace function private.reconcile_topup_reversal(p_topup uuid,p_reference text) returns void language plpgsql security invoker set search_path='' as $$
declare t public.credit_topups;target integer;delta integer;begin
 select * into t from public.credit_topups where id=p_topup for update;if t.status<>'paid' then return;end if;
 target=least(t.amount_cents,t.refunded_cents+t.disputed_cents);delta=target-t.reversed_ledger_cents;
 if delta<>0 then insert into public.credit_ledger(user_id,wallet_account,topup_id,amount_cents,reason,idempotency_key)
 values(t.user_id,t.wallet_account,t.id,-delta,case when delta>0 then 'funding_reversed' else 'funding_restored' end,'funding_adjustment:'||p_reference);
 update public.credit_topups set reversed_ledger_cents=target where id=t.id;end if;
end $$;
create function public.reconcile_rental_charge(p_charge text,p_event text,p_created bigint,p_refunded integer,p_disputed integer,p_active boolean) returns void language plpgsql security invoker set search_path='' as $$
declare x public.payment_receipts;delta integer;target integer;uid uuid;owner_account uuid;
begin
 select * into x from public.payment_receipts where charge_id=p_charge;
 if not found then raise exception 'Verified receipt missing; retry after payment completion.';end if;
 perform pg_advisory_xact_lock(hashtextextended(x.wallet_account::text,0));select * into x from public.payment_receipts where charge_id=p_charge for update;
 if p_created<x.event_created then return;end if;
 if p_refunded<0 or p_disputed<0 or p_refunded>x.principal_cents+x.processing_fee_cents or p_disputed>x.principal_cents+x.processing_fee_cents then raise exception 'Invalid reversal amount.';end if;
 insert into public.payment_events(id,event_type,payload) values(p_event,'rental_charge_reconciliation',jsonb_build_object('charge',p_charge)) on conflict do nothing;if not found then return;end if;
 target=least(x.principal_cents,greatest(x.refunded_cents,p_refunded)+p_disputed);delta=target-x.reversed_cents;
 select id into uid from public.profiles where id=x.wallet_account;
 if delta<>0 then insert into public.credit_ledger(user_id,wallet_account,rental_id,amount_cents,reason,idempotency_key)
 values(uid,x.wallet_account,x.rental_id,-delta,case when delta>0 then 'rental_payment_reversed' else 'rental_payment_restored' end,'rental_reversal:'||p_event);end if;
 update public.payment_receipts set refunded_cents=greatest(refunded_cents,p_refunded),disputed_cents=p_disputed,dispute_active=p_active,reversed_cents=target,event_created=p_created where charge_id=p_charge;
 select owner_id into owner_account from public.rentals where id=x.rental_id;
 if target>0 or p_active then
 insert into public.support_cases(rental_id,reporter_id,subject_id,kind,financial_hold,dedupe_key,description) values(x.rental_id,uid,owner_account,'payment',true,'charge:'||p_charge,'Payment refunded or disputed. Reconcile renter credits, owner earnings, fees and any transfers before releasing holds.')
 on conflict(dedupe_key) do update set status='open',resolved_at=null,updated_at=now();
 end if;
end $$;
revoke all on function public.reconcile_rental_charge(text,text,bigint,integer,integer,boolean) from public,anon,authenticated;grant execute on function public.reconcile_rental_charge(text,text,bigint,integer,integer,boolean) to service_role;

create or replace function private.assert_credit_account_clear(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if (select coalesce(sum(amount_cents),0) from public.credit_ledger where wallet_account=p_user)<0
 or exists(select 1 from public.credit_topups where wallet_account=p_user and dispute_active)
 or exists(select 1 from public.payment_receipts where wallet_account=p_user and dispute_active)
 or exists(select 1 from public.support_cases where financial_hold and status<>'resolved' and p_user in(reporter_id,subject_id))
 then raise exception 'Your credit account needs payment review before spending or withdrawing.';end if;
end $$;
create function private.withdrawable(p_user uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(amount_cents),0)-coalesce(sum(greatest(amount_cents,0)) filter(where created_at>now()-interval '7 days'),0)
 -(select coalesce(sum(principal_cents),0) from public.payment_receipts where wallet_account=p_user and (available_at is null or available_at>now()))
 from public.credit_ledger where wallet_account=p_user;
$$;
revoke all on function private.withdrawable(uuid) from public,anon,authenticated;
grant execute on function private.withdrawable(uuid) to service_role;
-- Reservation debits balance first; account for that hold when checking a retry.
create or replace function public.credit_withdrawal_ready(p_user uuid,p_request uuid) returns boolean language plpgsql security invoker set search_path='' as $$declare w public.credit_withdrawals;begin
 select * into w from public.credit_withdrawals where id=p_request and user_id=p_user and status='pending';if not found then raise exception 'Withdrawal unavailable.';end if;
 perform private.assert_credit_account_clear(p_user);
 if private.withdrawable(p_user)+w.amount_cents<w.amount_cents then raise exception 'Funds are not withdrawable yet.';end if;
 return true;
end $$;
-- Prevent creating holds that are known to be unavailable.
create or replace function public.reserve_credit_withdrawal(p_user uuid,p_amount integer,p_request uuid) returns public.credit_withdrawals language plpgsql security invoker set search_path='' as $$begin
 if not exists(select 1 from public.credit_withdrawals where id=p_request and user_id=p_user and amount_cents=p_amount) then
 perform private.assert_credit_account_clear(p_user);
 if p_amount>private.withdrawable(p_user) then raise exception 'Amount exceeds settled credits outside the seven-day safety hold.';end if;
 if (select coalesce(sum(amount_cents),0) from public.credit_withdrawals where user_id=p_user and created_at>now()-interval '24 hours')+p_amount>100000 then raise exception 'Daily withdrawal limit is $1,000.';end if;
 end if;return private.reserve_credit_withdrawal_before_credit_funding(p_user,p_amount,p_request);
end $$;
create or replace function public.wallet_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$declare u uuid=auth.uid();begin
 if u is null or not private.session_allowed() then raise exception 'Sign in to view credits.';end if;
 return (select jsonb_build_object('balance_cents',coalesce(sum(amount_cents),0),'total_in_cents',coalesce(sum(amount_cents) filter(where amount_cents>0),0),'total_out_cents',-coalesce(sum(amount_cents) filter(where amount_cents<0),0),'entry_count',count(*),'withdrawable_cents',greatest(0,private.withdrawable(u)),'pending_withdrawal_cents',(select coalesce(sum(amount_cents),0) from public.credit_withdrawals where user_id=u and status='pending'),'dispute_hold',exists(select 1 from public.support_cases where financial_hold and status<>'resolved' and u in(reporter_id,subject_id)) or exists(select 1 from public.credit_topups where wallet_account=u and dispute_active)) from public.credit_ledger where wallet_account=u);
end $$;
revoke all on function public.wallet_summary() from public,anon;grant execute on function public.wallet_summary() to authenticated;

-- The owner cannot extend an unreceived-item hold indefinitely without an operator case.
alter table public.rentals add column receipt_case_id uuid references public.support_cases(id);
alter function private.finish_return(uuid,integer) rename to finish_return_before_receipt_guard;
create function private.finish_return(p_rental uuid,p_damage integer default 0) returns void language plpgsql security invoker set search_path='' as $$declare r public.rentals;cid uuid;begin
 select * into r from public.rentals where id=p_rental for update;
 if r.status='complete' then return;end if;
 if r.status not in('review','disputed') then raise exception 'Report the return before settlement.';end if;
 if r.physical_returned_at is null then
 insert into public.support_cases(rental_id,reporter_id,subject_id,kind,dedupe_key,description)
 values(r.id,r.owner_id,r.renter_id,'not_received','receipt:'||r.id,'Return reported without confirmed receipt. Contact both participants and resolve possession before deposit settlement.')
 on conflict(dedupe_key) do update set status='open',resolved_at=null,updated_at=now() returning id into cid;
 update public.rentals set receipt_case_id=cid,escalation_requested_at=coalesce(escalation_requested_at,now()) where id=r.id;
 return;
 end if;
 perform private.finish_return_before_receipt_guard(p_rental,p_damage);
end $$;
revoke all on function private.finish_return(uuid,integer),private.finish_return_before_receipt_guard(uuid,integer) from public,anon,authenticated;grant execute on function private.finish_return(uuid,integer),private.finish_return_before_receipt_guard(uuid,integer) to service_role;

-- Abuse controls also apply to direct Data API / Storage writes.
create table public.user_blocks(user_id uuid not null references public.profiles(id) on delete cascade,blocked_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,blocked_id),check(user_id<>blocked_id));
alter table public.user_blocks enable row level security;revoke all on public.user_blocks from anon,authenticated;grant select,insert,delete on public.user_blocks to authenticated;grant all on public.user_blocks to service_role;
create policy "own blocks" on public.user_blocks to authenticated using(user_id=(select auth.uid()) and (select private.session_allowed())) with check(user_id=(select auth.uid()) and (select private.session_allowed()));
create function private.guard_message() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text||':messages',0));
 if exists(select 1 from public.user_blocks where (user_id=new.sender_id and blocked_id=new.recipient_id) or(user_id=new.recipient_id and blocked_id=new.sender_id)) then raise exception 'Messaging is unavailable for this account.';end if;
 if exists(select 1 from private.account_restrictions where user_id=new.sender_id) then raise exception 'Account restricted.';end if;
 if (select count(*) from public.messages where sender_id=new.sender_id and created_at>now()-interval '1 minute')>=10 then raise exception 'Message limit reached. Wait a minute.';end if;
 return new;
end $$;
create trigger guard_message before insert on public.messages for each row execute function private.guard_message();
create function private.guard_upload_quota() returns trigger language plpgsql security definer set search_path='' as $$declare u text;begin
 if new.bucket_id not in('tool-photos','return-photos','avatars') or auth.uid() is null then return new;end if;u=auth.uid()::text;
 perform pg_advisory_xact_lock(hashtextextended(u||':uploads',0));
 if exists(select 1 from private.account_restrictions where user_id=auth.uid()) then raise exception 'Account restricted.';end if;
 if (select count(*) from storage.objects where bucket_id in('tool-photos','return-photos','avatars') and split_part(name,'/',1)=u and created_at>now()-interval '1 day')>=100 then raise exception 'Daily photo limit reached.';end if;return new;
end $$;
create trigger guard_ng_upload_quota before insert on storage.objects for each row execute function private.guard_upload_quota();
revoke all on function private.guard_message(),private.guard_upload_quota() from public,anon,authenticated;

-- Preserve evidence during financial exposure, and never forfeit a nonzero wallet on deletion.
create or replace function private.guard_wallet_deletion() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.deletion_started_at is not null then
 perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
 if (select coalesce(sum(amount_cents),0) from public.credit_ledger where wallet_account=new.id)<>0 then raise exception 'Settle your credit balance with support before deleting your account.';end if;
 if exists(select 1 from public.support_cases where status<>'resolved' and (reporter_id=new.id or subject_id=new.id and (financial_hold or rental_id is not null)))
 or exists(select 1 from public.credit_withdrawals where user_id=new.id and status='pending')
 or exists(select 1 from public.credit_topups where wallet_account=new.id and(status='pending_payment' or dispute_active))
 or exists(select 1 from public.payment_receipts where wallet_account=new.id and dispute_active) then raise exception 'Resolve open support cases, funding and transfers before deletion.';end if;
 if exists(select 1 from public.payment_receipts where wallet_account=new.id and created_at>now()-interval '180 days')
 or exists(select 1 from public.rentals where new.id in(owner_id,renter_id) and completed_at>now()-interval '180 days') then raise exception 'Financial evidence is retained for 180 days. Request account closure and privacy assistance from Support.';end if;
 end if;return new;
end $$;
-- Retire unused external-AI quota API; historical migrations remain intact.
drop function if exists public.take_ai_slot(uuid);
drop table if exists public.ai_usage;
notify pgrst,'reload schema';
create or replace function private.session_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and deletion_started_at is null)
 and not exists(select 1 from private.account_restrictions where user_id=(select auth.uid()))
 and ((select auth.jwt()->>'aal')='aal2' or not exists(select 1 from auth.mfa_factors where user_id=(select auth.uid()) and status='verified'));
$$;
create function public.operate_case(p_actor uuid,p_case uuid,p_action text,p_note text,p_amount integer default 0,p_request uuid default null) returns public.support_cases language plpgsql security invoker set search_path='' as $$
declare c public.support_cases;r public.rentals;account uuid;allocated bigint;maximum bigint;
begin
 if not public.operator_allowed(p_actor) or length(btrim(p_note))<10 or p_request is null then raise exception 'Authorized operator, explanation and request ID required.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into c from public.support_cases where id=p_case;
 if c.rental_id is not null then
 for account in select u from public.rentals r0 cross join lateral unnest(array[r0.owner_id,r0.renter_id]) u where r0.id=c.rental_id and u is not null order by u loop perform pg_advisory_xact_lock(hashtextextended(account::text,0));end loop;
 perform 1 from public.tools where id=(select tool_id from public.rentals where id=c.rental_id) for update;
 perform 1 from public.rentals where id=c.rental_id for update;end if;
 select * into c from public.support_cases where id=p_case for update;if not found then raise exception 'Case unavailable.';end if;
 if exists(select 1 from private.operation_audit where details->>'request_id'=p_request::text) then return c;end if;
 if p_amount<0 then raise exception 'Amount cannot be negative.';end if;
 if p_action='assign' then update public.support_cases set assigned_to=p_actor,status='investigating',updated_at=now() where id=c.id;
 elsif p_action='resolve' then update public.support_cases set status='resolved',resolution=p_note,resolved_at=now(),updated_at=now() where id=c.id;
 elsif p_action='confirm-receipt' and c.rental_id is not null then
 select * into r from public.rentals where id=c.rental_id for update;
 if r.status not in('review','disputed','complete') then raise exception 'Return must be reported first.';end if;
 update public.rentals set physical_state='returned',physical_returned_at=coalesce(physical_returned_at,now()),item_ready=false where id=r.id;
 perform private.rental_event(r.id,p_actor,'support_confirmed_receipt',jsonb_build_object('caseId',c.id,'note',p_note));
 update public.support_cases set status='resolved',resolution=p_note,resolved_at=now(),updated_at=now() where id=c.id;
 elsif p_action='settle-return' and c.rental_id is not null then
 select * into r from public.rentals where id=c.rental_id for update;if r.physical_returned_at is null then raise exception 'Confirm physical receipt before settlement.';end if;
 perform private.finish_return(r.id,p_amount);
 update public.support_cases set status='resolved',resolution=p_note,resolved_at=now(),updated_at=now() where id=c.id;
 elsif p_action='allocate-payment-loss' and c.kind='payment' and c.rental_id is not null and c.status<>'resolved' then
 select * into r from public.rentals where id=c.rental_id;
 if r.owner_id is null or r.renter_id is null or p_amount<=0 then raise exception 'Active participant accounts and a positive amount are required.';end if;
 select coalesce(sum(-amount_cents),0) into allocated from public.credit_ledger where rental_id=r.id and user_id=r.owner_id and reason='support_payment_allocation';
 select least(coalesce((select sum(reversed_cents) from public.payment_receipts where rental_id=r.id),0),coalesce((select sum(amount_cents) from public.credit_ledger where rental_id=r.id and user_id=r.owner_id and reason in('owner_earnings','agreed_damage')),0))-allocated into maximum;
 if p_amount>maximum then raise exception 'Allocation exceeds the verified payment loss or owner earnings not already allocated.';end if;
 insert into public.credit_ledger(user_id,wallet_account,rental_id,amount_cents,reason,idempotency_key) values
 (r.owner_id,r.owner_id,r.id,-p_amount,'support_payment_allocation','case-allocation:owner:'||p_request),
 (r.renter_id,r.renter_id,r.id,p_amount,'support_payment_allocation','case-allocation:renter:'||p_request);
 elsif p_action='restrict-account' and c.subject_id is not null then
 insert into private.account_restrictions(user_id,reason) values(c.subject_id,p_note) on conflict(user_id) do update set reason=excluded.reason;
 update public.tools set available=false where owner_id=c.subject_id;
 elsif p_action='restore-account' and c.subject_id is not null then delete from private.account_restrictions where user_id=c.subject_id;
 else raise exception 'Unknown case action.';end if;
 insert into private.operation_audit(actor_id,action,subject,details) values(p_actor,p_action,c.id::text,jsonb_build_object('note',p_note,'request_id',p_request,'amount_cents',p_amount));
 insert into public.notifications(user_id,rental_id,message,dedupe_key) select u,c.rental_id,'Support case updated. Open Support to view the decision.','case:'||p_request||':'||u from unnest(array[c.reporter_id,c.subject_id]) u where u is not null on conflict do nothing;
 select * into c from public.support_cases where id=p_case;return c;
end $$;
revoke all on function public.operate_case(uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;grant execute on function public.operate_case(uuid,uuid,text,text,integer,uuid) to service_role;
create function public.notification_batch() returns table(id bigint,user_id uuid,message text) language plpgsql security invoker set search_path='' as $$begin
 return query with claimed as(select d.notification_id from private.notification_delivery d where d.delivered_at is null and d.next_attempt_at<=now() and d.attempts<12 order by d.next_attempt_at limit 20 for update skip locked),updated as(update private.notification_delivery d set attempts=d.attempts+1,next_attempt_at=now()+interval '10 minutes' from claimed c where d.notification_id=c.notification_id returning d.notification_id)
 select n.id,n.user_id,n.message from updated u join public.notifications n on n.id=u.notification_id;
end $$;
create function public.notification_result(p_id bigint,p_sent boolean,p_error text default '') returns void language sql security invoker set search_path='' as $$update private.notification_delivery set delivered_at=case when p_sent then now() else null end,last_error=left(p_error,200) where notification_id=p_id;$$;
create function public.queue_operation_reminders() returns void language plpgsql security invoker set search_path='' as $$begin
 insert into public.notifications(user_id,rental_id,message,dedupe_key)
 select p,r.id,'A pickup, return or inspection deadline is approaching. Open your rental for details.','reminder:'||r.id||':'||r.status||':'||date_trunc('day',now())||':'||p
 from public.rentals r cross join lateral unnest(array[r.owner_id,r.renter_id]) p where p is not null and (
 r.status='reserved' and r.pickup_window_start between now() and now()+interval '24 hours' or r.status='out' and r.return_window_end<now()+interval '24 hours' or r.status in('review','disputed') and coalesce(r.claim_deadline,r.review_deadline)<now()+interval '24 hours') on conflict do nothing;
 insert into public.notifications(user_id,rental_id,message,dedupe_key)
 select o.user_id,c.rental_id,'Support case needs attention. Open the operator queue.','operator:'||c.id||':'||date_trunc('day',now())||':'||o.user_id from public.support_cases c cross join private.operator_accounts o where c.status<>'resolved' and c.due_at<now()+interval '1 hour' on conflict do nothing;
end $$;
revoke all on function public.notification_batch(),public.notification_result(bigint,boolean,text),public.queue_operation_reminders() from public,anon,authenticated;
grant execute on function public.notification_batch(),public.notification_result(bigint,boolean,text),public.queue_operation_reminders() to service_role;
create function public.check_photo_quota(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$declare requests_now integer;begin
 perform public.check_request_access(p_user,'photos',10);
 insert into private.rate_windows(user_id,scope) values(p_user,'photos-day') on conflict(user_id,scope) do update set
 requests=case when private.rate_windows.window_start<now()-interval '1 day' then 1 else private.rate_windows.requests+1 end,
 window_start=case when private.rate_windows.window_start<now()-interval '1 day' then now() else private.rate_windows.window_start end returning requests into requests_now;
 if requests_now>100 then raise exception 'Daily photo upload limit reached.';end if;
end $$;
revoke all on function public.check_photo_quota(uuid) from public,anon,authenticated;grant execute on function public.check_photo_quota(uuid) to service_role;
create policy "ng uploads require sanitizing service" on storage.objects as restrictive for insert to authenticated with check(bucket_id not in('tool-photos','return-photos','avatars'));

-- Confirm receipt before settlement, and never announce a refund that was deferred.
alter function public.change_rental(uuid,uuid,text,jsonb) set schema private;
alter function private.change_rental(uuid,uuid,text,jsonb) rename to change_rental_before_hardening;
revoke all on function private.change_rental_before_hardening(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.change_rental_before_hardening(uuid,uuid,text,jsonb) to service_role;
create function public.change_rental(p_user uuid,p_rental uuid,p_action text,p_data jsonb default '{}') returns public.rentals language plpgsql security invoker set search_path='' as $$
declare r public.rentals;begin
 perform 1 from public.tools where id=(select tool_id from public.rentals where id=p_rental) for update;
 select * into r from public.rentals where id=p_rental for update;
 if r.id is null or p_user is null or p_user is distinct from r.owner_id and p_user is distinct from r.renter_id then raise exception 'Rental not found.';end if;
 if p_action='approve' and p_user=r.owner_id and r.status in('review','disputed') and coalesce((p_data->>'confirmReceipt')::boolean,false) then
 update public.rentals set physical_returned_at=coalesce(physical_returned_at,now()),physical_state='returned' where id=r.id;
 end if;
 return private.change_rental_before_hardening(p_user,p_rental,p_action,p_data);
end $$;
revoke all on function public.change_rental(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.change_rental(uuid,uuid,text,jsonb) to service_role;

create or replace function public.process_rental_deadlines() returns integer language plpgsql security invoker set search_path='' as $$declare x record;n integer=0;begin
 for x in select id,tool_id,status from public.rentals where(status in('requested','accepted') and expires_at<now())
  or(status in('review','disputed') and coalesce(claim_deadline,review_deadline)<now()) order by tool_id loop
  if not exists(select 1 from public.tools where id=x.tool_id for update skip locked) then continue;end if;
  perform 1 from public.rentals where id=x.id for update;
  if x.status in('requested','accepted') then update public.rentals set status='expired' where id=x.id and status in('requested','accepted') and expires_at<now();
  elsif exists(select 1 from public.rentals where id=x.id and status in('review','disputed') and coalesce(claim_deadline,review_deadline)<now()) then
   perform private.finish_return(x.id,0);
   if exists(select 1 from public.rentals where id=x.id and status='complete') then perform private.rental_event(x.id,null,'deadline_refund');end if;end if;n=n+1;
 end loop;
 for x in select e.id,e.rental_id,r.tool_id from public.rental_extensions e join public.rentals r on r.id=e.rental_id
  where e.status='approved' and e.expires_at<now() order by r.tool_id loop
  if not exists(select 1 from public.tools where id=x.tool_id for update skip locked) then continue;end if;
  perform 1 from public.rentals where id=x.rental_id for update;
  update public.rental_extensions set status='expired' where id=x.id and status='approved' and expires_at<now();
  if found then update public.rentals set calendar_ends_at=case when status='complete' then calendar_ends_at else ends_at end where id=x.rental_id;end if;
 end loop;return n;
end$$;

-- Daily reminders remain available in-app even before an outbound adapter is configured.
do $$begin if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.schedule('ng-operation-reminders','*/15 * * * *','select public.queue_operation_reminders();');
 end if;end $$;
create unique index operation_request_id on private.operation_audit((details->>'request_id')) where details ? 'request_id';
create index receipt_settlement_pending on public.payment_receipts(created_at) where available_at is null;
create index support_cases_history on public.support_cases(created_at desc,id desc);

-- A frontend can identify the schema it requires without accessing account data.
create function public.release_version() returns text language sql immutable set search_path='' as $$ select '2026-10-04-hardening-1'::text; $$;
revoke all on function public.release_version() from public;
grant execute on function public.release_version() to anon,authenticated,service_role;

-- Bounded marketplace search. RLS still controls all returned tools and profile fields.
create function public.search_tools(p_query text default '',p_category text default null,p_after uuid default null,p_limit integer default 100)
returns setof public.tools language sql stable security invoker set search_path='' as $$
 select t.* from public.tools t where t.available and t.archived_at is null and t.owner_id<>auth.uid()
 and (p_after is null or t.id>p_after) and (p_category is null or t.category=p_category)
 and (coalesce(p_query,'')='' or position(lower(left(p_query,200)) in lower(t.title||' '||t.description||' '||t.category||' '||coalesce((select p.neighborhood from public.profiles p where p.id=t.owner_id),'')))>0)
 order by t.id limit greatest(1,least(coalesce(p_limit,100),100));
$$;
revoke all on function public.search_tools(text,text,uuid,integer) from public,anon;
grant execute on function public.search_tools(text,text,uuid,integer) to authenticated;

create function private.close_received_case() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.physical_returned_at is not null and old.physical_returned_at is null and new.receipt_case_id is not null then
 update public.support_cases set status='resolved',resolved_at=now(),updated_at=now(),resolution='Physical receipt confirmed in the rental handoff record.'
 where id=new.receipt_case_id and rental_id=new.id and kind='not_received';
 end if;return new;
end $$;
revoke all on function private.close_received_case() from public,anon,authenticated;
create trigger close_received_case after update of physical_returned_at on public.rentals for each row execute function private.close_received_case();
