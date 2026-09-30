# Production backend checkpoint — 2026-09-30

Created in the existing **Neighborhood Garage** Free organization with a quoted project cost of **$0/month**:

- Name: Neighborhood Garage Production
- Project ref: `zbbespojxxoheavodtqs`
- Region: `us-east-1`
- URL: `https://zbbespojxxoheavodtqs.supabase.co`
- Public key: `sb_publishable_f0Tc0Qz4sWlCRaT58d2qlA_ZKRi-7Ot`
- Existing sandbox `ilfpugydxlzmmxjfrmrv` is unchanged.

## Not ready for public launch

Only the first five existing migrations have been applied. Automatic approval review rejected `make_mfa_optional_for_sandbox` and `restore_community_secure_checkout`: they change production security to optional MFA and allow listing before payout setup. No workaround was applied. Production retains the previously installed mandatory MFA policies. Remaining migrations, including the new wallet migration, are **not deployed or database-tested** yet. The existing frontend's optional MFA flow is not compatible with the currently partial schema/policies.

User decision is required before continuing those migrations: authorize the existing optional-MFA policy (MFA enforced once enrolled) and listings before Stripe setup, or retain mandatory production MFA and implement mandatory enrollment plus compatible migrations instead.

No production Edge Functions or Stripe configuration have been deployed in this checkpoint. The connector does not expose an Auth configuration or secrets setter. Production Auth Site URL/redirect allowlist still need `https://neighborhoodgarage.net/`, and Stripe test credentials/webhook configuration remain pending. Do not use the default localhost email callback. Use test keys only; do not copy or expose service-role/Stripe secrets into the frontend.

`config.js` and the Cloudflare build now identify the new production project. `build:cloudflare` intentionally refuses to publish until `NG_PRODUCTION_BACKEND_READY=true` is explicitly set **after** the above work and acceptance tests pass. Do not set it just to silence a failed build. The production build was verified locally; that is not a live backend acceptance test.

## Wallet changes prepared in this branch

- Full-credit reservations return before initializing Stripe; they incur no Stripe payment transaction.
- Partial-credit reservations charge only the remaining new-money amount. The existing USD minimum may leave some credits unused to keep the external payment at least $0.50.
- Approval returns the deposit and credits net owner earnings once. The existing 5% platform fee remains; it is not a Stripe fee.
- New owner earnings use `payout_status=credited`; no automatic external transfer runs on approval. Existing pending legacy payouts are not backfilled into credits (avoids double payment).
- An explicit sandbox withdrawal reserves credits under the same account lock used for checkout. Only service-role functions can mutate wallet balances; users can read only their own transfer history.
- Withdrawals require completed Stripe Connect setup. They move funds to the connected Stripe balance, not directly to a guaranteed bank settlement.
- A failed/ambiguous transfer retains its hold. Retry reuses the same request/transfer group/idempotency key. Requests older than 23 hours can reconcile an existing transfer but cannot create a new one without operator review. There is no unsafe automatic recredit on timeout.
- No extra Stripe fee is added to internal spending. Actual Stripe processing/Connect/bank payout fees depend on the account agreement and external transaction. This app currently absorbs those provider costs rather than computing a customer surcharge. Platform reserve sufficiency must be verified before real-money operation.

## Validation

Node tests cover no-Stripe credit checkout, no automatic owner transfer, duplicate withdrawal retry, and expired-idempotency protection. Edge Functions pass Deno type checking. SQL contract tests have been updated for internal owner earnings but **cannot be run on this incomplete production schema yet**. New wallet functionality remains undeployed. Provider end-to-end tests, database concurrency/RLS tests and the browser withdrawal journey remain required before setting backend readiness.
