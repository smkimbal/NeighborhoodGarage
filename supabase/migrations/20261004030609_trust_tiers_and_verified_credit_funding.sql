-- Two-way reviews. One review per participant, with subject chosen by the server.
alter table public.reviews drop constraint reviews_rental_id_key;
alter table public.reviews add constraint reviews_rental_author_key unique(rental_id,author_id);
alter table public.reviews add column subject_role text not null default 'owner' check(subject_role in('owner','renter'));
create or replace function private.review_subject() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.rentals;
begin
 select * into r from public.rentals where id=new.rental_id and status='complete' and physical_state<>'out';
 if not found or (new.author_id is distinct from r.owner_id and new.author_id is distinct from r.renter_id) then raise exception 'Only participants can review a completed, returned rental.';end if;
 new.tool_id=r.tool_id;new.subject_id=case when new.author_id=r.renter_id then r.owner_id else r.renter_id end;
 new.subject_role=case when new.author_id=r.renter_id then 'owner' else 'renter' end;return new;
end $$;
drop policy "renters review completed rentals" on public.reviews;
create policy "participants review completed rentals" on public.reviews for insert to authenticated with check(
 author_id=(select auth.uid()) and exists(select 1 from public.rentals r where r.id=rental_id and r.status='complete' and r.physical_state<>'out' and (select auth.uid()) in(r.owner_id,r.renter_id)));

drop function public.reputation_summary(uuid[]);
create function private.community_reputation(p_ids uuid[])
returns table(user_id uuid,listed bigint,borrowed bigint,lent bigint,review_count bigint,rating numeric,
 owner_review_count bigint,owner_rating numeric,owner_reviewers bigint,renter_review_count bigint,renter_rating numeric,renter_reviewers bigint,
 reviews_written bigint,owner_reviews_written bigint,renter_reviews_written bigint,display_name text,neighborhood text)
language sql stable security definer set search_path='' as $$
 select p.id,
  (select count(*) from public.tools t where t.owner_id=p.id and t.archived_at is null),
  (select count(*) from public.rentals r where r.renter_id=p.id and r.status='complete' and r.physical_state in('returned','ready')),
  (select count(*) from public.rentals r where r.owner_id=p.id and r.status='complete' and r.physical_state in('returned','ready')),
  (select count(*) from public.reviews v where v.subject_id=p.id and v.subject_role='owner'),
  (select coalesce(avg(v.rating),0) from public.reviews v where v.subject_id=p.id and v.subject_role='owner'),
  (select count(*) from public.reviews v where v.subject_id=p.id and v.subject_role='owner'),
  (select coalesce(avg(v.rating),0) from public.reviews v where v.subject_id=p.id and v.subject_role='owner'),
  (select count(distinct v.author_id) from public.reviews v where v.subject_id=p.id and v.subject_role='owner'),
  (select count(*) from public.reviews v where v.subject_id=p.id and v.subject_role='renter'),
  (select coalesce(avg(v.rating),0) from public.reviews v where v.subject_id=p.id and v.subject_role='renter'),
  (select count(distinct v.author_id) from public.reviews v where v.subject_id=p.id and v.subject_role='renter'),
  (select count(*) from public.reviews v where v.author_id=p.id and char_length(btrim(v.body))>=30),
  (select count(*) from public.reviews v where v.author_id=p.id and v.subject_role='renter' and char_length(btrim(v.body))>=30),
  (select count(*) from public.reviews v where v.author_id=p.id and v.subject_role='owner' and char_length(btrim(v.body))>=30),p.display_name,p.neighborhood
 from public.profiles p where p.id=any(p_ids) and p.deletion_started_at is null and auth.uid() is not null and (select private.session_allowed()) and cardinality(p_ids) between 1 and 50;
$$;
revoke all on function private.community_reputation(uuid[]) from public,anon;
grant execute on function private.community_reputation(uuid[]) to authenticated;
create function public.reputation_summary(p_ids uuid[])
returns table(user_id uuid,listed bigint,borrowed bigint,lent bigint,review_count bigint,rating numeric,
 owner_review_count bigint,owner_rating numeric,owner_reviewers bigint,renter_review_count bigint,renter_rating numeric,renter_reviewers bigint,
 reviews_written bigint,owner_reviews_written bigint,renter_reviews_written bigint,display_name text,neighborhood text)
language sql stable security invoker set search_path='' as $$select * from private.community_reputation(p_ids)$$;
revoke all on function public.reputation_summary(uuid[]) from public,anon;
grant execute on function public.reputation_summary(uuid[]) to authenticated;

