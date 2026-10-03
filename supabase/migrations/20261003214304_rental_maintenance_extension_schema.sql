-- Install pg_net in an explicit schema with the hardened empty search path.
create or replace function private.configure_rental_maintenance(p_project_url text) returns void language plpgsql security invoker set search_path='' as $$declare token text;begin
 if p_project_url !~ '^https://[a-z0-9]{20}[.]supabase[.]co$' then raise exception 'Use this project Supabase API origin.';end if;
 if not exists(select 1 from pg_extension where extname='supabase_vault') or not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Vault and Cron are required.';end if;
 execute 'create extension if not exists pg_net with schema extensions';
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
