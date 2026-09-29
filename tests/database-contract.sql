-- Integration assertions; EVERYTHING (including fake users) rolls back.
begin;
do $$
declare owner_id uuid:=gen_random_uuid(); renter_id uuid:=gen_random_uuid(); tool1 uuid:=gen_random_uuid();tool2 uuid:=gen_random_uuid(); r public.rentals; r2 public.rentals; balance bigint; before_count bigint;
begin
 insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 (owner_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',owner_id||'@example.test','{}','{}',now(),now()),
 (renter_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',renter_id||'@example.test','{}','{}',now(),now());
 update public.profiles set stripe_account_id='acct_qa_'||owner_id,stripe_onboarding_complete=true where id=owner_id;
 insert into public.tools(id,owner_id,title,category,condition,rate_cents,deposit_cents) values(tool1,owner_id,'QA drill one','Power tools','Normal wear',1200,7500),(tool2,owner_id,'QA drill two','Power tools','Normal wear',1200,7500);
 insert into public.credit_ledger(user_id,amount_cents,reason,idempotency_key) values(renter_id,5000,'qa_fixture','qa:'||renter_id);
 r:=public.reserve_rental(renter_id,tool1,1,gen_random_uuid());
 if r.credits_used_cents<>5000 or r.amount_due_cents<>3700 then raise exception 'Credits not reserved atomically';end if;
 r2:=public.reserve_rental(renter_id,tool2,1,gen_random_uuid());
 if r2.credits_used_cents<>0 or r2.amount_due_cents<>8700 then raise exception 'Credits double spent';end if;
 if (public.reserve_rental(renter_id,tool1,1,r.checkout_request_id)).id<>r.id then raise exception 'Request replay created new rental';end if;
 begin perform public.finish_payment('evt_bad_'||r.id,'checkout.session.completed','cs_qa_'||r.id,r.id,true,100,'usd','pi_qa_'||r.id,'{}');raise exception 'Amount mismatch accepted';exception when others then if SQLERRM='Amount mismatch accepted' then raise;end if;end;
 perform public.finish_payment('evt_qa_'||r.id,'checkout.session.async_payment_succeeded','cs_qa_'||r.id,r.id,true,3700,'usd','pi_qa_'||r.id,'{}');
 perform public.finish_payment('evt_qa_'||r.id,'checkout.session.async_payment_succeeded','cs_qa_'||r.id,r.id,true,3700,'usd','pi_qa_'||r.id,'{}');
 perform public.finish_payment('evt_late_'||r.id,'checkout.session.expired','cs_qa_'||r.id,r.id,false,3700,'usd',null,'{}');
 if (select status from public.rentals where id=r.id)<>'reserved' or (select available from public.tools where id=tool1) then raise exception 'Late expiry released paid rental';end if;
 begin perform public.change_rental(owner_id,r.id,'pickup',jsonb_build_object('code',(select tracking_code from public.tools where id=tool1)));raise exception 'Owner impersonated renter';exception when others then if SQLERRM='Owner impersonated renter' then raise;end if;end;
 perform public.change_rental(renter_id,r.id,'pickup',jsonb_build_object('code',(select tracking_code from public.tools where id=tool1)));
 begin perform public.change_rental(renter_id,r.id,'return',jsonb_build_object('photo',owner_id||'/stolen.jpg','handoff','dropoff'));raise exception 'Foreign evidence accepted';exception when others then if SQLERRM='Foreign evidence accepted' then raise;end if;end;
 -- Fixture transition isolates concurrence/ledger behavior from object storage upload.
 update public.rentals set status='review' where id=r.id;
 perform public.change_rental(owner_id,r.id,'approve');
 perform public.change_rental(owner_id,r.id,'approve');
 select sum(amount_cents) into balance from public.credit_ledger where user_id=renter_id;
 if balance<>7500 then raise exception 'Deposit refund was duplicated or missing';end if;
 if (select payout_status from public.rentals where id=r.id)<>'pending' then raise exception 'Payout must be independent of credit return';end if;
 if not (select available from public.tools where id=tool1) then raise exception 'Approved tool not released';end if;
 perform public.finish_payment('evt_failed_'||r2.id,'checkout.session.async_payment_failed','cs_qa_'||r2.id,r2.id,false,8700,'usd',null,'{}');
 if (select status from public.rentals where id=r2.id)<>'payment_failed' then raise exception 'Async failure not applied';end if;
 insert into public.reviews(rental_id,author_id,rating,body) values(r.id,renter_id,5,'QA review');
 if not exists(select 1 from public.reviews where rental_id=r.id and subject_id=owner_id and tool_id=tool1) then raise exception 'Review subject not set';end if;
end $$;
select 'PASS: credit reservation, replay, amount validation, delayed events, role checks, photo ownership, approval/refund idempotency, payout separation, async failure, review attribution' as result;
rollback;