-- Financial receipts survive account deletion without retaining profile details.
create table public.credit_topups(
 id uuid primary key,user_id uuid references public.profiles(id) on delete set null,wallet_account uuid not null,
 amount_cents integer not null check(amount_cents between 100 and 50000),currency text not null default 'usd' check(currency='usd'),
 status text not null default 'pending_payment' check(status in('pending_payment','paid','expired','failed','cancelled')),
 stripe_checkout_session_id text unique,stripe_payment_intent_id text unique,stripe_charge_id text unique,stripe_balance_transaction_id text,
 stripe_fee_cents integer check(stripe_fee_cents>=0),available_at timestamptz,paid_at timestamptz,
 refunded_cents integer not null default 0 check(refunded_cents>=0),disputed_cents integer not null default 0 check(disputed_cents>=0),
 reversed_ledger_cents integer not null default 0 check(reversed_ledger_cents>=0),dispute_active boolean not null default false,
 created_at timestamptz not null default now(),checkout_expires_at timestamptz not null default(now()+interval '31 minutes'),
 check(refunded_cents<=amount_cents and disputed_cents<=amount_cents and reversed_ledger_cents<=amount_cents)
);
create index credit_topups_user_created_idx on public.credit_topups(user_id,created_at desc);
alter table public.credit_topups enable row level security;
revoke all on public.credit_topups from anon,authenticated;
grant select on public.credit_topups to authenticated;grant all on public.credit_topups to service_role;
create policy "own credit funding" on public.credit_topups for select to authenticated using(user_id=(select auth.uid()) and (select private.session_allowed()));

alter table public.credit_ledger add column entry_no bigint generated always as identity unique,add column wallet_account uuid,add column topup_id uuid references public.credit_topups(id),add column currency text not null default 'usd' check(currency='usd');
update public.credit_ledger set wallet_account=user_id;
alter table public.credit_ledger alter column wallet_account set not null,alter column user_id drop not null;
alter table public.credit_ledger drop constraint credit_ledger_user_id_fkey;
alter table public.credit_ledger add constraint credit_ledger_user_id_fkey foreign key(user_id) references public.profiles(id) on delete set null;
create function private.credit_entry_account() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.wallet_account=coalesce(new.wallet_account,new.user_id);if new.wallet_account is distinct from new.user_id then raise exception 'Credit account mismatch.';end if;return new;end $$;
create trigger credit_entry_account before insert on public.credit_ledger for each row execute function private.credit_entry_account();
create function private.immutable_credit_entry() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- Foreign-key cascades may redact deleted profiles/rentals, never financial fields.
 if tg_op='UPDATE' and pg_trigger_depth()>1 and (to_jsonb(new)-array['user_id','rental_id'])=(to_jsonb(old)-array['user_id','rental_id'])
  and (new.user_id=old.user_id or new.user_id is null) and (new.rental_id=old.rental_id or new.rental_id is null) then return new;end if;
 raise exception 'Credit history is append-only. Record a compensating transaction.';
end $$;
create trigger immutable_credit_entry before update or delete on public.credit_ledger for each row execute function private.immutable_credit_entry();
revoke all on function private.credit_entry_account(),private.immutable_credit_entry() from public,anon,authenticated;

create index credit_ledger_user_entry_idx on public.credit_ledger(user_id,entry_no desc);

create function public.wallet_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('balance_cents',coalesce(sum(l.amount_cents),0),'total_in_cents',coalesce(sum(l.amount_cents) filter(where l.amount_cents>0),0),
 'total_out_cents',-coalesce(sum(l.amount_cents) filter(where l.amount_cents<0),0),'entry_count',count(l.id),
 'pending_withdrawal_cents',(select coalesce(sum(w.amount_cents),0) from public.credit_withdrawals w where w.user_id=auth.uid() and w.status='pending'),
 'dispute_hold',exists(select 1 from public.credit_topups t where t.user_id=auth.uid() and t.dispute_active))
 from public.credit_ledger l where l.user_id=(select auth.uid());
