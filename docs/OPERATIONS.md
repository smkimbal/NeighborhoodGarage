> Latest sandbox access and delivery checkpoint: [SANDBOX-OPERATIONS.md](SANDBOX-OPERATIONS.md).

> Current hardening release status and activation requirements: [RELEASE-CONTROLS.md](RELEASE-CONTROLS.md).

# Supabase + Stripe + AI operations

The default frontend configuration targets the sandbox. Cloudflare production builds explicitly generate their separate public configuration. Secrets belong in Supabase Edge Function secrets, never in GitHub Pages assets.

## Environment

- `STRIPE_SECRET_KEY`: sandbox `rk_test_…` with the required Connect, Checkout, PaymentIntent, and Transfer permissions (or a sandbox secret key during initial setup).
- `STRIPE_MODE`: `sandbox` by default. Live keys are rejected until explicitly set to `live`.
- `STRIPE_WEBHOOK_SECRET`: signing secret for this project's endpoint, matching the sandbox; production can also read its endpoint-specific signing secret from Supabase Vault.
- `NG_CREDIT_FUNDING_APPROVED`: set to `true` in live mode only after Stripe approves the prepaid-credit and withdrawal model. The current sandbox needs no live-approval flag.
- Supabase supplies its URL and credentials; both legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` and newer `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` JSON maps are supported.

Reconcile the intended project’s migration names/timestamps before applying reviewed migrations; do not blindly run `db push` against these existing projects. Deploy functions with `npx supabase functions deploy <name> --no-verify-jwt`. Every user-facing function validates its bearer token with Auth `getUser` and enforces enrolled MFA itself; the webhook validates Stripe's signature. The gateway flag alone is not the authentication mechanism.

Functions: `connect-account`, `create-checkout`, `credit-funding`, `rental-action`, `rental-booking`, `rental-maintenance`, `withdraw-credits`, `delete-account`, `stripe-webhook`, `mfa-recovery`, `support`, `upload-photo`, `notification-worker`.

## Stripe sandbox

Enable Connect in the same Stripe sandbox as the server key. New owners use Accounts v2 recipient accounts and Stripe-hosted onboarding. Never mark onboarding complete from a redirect alone: the server re-reads the transfer capability. Onboarding links are single-use; expired links return through the refresh handler.

Register `https://zbbespojxxoheavodtqs.supabase.co/functions/v1/stripe-webhook` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `charge.dispute.funds_withdrawn`
- `charge.dispute.funds_reinstated`

A card checkout is a **charge**, including a refundable deposit, not a card authorization hold or regulated escrow service. Credit reservation and release are atomic. Released deposits, earnings and verified funding become Tool Share Credits. Any user can request a credit withdrawal after completing Stripe Connect bank/payout setup. Pending transfers reserve credits and can be retried with the same request ID. See [credit funding and reputation](CREDITS-AND-REPUTATION.md) for the ledger, chargeback handling and live funding gate. Maintain enough platform balance to fund transfers for credit-funded loans. A 5% marketplace fee does not guarantee profitability after Stripe fees.

Do not simply replace sandbox keys in a database containing sandbox account and payment IDs. Before launch, use a separate production Supabase/Stripe environment, register its webhook, onboard owners again, and reconcile balances. Configure durable payout jobs/reconciliation, disputes/refunds, retention, email delivery, abuse controls, and applicable payment/insurance arrangements. The prototype makes no insurance-coverage promise.

## Data and access

Private chats use participant RLS and TLS; they are not end-to-end encrypted. Photo buckets are private with short-lived signed URLs. Tool coordinates are rounded to two decimal places; actual pickup addresses belong in private chat. Original listing photos are immutable evidence while in use. AI-edited catalog images never replace those originals. AI cannot determine hidden mechanical safety or finalize a damage claim.

MFA stays optional in the sandbox but is enforced by RLS and Edge Functions for users who enable it. Enable Supabase leaked-password protection if the plan supports it. Enable email confirmation, set the Site URL and allowed redirect URL to `https://smkimbal.github.io/NeighborhoodGarage/`, and configure production SMTP before public signup.

## Local and GitHub Pages

Run `npm ci`, `npm test`, `npm run check:edge`, `npm run dev`. Local static preview: `http://localhost:5173`. `npm run build` bundles pinned dependencies into `dist` without copying generated assets into source control; sandbox Pages publishes the built Actions artifact; there is no browser CDN dependency for the Supabase client. Map tiles require access to OpenStreetMap. Respect its tile usage policy and move to a suitable tile provider as traffic grows.

The Pages workflow targets `neighborhood-garage-test`, validates Node 22/24 and publishes the `dist` Actions artifact only after those checks. Generated root assets have been retired. Pages must use GitHub Actions as its source, and its environment must allow that existing branch. Missing settings retain the validated artifact and explicitly skip hosting; see SANDBOX-OPERATIONS.md.

### Complete the remaining project settings

1. In Stripe Dashboard, select the intended sandbox and obtain its secret or appropriately restricted server key. In the Supabase project's Edge Function secrets, set `STRIPE_SECRET_KEY` to that sandbox key and `STRIPE_MODE` to `sandbox`. Do not put the key in `config.js`, GitHub Actions, or chat.
2. Register the Stripe sandbox webhook against `https://zbbespojxxoheavodtqs.supabase.co/functions/v1/stripe-webhook`, select the events listed above, and set its signing secret as `STRIPE_WEBHOOK_SECRET` in the same Supabase project.
3. In Supabase Dashboard Authentication settings, enable leaked password protection if available. Re-run Security Advisor. An Auth config warning cannot be cleared by a SQL migration.
4. Verify Connect onboarding, a sandbox checkout and webhook, then owner payout before opening reservations to users. The current Edge function returns a specific `stripe_not_configured` error until setup succeeds.

### Stripe Sync and app fulfillment (2026-09-29)

The sandbox key is accepted for account `acct_1UKqGKRsHH5z9atP`, and Connect has been enabled on that sandbox. Supabase Stripe Sync installs its own `stripe-webhook` function. Our combined handler preserves Sync signature verification and database synchronization, then invokes the application's idempotent `finish_payment` transaction for rental Checkout events. Reinstalling Stripe Sync may overwrite this handler; redeploy the repository's combined `stripe-webhook` after an integration reinstall.

When Stripe Sync is installed, its managed signing secret is kept in its backend metadata, and the combined handler uses Sync's signature verification. Do not copy that secret into the frontend. The standalone fallback uses `STRIPE_WEBHOOK_SECRET` when no Sync database connection is provided.
