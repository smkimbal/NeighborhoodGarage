> Updated October 1: Auth redirect and Stripe test key verified; actual Stripe and internal-credit rental tests completed. The production webhook was created; its signing secret still needs configuration. Frontend deployment now proceeds without a backend-readiness flag so real-domain testing can be completed. See [the current verification report](VERIFICATION-2026-10-01.md); the setup checklist below is historical where superseded.

# Production backend checkpoint — 2026-09-30

Created in the existing **Neighborhood Garage** Free organization with a quoted project cost of **$0/month**:

- Name: Neighborhood Garage Production
- Project ref: `zbbespojxxoheavodtqs`
- Region: `us-east-1`
- URL: `https://zbbespojxxoheavodtqs.supabase.co`
- Public key: `sb_publishable_f0Tc0Qz4sWlCRaT58d2qlA_ZKRi-7Ot`
- Existing sandbox `ilfpugydxlzmmxjfrmrv` is unchanged.

## Not ready for public launch

All 14 migrations are installed, including the internal wallet migration. The user explicitly approved optional MFA (required once enrolled) and listing before Stripe payout setup. These approvals resolved the earlier automatic-review block.

All nine Edge Functions are deployed. Endpoints validate user tokens in their handlers; the webhook validates Stripe signatures. The production project automatically selects the exact neighborhoodgarage.net CORS allowlist. Sandbox origins are not added to it.

## Remaining provider settings

The Supabase connector does not expose an Auth configuration or secrets setter. Complete these in the **new production project**, not the original sandbox:

1. Auth → URL Configuration: set Site URL and allowed redirect URL to `https://neighborhoodgarage.net/`. Configure/verify email delivery. Do not retain localhost as the default callback.
2. Edge Functions → Secrets: set `STRIPE_MODE=sandbox` and a Stripe **test** API key as `STRIPE_SECRET_KEY` (test restricted key with required Checkout, Accounts v2, Connect/transfer permissions, or the existing sandbox key). Never put it in GitHub or frontend config.
3. In that Stripe sandbox, add a webhook destination `https://zbbespojxxoheavodtqs.supabase.co/functions/v1/stripe-webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Store its signing secret as `STRIPE_WEBHOOK_SECRET` in this Supabase project.
4. Leave Stripe Sync disabled here unless it is separately installed and configured. The production handler uses the explicit webhook signing secret; the original sandbox's managed Stripe Sync behavior is preserved.
5. Deploy the frontend and run real-domain signup/verification/reset and the full sandbox Connect → payment → return → owner credit → withdrawal journey. Cloudflare builds without `NG_PRODUCTION_BACKEND_READY`; it prints an advisory reminder until verification is acknowledged. Keep Stripe in sandbox and complete these checks before accepting customers.

No live Stripe key, real-money charge or bank withdrawal has been enabled. No Stripe sandbox credentials were copied from another project. Public Supabase configuration is already in the production branch.

Migration history was installed through the connector, which assigns remote timestamps. Before using CLI `db push` against this project, reconcile history by migration name/content; do not blindly reapply the initial schema under its older local filename timestamps.

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

- 17 Node tests pass, including no-Stripe credit checkout, no automatic owner transfer, duplicate withdrawal retry, and expired-idempotency protection.
- All Edge Functions pass Deno type checks.
- Database contract, wallet contract, community-access and account-deletion SQL suites passed on the new project. Fixtures rolled back; verified zero users, ledger entries and withdrawals remain.
- Wallet database assertions cover owner credit exactly once, full-credit checkout without owner Stripe setup, withdrawal replay, overdraft rejection, pending-withdrawal deletion blocking, service-only mutation RPC and per-user read isolation.
- No actual Stripe transaction or browser withdrawal journey has run against this new project yet. These require the settings above; the previous sandbox payment test is not proof of production-project integration.
- Security advisor reports the known authenticated SECURITY DEFINER reputation aggregate. Its bounded input and no-anonymous access were verified by the community suite. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
