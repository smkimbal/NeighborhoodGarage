-- A fixed-name secret lookup: no client role can read webhook credentials.
create function public.stripe_webhook_signing_secret() returns text language plpgsql
 security definer set search_path='' as $$declare signing_secret text;begin
 select decrypted_secret into signing_secret from vault.decrypted_secrets
 where name='ng_stripe_webhook_signing_secret' limit 1;return signing_secret;
end$$;
revoke all on function public.stripe_webhook_signing_secret() from public,anon,authenticated;
grant execute on function public.stripe_webhook_signing_secret() to service_role;
notify pgrst,'reload schema';
