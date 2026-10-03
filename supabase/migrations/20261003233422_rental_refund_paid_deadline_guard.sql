-- Legacy day-rounded prices never generate an early refund for a late return.
create or replace function private.refund_unused_reservation(p_rental uuid) returns void
 language plpgsql security invoker set search_path='' as $$
declare r public.rentals;used integer;target integer;fee_target integer;delta integer;
begin
 select * into r from public.rentals where id=p_rental for update;
 if r.status not in('review','disputed','complete') or r.physical_state='out' or r.billing_returned_at is null then return;end if;
 -- A confirmed return freezes the clock. Never charge for time spent inspecting.
 used=case when r.billing_returned_at>=r.billing_ends_at then r.rental_cents
 else least(r.rental_cents,greatest(0,round(r.daily_rate_cents*greatest(0,
  extract(epoch from(r.billing_returned_at-r.billing_starts_at)))/86400)::integer)) end;
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
