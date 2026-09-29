-- Real RLS/aggregate checks with disposable fixtures; no persisted users or messages.
begin;
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',id||'@example.test','{}','{}',now(),now()
from unnest(array['fa010001-0000-4000-8000-000000000001'::uuid,'fa010001-0000-4000-8000-000000000002','fa010001-0000-4000-8000-000000000003']) id;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fa010001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into public.messages(sender_id,recipient_id,body) values('fa010001-0000-4000-8000-000000000001','fa010001-0000-4000-8000-000000000002','Walkthrough fixture');
do $$ begin
 if (select count(*) from public.messages where body='Walkthrough fixture')<>1 then raise exception 'Sender cannot read own message';end if;
 if (select count(*) from public.reputation_summary(array['fa010001-0000-4000-8000-000000000001'::uuid]))<>1 then raise exception 'Reputation lookup failed';end if;
 if exists(select 1 from public.reputation_summary(array_fill('fa010001-0000-4000-8000-000000000001'::uuid,array[51]))) then raise exception 'Oversize reputation query allowed';end if;
 begin
 insert into public.messages(sender_id,recipient_id,body) values('fa010001-0000-4000-8000-000000000002','fa010001-0000-4000-8000-000000000003','Forged');
 raise exception 'Sender spoof accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"fa010001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin if (select count(*) from public.messages where body='Walkthrough fixture')<>1 then raise exception 'Recipient cannot read message';end if;end $$;
select set_config('request.jwt.claims','{"sub":"fa010001-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $$ begin if exists(select 1 from public.messages where body='Walkthrough fixture') then raise exception 'Outsider read private chat';end if;end $$;
reset role;
do $$ begin if has_function_privilege('anon','public.reputation_summary(uuid[])','execute') then raise exception 'Anonymous reputation access';end if;end $$;
select 'PASS: participant chat access, outsider isolation, sender spoof rejection, bounded reputation lookup and anonymous rejection' as result;
rollback;
