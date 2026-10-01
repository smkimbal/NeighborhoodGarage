-- Isolated database fixtures, always rolled back.
begin;
do $$
declare owner_id uuid:=gen_random_uuid(); renter_id uuid:=gen_random_uuid(); tool_id uuid:=gen_random_uuid(); rental public.rentals;
begin
 insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 (owner_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',owner_id||'@example.test','{}','{}',now(),now()),
 (renter_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',renter_id||'@example.test','{}','{}',now(),now());
 update public.profiles set stripe_account_id='acct_qa_'||owner_id,stripe_onboarding_complete=true where id=owner_id;
 insert into public.tools(id,owner_id,title,category,condition,rate_cents,deposit_cents) values(tool_id,owner_id,'Lifecycle fixture','Power tools','Good',1200,5000);
 rental:=public.reserve_rental(renter_id,tool_id,1,gen_random_uuid());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','aal','aal1')::text,true);
 begin update public.tools set archived_at=now(),available=false where id=tool_id;raise exception 'Active tool archived';exception when others then if SQLERRM='Active tool archived' then raise;end if;end;
 begin update public.tools set title='Changed active tool' where id=tool_id;raise exception 'Active tool edited';exception when others then if SQLERRM='Active tool edited' then raise;end if;end;
 perform set_config('request.jwt.claims','{}',true);
 update public.rentals set status='cancelled' where id=rental.id;
 update public.tools set archived_at=now(),available=false where id=tool_id;
 begin update public.tools set available=true where id=tool_id;raise exception 'Archived tool activated';exception when check_violation then null;end;
 begin perform public.reserve_rental(renter_id,tool_id,1,gen_random_uuid());raise exception 'Archived tool reserved';exception when others then if SQLERRM='Archived tool reserved' then raise;end if;end;
 update public.tools set archived_at=null,available=false,title='Edited inactive tool' where id=tool_id;
 if (select available or archived_at is not null or title<>'Edited inactive tool' from public.tools where id=tool_id) then raise exception 'Restore/edit failed';end if;
end $$;
rollback;