$$;
create function public.wallet_activity(p_anchor bigint default null,p_before_entry bigint default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 with anchor as(select coalesce(p_anchor,max(entry_no),0) value from public.credit_ledger where user_id=(select auth.uid())),
 history as(select l.*,sum(l.amount_cents) over(order by l.entry_no) running_balance_cents from public.credit_ledger l where l.user_id=(select auth.uid()) and l.entry_no<=(select value from anchor)),
 page as(select * from history where p_before_entry is null or entry_no<p_before_entry order by entry_no desc limit 50)
 select jsonb_build_object('as_of',now(),'anchor',(select value from anchor),'balance_cents',(select coalesce(sum(amount_cents),0) from history),
 'entry_count',(select count(*) from history),'total_in_cents',(select coalesce(sum(amount_cents) filter(where amount_cents>0),0) from history),
 'total_out_cents',(select -coalesce(sum(amount_cents) filter(where amount_cents<0),0) from history),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('id',id,'entry_no',entry_no,'amount_cents',amount_cents,'reason',reason,'reference',idempotency_key,'rental_id',rental_id,'topup_id',topup_id,'created_at',created_at,'running_balance_cents',running_balance_cents) order by entry_no desc) from page),'[]'::jsonb));
$$;
revoke all on function public.wallet_summary(),public.wallet_activity(bigint,bigint) from public,anon;
grant execute on function public.wallet_summary(),public.wallet_activity(bigint,bigint) to authenticated;

-- Operations reconcile this liability snapshot with the platform Stripe balance.
-- Negative wallets are receivables; they must not offset another user's credits.
create function public.credit_liability_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 with wallets as(select wallet_account,max(user_id::text) user_id,sum(amount_cents) balance from public.credit_ledger group by wallet_account)
 select jsonb_build_object('as_of',now(),
  'available_credit_liability_cents',coalesce(sum(greatest(balance,0)) filter(where user_id is not null),0),
  'negative_wallet_receivable_cents',-coalesce(sum(least(balance,0)) filter(where user_id is not null),0),
  'archived_wallet_net_cents',coalesce(sum(balance) filter(where user_id is null),0),
  'pending_transfer_liability_cents',(select coalesce(sum(amount_cents),0) from public.credit_withdrawals where status='pending'),
  'unreleased_rental_deposit_cents',(select coalesce(sum(greatest(deposit_cents-deposit_refunded_cents,0)),0) from public.rentals where status in('reserved','out','review','disputed')),
  'ledger_entries',(select count(*) from public.credit_ledger)) from wallets;
$$;
revoke all on function public.credit_liability_summary() from public,anon,authenticated;
grant execute on function public.credit_liability_summary() to service_role;

create function public.create_credit_topup(p_user uuid,p_amount integer,p_request uuid) returns public.credit_topups language plpgsql security invoker set search_path='' as $$
declare t public.credit_topups;
begin
 if p_request is null or p_amount is null or p_amount not between 100 and 50000 then raise exception 'Add between $1 and $500.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into t from public.credit_topups where id=p_request;
 if found then if t.user_id is distinct from p_user or t.amount_cents<>p_amount then raise exception 'Funding request mismatch.';end if;return t;end if;
 if not exists(select 1 from public.profiles where id=p_user and deletion_started_at is null) then raise exception 'Account unavailable.';end if;
 if exists(select 1 from public.credit_topups where user_id=p_user and (status='pending_payment' or dispute_active)) then raise exception 'Resolve the pending funding or disputed payment first.';end if;
 if (select coalesce(sum(amount_cents),0)+p_amount from public.credit_topups where user_id=p_user and created_at>now()-interval '24 hours' and status in('pending_payment','paid'))>100000 then raise exception 'Daily credit funding limit is $1,000.';end if;
 insert into public.credit_topups(id,user_id,wallet_account,amount_cents) values(p_request,p_user,p_user,p_amount) returning * into t;return t;
end $$;

create function private.reconcile_topup_reversal(p_topup uuid,p_reference text) returns void language plpgsql security invoker set search_path='' as $$
declare t public.credit_topups;target integer;delta integer;
begin
 select * into t from public.credit_topups where id=p_topup for update;if t.status<>'paid' then return;end if;
 target=least(t.amount_cents,t.refunded_cents+t.disputed_cents);delta=target-t.reversed_ledger_cents;
 if delta<>0 then
  if t.user_id is null then raise exception 'Funding reversal for deleted account requires reconciliation.';end if;
  insert into public.credit_ledger(user_id,topup_id,amount_cents,reason,idempotency_key) values(t.user_id,t.id,-delta,case when delta>0 then 'funding_reversed' else 'funding_restored' end,'funding_adjustment:'||p_reference);
  update public.credit_topups set reversed_ledger_cents=target where id=t.id;
 end if;
end $$;

