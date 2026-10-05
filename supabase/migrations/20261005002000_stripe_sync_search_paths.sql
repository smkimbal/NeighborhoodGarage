-- Keep the installed Stripe Sync integration; harden only its known helpers.
-- Older deployments and the local database may not have the optional schema.
do $$begin
 if to_regprocedure('stripe.set_updated_at()') is not null then
  alter function stripe.set_updated_at() set search_path=pg_catalog;
 end if;
 if to_regprocedure('stripe.set_updated_at_metadata()') is not null then
  alter function stripe.set_updated_at_metadata() set search_path=pg_catalog;
 end if;
 if to_regprocedure('stripe.check_rate_limit(text,integer,integer)') is not null then
  alter function stripe.check_rate_limit(text,integer,integer) set search_path=pg_catalog;
 end if;
end$$;
