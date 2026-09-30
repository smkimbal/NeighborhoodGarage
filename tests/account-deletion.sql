begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();t uuid:=gen_random_uuid();r public.rentals;
begin
 insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',a||'@example.test','{}','{}',now(),now()),(b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',b||'@example.test','{}','{}',now(),now());
 update public.profiles set stripe_account_id='acct_fixture',stripe_onboarding_complete=true where id=a;
 insert into public.tools(id,owner_id,title,category,condition,rate_cents,deposit_cents) values(t,a,'Deletion fixture','Power tools','Good',100,0);
 r:=public.reserve_rental(b,t,1,gen_random_uuid());
 begin perform public.begin_account_deletion(a);raise exception 'Active deletion allowed';exception when others then if SQLERRM='Active deletion allowed' then raise;end if;end;
 update public.rentals set status='complete',payout_status='pending' where id=r.id;
 begin perform public.begin_account_deletion(a);raise exception 'Pending payout deletion allowed';exception when others then if SQLERRM='Pending payout deletion allowed' then raise;end if;end;
 update public.rentals set payout_status='paid' where id=r.id;
 perform public.begin_account_deletion(a);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','aal','aal2')::text,true);
 if private.session_allowed() then raise exception 'Deleting account retains RLS access';end if;
 perform set_config('request.jwt.claims','{}',true);
 begin insert into public.rentals(tool_id,owner_id,renter_id,status,days,rental_cents,deposit_cents,fee_cents) values(t,a,b,'reserved',1,100,0,5);raise exception 'Deleting participant can rent';exception when others then if SQLERRM='Deleting participant can rent' then raise;end if;end;
 delete from auth.users where id=a;
 if exists(select 1 from public.profiles where id=a) or exists(select 1 from public.tools where id=t) then raise exception 'Profile or tool retained';end if;
 if not exists(select 1 from public.rentals where id=r.id and owner_id is null and tool_id is null and renter_id=b and rental_cents=100) then raise exception 'Settled receipt lost';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','aal','aal2')::text,true);
 if private.session_allowed() then raise exception 'Deleted JWT retains access';end if;
 if has_function_privilege('authenticated','public.begin_account_deletion(uuid)','execute') then raise exception 'Deletion RPC publicly executable';end if;
end $$;
select 'PASS: active/payout guards, account lock, rental race guard, permanent cascade, retained receipt, revoked stale-token access, private RPC' as result;
rollback;
