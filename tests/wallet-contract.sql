-- All fixture data and mutations roll back; no Stripe transactions are made.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); w public.credit_withdrawals; r public.rentals; n bigint;
begin
 insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',a||'@example.test','{}','{}',now(),now()),
 (b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',b||'@example.test','{}','{}',now(),now());
 insert into public.credit_ledger(user_id,amount_cents,reason,idempotency_key) values(a,10000,'qa_fixture','qa:'||a);
 insert into public.tools(id,owner_id,title,category,condition,rate_cents,deposit_cents) values(t,b,'Credit drill','Power tools','Good',1000,2000);
 -- Owner has no Stripe setup: internal rental still works.
 r:=public.reserve_rental(a,t,1,gen_random_uuid());
 if r.status<>'reserved' or r.amount_due_cents<>0 then raise exception 'Credit checkout requires external payment';end if;
 update public.rentals set status='review' where id=r.id;
 perform public.change_rental(b,r.id,'approve');perform public.change_rental(b,r.id,'approve');
 if (select sum(amount_cents) from public.credit_ledger where user_id=b)<>950 then raise exception 'Owner credit duplicated or missing';end if;
 begin perform public.reserve_credit_withdrawal(a,1000,req);raise exception 'Withdrawal without Connect accepted';exception when others then if SQLERRM='Withdrawal without Connect accepted' then raise;end if;end;
 update public.profiles set stripe_account_id='acct_fixture',stripe_onboarding_complete=true where id=a;
 w:=public.reserve_credit_withdrawal(a,1000,req);
 perform public.reserve_credit_withdrawal(a,1000,req);
 if (select sum(amount_cents) from public.credit_ledger where user_id=a)<>8000 then raise exception 'Withdrawal hold missing or duplicated';end if;
 begin perform public.reserve_credit_withdrawal(a,1000,gen_random_uuid());raise exception 'Concurrent pending withdrawal accepted';exception when others then if SQLERRM='Concurrent pending withdrawal accepted' then raise;end if;end;
 begin perform public.reserve_credit_withdrawal(b,1000,req);raise exception 'Foreign withdrawal replay accepted';exception when others then if SQLERRM='Foreign withdrawal replay accepted' then raise;end if;end;
 begin perform public.begin_account_deletion(a);raise exception 'Pending withdrawal deletion accepted';exception when others then if SQLERRM='Pending withdrawal deletion accepted' then raise;end if;end;
 update public.credit_withdrawals set status='paid',stripe_transfer_id='tr_fixture' where id=req;
 begin perform public.reserve_credit_withdrawal(a,8001,gen_random_uuid());raise exception 'Wallet overdraft accepted';exception when others then if SQLERRM='Wallet overdraft accepted' then raise;end if;end;
 if has_function_privilege('authenticated','public.reserve_credit_withdrawal(uuid,integer,uuid)','execute') then raise exception 'Wallet mutation exposed to browser';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 select count(*) into n from public.credit_withdrawals;
 if n<>0 then raise exception 'Foreign withdrawal visible';end if;
 reset role;
end $$;
select 'PASS: credit-only checkout, owner earnings, withdrawal holds/replay, overdraft, deletion guard, private RPC and RLS isolation' as result;
rollback;
