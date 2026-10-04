> Historical checkpoint. This records its original release only; it does not validate the October 4 hardening changes. See [HARDENING-CHECKPOINT.md](HARDENING-CHECKPOINT.md).

# Production verification — October 1, 2026

> Later deployment correction: Cloudflare's latest supplied log passed 17 tests and all Edge Function checks, then failed only on the required backend-readiness flag. The flag is now advisory so the frontend can be deployed for real-domain verification. The Workers asset-directory fix remains in place. This change does not establish email delivery or webhook readiness and does not change Stripe payment mode.

Project: `zbbespojxxoheavodtqs`. Stripe account: Neighborhood Garage sandbox (`acct_1UKqGKRsHH5z9atP`), test mode only. No real-money charge or bank transfer was made.

## Verified against actual services

- Supabase's default verification redirect is now `https://neighborhoodgarage.net`, not localhost. An intentionally invalid verification token returned to that origin with the expected expired-token error. This verifies redirect configuration, not inbox delivery or a valid email confirmation journey.
- Two disposable, preverified QA Auth fixtures signed in and created their profiles through the real API. Owner listing creation also succeeded. Fixtures intentionally bypassed email delivery; this was not a new-user inbox test.
- The deployed `create-checkout` function used the configured Stripe key to create a $3 USD Checkout Session. Stripe-hosted Checkout accepted its standard test card. Stripe API confirmed `status=complete`, `payment_status=paid`, `livemode=false`.
- PaymentIntent: `pi_3ULkJoRsHH5z9atP0a7r9NBX`.
- First rental: `3945b2ff-9ade-4251-b4f1-c86d9b73f8c3`, $1 rental + $2 deposit.
- **Missing configuration found:** Stripe's endpoint list contains only the old sandbox Supabase webhook, not a webhook for the production project. The new rental therefore remained pending despite Stripe being paid.
- Added authenticated `sync-payment` recovery: retrieve the rental's stored Checkout Session directly from Stripe, verify project/rental IDs, environment, paid status and client reference, then invoke the existing amount/currency-checked idempotent settlement RPC. Never trust the return URL to mark a rental paid. The UI now offers **Check payment status** for pending rentals.
- That recovery confirmed the first rental. Actual API pickup, private return-photo upload, return submission, owner approval and approval replay all succeeded. Renter received $2 credits; owner received $0.95 credits with no external transfer.
- Second rental: `b1f033bc-1501-4049-982e-a9f543babe57`, $1 rental + $1 deposit, paid entirely using those $2 credits. `amount_due_cents=0`, no Checkout Session, no Checkout URL. Pickup/return/approval completed again.
- Before cleanup, balances were exactly renter $1.00 and owner $1.90. Two $0.05 platform fees account for the difference; internal reuse created no new Stripe transaction or transfer.
- Both disposable QA accounts were removed through the actual account-deletion endpoint, which also removed their listing, photos and unused test credits. Settled anonymized receipts and Stripe's sandbox transaction remain as audit evidence.

## Build and local checks

- Branch inventory contains `package-lock.json` and no `bun.lock` or `bun.lockb`.
- Added explicit `packageManager: npm@10.9.2` and `.node-version` (22). Keep Cloudflare's build command beginning with `npm ci` and set `SKIP_DEPENDENCY_INSTALL=true` in its **build environment** to bypass automatic Bun selection. Clear build cache and confirm branch `production` and repository root.
- A clean npm dependency install succeeded (243 packages), and the production bundle built with the real public Supabase configuration. The original build used a local readiness override. After the later deployment correction, a fresh build with the flag unset passed, as did Wrangler's deployment dry run using only dist-production. The output uses the intended project/domain and contains only public configuration; asset sizes are below 25 MiB.
- 18 unit/service tests pass, including payment recovery and rejection of another project's paid session. All Edge Functions type-check.
- The local browser walkthrough could not run: the available Chromium binary crashed, and the official replacement download arrived invalid/truncated. This is an execution-environment limitation, not a passing UI test. The hosted Stripe form was tested separately through the cloud browser.
- Stripe's return navigation could not be inspected: the cloud browser rejected the destination after checkout. Payment success was independently verified using Stripe's API.
- Cloudflare's exact Bun failure is **not verified fixed on Cloudflare** without its build log/dashboard access. The repository and instructions now explicitly select npm; if it still mentions Bun, check the branch, root and build settings and provide the log.

## Required next setup

Created Stripe sandbox webhook `we_1ULkQ8RsHH5z9atPufFnwB0d` for:

`https://zbbespojxxoheavodtqs.supabase.co/functions/v1/stripe-webhook`

It subscribes to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. In Stripe Workbench → Webhooks, open this endpoint and reveal its signing secret. Store that endpoint's signing secret in the production Supabase project's Edge Function secrets as **STRIPE_WEBHOOK_SECRET**. This differs from STRIPE_SECRET_KEY. Do not put either secret in GitHub or chat. The connector cannot set Supabase secrets.

Keep `STRIPE_MODE=sandbox`. The payment-status recovery is resilience for delayed events, not a replacement for webhooks. Deploy the site for testing, then verify webhook delivery and a real signup email before accepting customers. Setting the optional backend-readiness flag only suppresses the build reminder.