create function public.finish_credit_topup(p_event text,p_type text,p_topup uuid,p_session text,p_paid boolean,p_amount integer,p_currency text,p_intent text,p_charge text,p_balance_transaction text,p_fee integer,p_available_at timestamptz,p_payload jsonb)
returns public.credit_topups language plpgsql security invoker set search_path='' as $$
declare t public.credit_topups;
begin
 select * into t from public.credit_topups where id=p_topup;
 if not found then raise exception 'Funding request missing.';end if;
 perform pg_advisory_xact_lock(hashtextextended(t.wallet_account::text,0));select * into t from public.credit_topups where id=p_topup for update;
 if p_amount is distinct from t.amount_cents or p_currency is distinct from 'usd' or p_session is null or (t.stripe_checkout_session_id is not null and t.stripe_checkout_session_id<>p_session) then raise exception 'Funding receipt amount, currency or session mismatch.';end if;
 if p_paid and (p_intent is null or p_charge is null or p_type not in('checkout.session.completed','checkout.session.async_payment_succeeded','verified_checkout_sync')) then raise exception 'Verified funding payment is required.';end if;
 if not p_paid and p_type not in('checkout.session.expired','checkout.session.async_payment_failed','verified_checkout_cancel') then raise exception 'Invalid funding event.';end if;
 if t.status='paid' then
  if p_paid and (t.stripe_payment_intent_id<>p_intent or t.stripe_charge_id<>p_charge) then raise exception 'Funding receipt identity mismatch.';end if;return t;
 end if;
 insert into public.payment_events(id,event_type,payload) values(p_event,p_type,p_payload) on conflict(id) do nothing;if not found then return t;end if;
 if p_paid then
  if t.user_id is null then raise exception 'Paid funding for deleted account requires reconciliation.';end if;
  update public.credit_topups set status='paid',stripe_checkout_session_id=p_session,stripe_payment_intent_id=p_intent,stripe_charge_id=p_charge,stripe_balance_transaction_id=p_balance_transaction,stripe_fee_cents=p_fee,available_at=p_available_at,paid_at=now() where id=t.id returning * into t;
  insert into public.credit_ledger(user_id,topup_id,amount_cents,reason,idempotency_key) values(t.user_id,t.id,t.amount_cents,'stripe_funding','funding:'||t.id);
  perform private.reconcile_topup_reversal(t.id,p_event);
 else update public.credit_topups set status=case when p_type='checkout.session.async_payment_failed' then 'failed' when p_type='verified_checkout_cancel' then 'cancelled' else 'expired' end,stripe_checkout_session_id=p_session where id=t.id returning * into t;end if;
 select * into t from public.credit_topups where id=p_topup;return t;
end $$;

create function public.reverse_credit_topup(p_topup uuid,p_event text,p_type text,p_charge text,p_refunded integer,p_disputed integer,p_active boolean,p_payload jsonb)
returns public.credit_topups language plpgsql security invoker set search_path='' as $$
declare t public.credit_topups;
begin
 select * into t from public.credit_topups where id=p_topup;if not found then raise exception 'Funding request missing.';end if;
 perform pg_advisory_xact_lock(hashtextextended(t.wallet_account::text,0));select * into t from public.credit_topups where id=p_topup for update;
 if (t.stripe_charge_id is not null and t.stripe_charge_id<>p_charge) or p_refunded is null or p_disputed is null or p_refunded not between 0 and t.amount_cents or p_disputed not between 0 and t.amount_cents then raise exception 'Funding reversal mismatch.';end if;
 insert into public.payment_events(id,event_type,payload) values(p_event,p_type,p_payload) on conflict(id) do nothing;if not found then return t;end if;
 update public.credit_topups set refunded_cents=greatest(refunded_cents,p_refunded),disputed_cents=p_disputed,dispute_active=p_active where id=t.id;
 perform private.reconcile_topup_reversal(t.id,p_event);select * into t from public.credit_topups where id=p_topup;return t;
end $$;

create function public.cancel_uncreated_credit_topup(p_user uuid,p_topup uuid) returns public.credit_topups language plpgsql security invoker set search_path='' as $$
declare t public.credit_topups;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));select * into t from public.credit_topups where id=p_topup for update;
 if not found or t.user_id is distinct from p_user or t.stripe_checkout_session_id is not null or t.checkout_expires_at>now() or t.status<>'pending_payment' then raise exception 'Funding payment is still being reconciled.';end if;
 update public.credit_topups set status='expired' where id=t.id returning * into t;return t;
end $$;

