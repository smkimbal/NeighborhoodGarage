-- Privileged access remains service-managed, auditable and gated by MFA at the API.
create function private.operator_identity_eligible(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_user and u.email_confirmed_at is not null and p.deletion_started_at is null) and not exists(select 1 from private.account_restrictions where user_id=p_user);
$$;
revoke all on function private.operator_identity_eligible(uuid) from public,anon,authenticated;
grant execute on function private.operator_identity_eligible(uuid) to service_role;
create or replace function public.operator_allowed(p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.operator_accounts o join public.profiles p on p.id=o.user_id where o.user_id=p_user and p.deletion_started_at is null) and not exists(select 1 from private.account_restrictions where user_id=p_user);
$$;
alter table private.operator_accounts drop constraint operator_accounts_user_id_fkey,add constraint operator_accounts_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.support_cases drop constraint support_cases_assigned_to_fkey,add constraint support_cases_assigned_to_fkey foreign key(assigned_to) references auth.users(id) on delete set null;
create function public.set_operator_access(p_user uuid,p_enabled boolean,p_reason text,p_request uuid,p_authority text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare previous private.operation_audit;begin
 if p_user is null or p_enabled is null or p_request is null or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 or length(btrim(coalesce(p_authority,''))) not between 3 and 200 then raise exception 'An account, reason, administrator identity and request ID are required.';end if;
 perform pg_advisory_xact_lock(hashtextextended('operator:'||p_user::text,0));
 select * into previous from private.operation_audit where details->>'request_id'=p_request::text;
 if found then
  if previous.action<>(case when p_enabled then 'grant-operator' else 'revoke-operator' end) or previous.subject<>p_user::text or previous.details->>'reason'<>p_reason or previous.details->>'authority'<>p_authority then raise exception 'Operator request mismatch.';end if;
  return p_enabled;
 end if;
 if p_enabled then
  if not private.operator_identity_eligible(p_user) then raise exception 'Use an active account with a verified email.';end if;
  insert into private.operator_accounts(user_id) values(p_user) on conflict do nothing;
 else delete from private.operator_accounts where user_id=p_user;end if;
 insert into private.operation_audit(action,subject,details) values(case when p_enabled then 'grant-operator' else 'revoke-operator' end,p_user::text,jsonb_build_object('request_id',p_request,'reason',p_reason,'authority',p_authority));
 return p_enabled;
end$$;
revoke all on function public.set_operator_access(uuid,boolean,text,uuid,text) from public,anon,authenticated;
grant execute on function public.set_operator_access(uuid,boolean,text,uuid,text) to service_role;

alter function public.operate_case(uuid,uuid,text,text,integer,uuid) set schema private;
alter function private.operate_case(uuid,uuid,text,text,integer,uuid) rename to operate_case_before_sandbox;
revoke all on function private.operate_case_before_sandbox(uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function private.operate_case_before_sandbox(uuid,uuid,text,text,integer,uuid) to service_role;
create function public.operate_case(p_actor uuid,p_case uuid,p_action text,p_note text,p_amount integer default 0,p_request uuid default null) returns public.support_cases language plpgsql security invoker set search_path='' as $$
declare previous private.operation_audit;c public.support_cases;begin
 if p_actor is null or not public.operator_allowed(p_actor) or p_request is null or p_case is null or p_amount is null or p_amount<0 or length(btrim(coalesce(p_note,''))) not between 10 and 3000 then raise exception 'Authorized operator, explanation, amount and request ID required.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into previous from private.operation_audit where details->>'request_id'=p_request::text;
 if found then
  if previous.actor_id is distinct from p_actor or previous.action is distinct from p_action or previous.subject is distinct from p_case::text or previous.details->>'note' is distinct from p_note or previous.details->>'amount_cents' is distinct from p_amount::text then raise exception 'Operator decision request mismatch. Retry the original decision unchanged.';end if;
  select * into c from public.support_cases where id=p_case;return c;
 end if;
 return private.operate_case_before_sandbox(p_actor,p_case,p_action,p_note,p_amount,p_request);
end$$;
revoke all on function public.operate_case(uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.operate_case(uuid,uuid,text,text,integer,uuid) to service_role;
create function public.case_operation_history(p_case uuid) returns table(id bigint,actor_id uuid,action text,details jsonb,created_at timestamptz) language sql stable security invoker set search_path='' as $$select a.id,a.actor_id,a.action,a.details,a.created_at from private.operation_audit a where a.subject=p_case::text order by a.id desc limit 50;$$;
revoke all on function public.case_operation_history(uuid) from public,anon,authenticated;
grant execute on function public.case_operation_history(uuid) to service_role;

create index notifications_unread_user on public.notifications(user_id,id desc) where read_at is null;
create index notifications_history_user on public.notifications(user_id,id desc);
create function public.notification_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('unread',count(*) filter(where read_at is null),'latest_id',max(id)) from public.notifications where user_id=(select auth.uid()) and (select private.session_allowed());
$$;
revoke all on function public.notification_summary() from public,anon;
grant execute on function public.notification_summary() to authenticated,service_role;
alter publication supabase_realtime add table public.notifications;

-- Lease tokens fence late results. Backoff and a bounded attempt count retain failed jobs.
alter table private.notification_delivery add column lease_token uuid,add column lease_expires_at timestamptz,add column delivery_kind text check(delivery_kind in('sandbox','email'));
create index notification_delivery_ready on private.notification_delivery(next_attempt_at) where delivered_at is null;
drop function public.notification_batch();
drop function public.notification_result(bigint,boolean,text);
create function public.claim_notifications() returns table(id bigint,user_id uuid,lease_token uuid)
language plpgsql security invoker set search_path='' as $$begin
 return query with claimed as(select d.notification_id from private.notification_delivery d where d.delivered_at is null and d.next_attempt_at<=now() and d.attempts<12 and(d.lease_expires_at is null or d.lease_expires_at<=now()) order by d.next_attempt_at,d.notification_id limit 20 for update skip locked),updated as(update private.notification_delivery d set attempts=d.attempts+1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',next_attempt_at=now()+interval '2 minutes' from claimed c where d.notification_id=c.notification_id returning d.notification_id,d.lease_token)
 select n.id,n.user_id,u.lease_token from updated u join public.notifications n on n.id=u.notification_id;
end$$;
create function public.finish_notification(p_id bigint,p_lease uuid,p_sent boolean,p_kind text default null,p_error text default '') returns boolean
language plpgsql security invoker set search_path='' as $$begin
 if p_sent is null or p_sent and(p_kind is null or p_kind not in('sandbox','email')) then raise exception 'Invalid delivery result.';end if;
 update private.notification_delivery set delivered_at=case when p_sent then now() end,delivery_kind=case when p_sent then p_kind end,last_error=case when p_sent then null else left(p_error,200) end,
 next_attempt_at=now()+make_interval(secs=>least(86400,power(2,attempts)*60)::integer),lease_token=null,lease_expires_at=null
 where notification_id=p_id and lease_token=p_lease and lease_expires_at>now() and delivered_at is null;
 return found;
end$$;
create table private.notification_previews(notification_id bigint primary key references public.notifications(id) on delete cascade,user_id uuid not null,subject text not null,body text not null,created_at timestamptz not null default now());
alter table private.notification_previews enable row level security;
revoke all on private.notification_previews from public,anon,authenticated;grant all on private.notification_previews to service_role;
create function public.capture_notification(p_id bigint,p_lease uuid) returns boolean language plpgsql security invoker set search_path='' as $$begin
 perform 1 from private.notification_delivery where notification_id=p_id and lease_token=p_lease and lease_expires_at>now() and delivered_at is null for update;
 if not found then return false;end if;
 insert into private.notification_previews(notification_id,user_id,subject,body)
 select id,user_id,'Neighborhood Garage update','You have a rental or support update. Sign in at https://smkimbal.github.io/NeighborhoodGarage/#/support to review it.' from public.notifications where id=p_id on conflict do nothing;
 return public.finish_notification(p_id,p_lease,true,'sandbox');
end$$;
create function public.notification_delivery_status() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('pending',count(*) filter(where delivered_at is null and(attempts<12 or lease_expires_at>now())),'failed',count(*) filter(where delivered_at is null and attempts>=12 and(lease_expires_at is null or lease_expires_at<=now())),'captured',count(*) filter(where delivery_kind='sandbox'),'emailed',count(*) filter(where delivery_kind='email'),'failedJobs',(select coalesce(jsonb_agg(j),'[]') from(select notification_id,attempts,last_error from private.notification_delivery where delivered_at is null and attempts>=12 and(lease_expires_at is null or lease_expires_at<=now()) order by notification_id limit 20)j),'previews',(select coalesce(jsonb_agg(p),'[]') from(select notification_id,subject,body,created_at from private.notification_previews order by created_at desc,notification_id desc limit 20)p)) from private.notification_delivery;
$$;
create function public.retry_notification(p_actor uuid,p_id bigint,p_note text,p_request uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare previous private.operation_audit;begin
 if p_actor is null or not public.operator_allowed(p_actor) then raise exception 'Operator access required.';end if;
 if p_request is null or length(btrim(coalesce(p_note,''))) not between 10 and 1000 then raise exception 'Record a reason and request ID for this retry.';end if;
 perform pg_advisory_xact_lock(hashtextextended('notification:'||p_id::text,0));
 select * into previous from private.operation_audit where details->>'request_id'=p_request::text;
 if found then
  if previous.actor_id is distinct from p_actor or previous.action<>'retry-notification' or previous.subject<>p_id::text or previous.details->>'note'<>p_note then raise exception 'Notification retry mismatch.';end if;return true;
 end if;
 update private.notification_delivery set attempts=0,next_attempt_at=now(),last_error=null,lease_token=null,lease_expires_at=null where notification_id=p_id and delivered_at is null and attempts>=12 and(lease_expires_at is null or lease_expires_at<=now());
 if not found then raise exception 'Only failed, unleased notifications can be retried.';end if;
 insert into private.operation_audit(actor_id,action,subject,details) values(p_actor,'retry-notification',p_id::text,jsonb_build_object('request_id',p_request,'note',p_note));return true;
end$$;
revoke all on function public.claim_notifications(),public.finish_notification(bigint,uuid,boolean,text,text),public.capture_notification(bigint,uuid),public.notification_delivery_status(),public.retry_notification(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_notifications(),public.finish_notification(bigint,uuid,boolean,text,text),public.capture_notification(bigint,uuid),public.notification_delivery_status(),public.retry_notification(uuid,bigint,text,uuid) to service_role;

-- Explicit sandbox-only scheduler: reuses the existing Vault maintenance credential.
create function private.configure_sandbox_notifications() returns void language plpgsql security invoker set search_path='' as $$begin
 if not exists(select 1 from private.rental_maintenance_credentials where endpoint_url='https://ilfpugydxlzmmxjfrmrv.supabase.co/functions/v1/rental-maintenance') then raise exception 'Configure this sandbox maintenance endpoint first.';end if;
 perform cron.schedule('ng-notification-delivery','*/5 * * * *',$job$
 select net.http_post(url:='https://ilfpugydxlzmmxjfrmrv.supabase.co/functions/v1/notification-worker',headers:=jsonb_build_object('Content-Type','application/json','x-rental-maintenance-token',(select decrypted_secret from vault.decrypted_secrets where name='ng_rental_maintenance_token' limit 1)),body:='{}'::jsonb,timeout_milliseconds:=55000);
 $job$);
end$$;
revoke all on function private.configure_sandbox_notifications() from public,anon,authenticated,service_role;
create or replace function public.release_version() returns text language sql immutable set search_path='' as $$select '2026-10-05-sandbox-ops-1'::text;$$;
notify pgrst,'reload schema';