create function private.assert_credit_account_clear(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if (select coalesce(sum(amount_cents),0) from public.credit_ledger where user_id=p_user)<0 or exists(select 1 from public.credit_topups where user_id=p_user and dispute_active) then raise exception 'Your credit account needs payment review before spending or withdrawing.';end if;
end $$;
alter function public.begin_rental_checkout(uuid,uuid) set schema private;
alter function private.begin_rental_checkout(uuid,uuid) rename to begin_rental_checkout_before_credit_funding;
create function public.begin_rental_checkout(p_user uuid,p_rental uuid) returns public.rentals language plpgsql security invoker set search_path='' as $$begin perform private.assert_credit_account_clear(p_user);return private.begin_rental_checkout_before_credit_funding(p_user,p_rental);end $$;
alter function public.begin_extension_checkout(uuid,uuid) set schema private;
alter function private.begin_extension_checkout(uuid,uuid) rename to begin_extension_checkout_before_credit_funding;
create function public.begin_extension_checkout(p_user uuid,p_extension uuid) returns public.rental_extensions language plpgsql security invoker set search_path='' as $$begin perform private.assert_credit_account_clear(p_user);return private.begin_extension_checkout_before_credit_funding(p_user,p_extension);end $$;
alter function public.reserve_credit_withdrawal(uuid,integer,uuid) set schema private;
alter function private.reserve_credit_withdrawal(uuid,integer,uuid) rename to reserve_credit_withdrawal_before_credit_funding;
create function public.reserve_credit_withdrawal(p_user uuid,p_amount integer,p_request uuid) returns public.credit_withdrawals language plpgsql security invoker set search_path='' as $$
begin
 -- Already reserved requests remain reconcilable after a later dispute.
 if not exists(select 1 from public.credit_withdrawals where id=p_request and user_id=p_user and amount_cents=p_amount) then perform private.assert_credit_account_clear(p_user);end if;
 return private.reserve_credit_withdrawal_before_credit_funding(p_user,p_amount,p_request);
end $$;

create or replace function private.guard_wallet_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deletion_started_at is not null then
  perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
  if exists(select 1 from public.credit_withdrawals where user_id=new.id and status='pending') or exists(select 1 from public.credit_topups where user_id=new.id and (status='pending_payment' or dispute_active)) then raise exception 'Resolve pending funding, disputed payments and withdrawals before deleting your account.';end if;
 end if;return new;
end $$;

create function public.credit_withdrawal_ready(p_user uuid,p_request uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.credit_withdrawals where id=p_request and user_id=p_user and status='pending') then raise exception 'Withdrawal request unavailable.';end if;
 perform private.assert_credit_account_clear(p_user);return true;
end $$;
revoke all on function public.credit_withdrawal_ready(uuid,uuid) from public,anon,authenticated;
grant execute on function public.credit_withdrawal_ready(uuid,uuid) to service_role;

revoke all on function public.create_credit_topup(uuid,integer,uuid),public.finish_credit_topup(text,text,uuid,text,boolean,integer,text,text,text,text,integer,timestamptz,jsonb),public.reverse_credit_topup(uuid,text,text,text,integer,integer,boolean,jsonb),public.cancel_uncreated_credit_topup(uuid,uuid),public.begin_rental_checkout(uuid,uuid),public.begin_extension_checkout(uuid,uuid),public.reserve_credit_withdrawal(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_credit_topup(uuid,integer,uuid),public.finish_credit_topup(text,text,uuid,text,boolean,integer,text,text,text,text,integer,timestamptz,jsonb),public.reverse_credit_topup(uuid,text,text,text,integer,integer,boolean,jsonb),public.cancel_uncreated_credit_topup(uuid,uuid),public.begin_rental_checkout(uuid,uuid),public.begin_extension_checkout(uuid,uuid),public.reserve_credit_withdrawal(uuid,integer,uuid) to service_role;
revoke all on function private.reconcile_topup_reversal(uuid,text),private.assert_credit_account_clear(uuid),private.begin_rental_checkout_before_credit_funding(uuid,uuid),private.begin_extension_checkout_before_credit_funding(uuid,uuid),private.reserve_credit_withdrawal_before_credit_funding(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function private.reconcile_topup_reversal(uuid,text),private.assert_credit_account_clear(uuid),private.begin_rental_checkout_before_credit_funding(uuid,uuid),private.begin_extension_checkout_before_credit_funding(uuid,uuid),private.reserve_credit_withdrawal_before_credit_funding(uuid,integer,uuid) to service_role;
