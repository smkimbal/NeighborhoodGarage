> Garage photo viewing and free local label/barcode identification: [usage and verification](docs/LOCAL-PHOTO-SCAN.md).

# Production deployment

This branch is prepared for Cloudflare Pages at `https://neighborhoodgarage.net/`. Start with [the setup instructions](docs/CLOUDFLARE-SETUP.md). A separate production Supabase project and Cloudflare setup are still required. The test branch remains the GitHub Pages sandbox.

# Neighborhood Garage

Neighborhood Garage is a production-oriented peer-to-peer tool sharing web app backed by Supabase.

See the [latest walkthrough](docs/WALKTHROUGH.md), [validation results](docs/VALIDATION.md), the [restoration checkpoint](docs/CHECKPOINT.md), and [operations/setup](docs/OPERATIONS.md). Stripe sandbox credentials and Connect were configured during the September 29 verification. The combined Stripe Sync webhook is deployed; a complete rental-to-payout sandbox journey remains to be validated. Tool identification runs locally in the browser; external AI photo processing remains disabled. See [hosting readiness](docs/HOSTING.md).

## Live architecture

- **Frontend:** bundled, static mobile-first ES modules, deployable to GitHub Pages.
- **Auth:** Supabase Auth with email/password, email verification, password reset, persistent sessions, and optional TOTP MFA. During sandbox testing, users without a verified factor can continue at `aal1`; once a user enables a verified authenticator factor, RLS and Storage require an `aal2` session for that account.
- **Database:** Supabase Postgres with RLS on every exposed application table.
- **Storage:** private `tool-photos`, `return-photos`, and `avatars` buckets with user/participant policies.
- **Realtime:** Supabase Realtime for private messages and participant-scoped rental updates, including owner return-review prompts.
- **Payments:** Stripe Checkout created by the `create-checkout` Edge Function; Stripe webhooks finalize paid rentals.
- **Marketplace payouts:** Stripe Connect onboarding is handled by `connect-account`. Owner proceeds are held on the platform and transferred only after the owner approves the returned tool.
- **Privileged rental transitions:** `rental-action` validates renter/owner identity before pickup, return, approval, dispute, owner payout, and deposit-credit issuance.
- **Credits:** append-only `credit_ledger`; approved deposits become Tool Share Credits.

There is no Demo Mode, fake checkout, seeded marketplace inventory, localStorage wallet, or simulated account system.

## Supabase project

Project ref: `ilfpugydxlzmmxjfrmrv`

The browser uses only the project URL, publishable key, and canonical public Auth callback in `config.js`. Those values are intentionally public. Never place Supabase secret keys, Stripe secret keys, or webhook secrets in `config.js` or any GitHub Pages asset.

## Required Stripe configuration

The deployed payment functions fail closed until real Stripe credentials are configured in Supabase Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` only for standalone webhook verification; the installed Stripe Sync integration uses its managed signing secret.

Configure a Stripe webhook endpoint for:

`https://ilfpugydxlzmmxjfrmrv.supabase.co/functions/v1/stripe-webhook`

Subscribe at minimum to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`

No payment secrets are committed to this repository.

## Run locally

```sh
npm ci
npm run dev
# http://localhost:5173
# Edge Functions also allow http://localhost:3000 for the current preview workflow
npm test
npm run check:edge
npm run build
```

## Security model

All application tables have RLS enabled. Direct browser writes are intentionally limited:

- users can update only their profile;
- owners can manage only their tools;
- rental participants can read only rentals they participate in;
- users can read only their credit ledger;
- message participants can read their conversations and users can only send as themselves;
- only the renter of a completed rental can create its review;
- payment events have no client-access policy;
- rental creation and status/credit mutations happen in authenticated Edge Functions using server-side credentials.

Storage upload paths begin with the authenticated user's UUID. Return-image reads are limited to the uploader or participants in the rental referencing that object. Referenced evidence cannot be deleted by the uploader.

## Production checklist

1. Preserve the configured sandbox credentials and combined Stripe Sync webhook. The currently connected Stripe account is a **sandbox**; use a separate production database/project and live keys before accepting real customer payments. Set `STRIPE_MODE=live` only in that production environment; sandbox account and payment IDs cannot be reused.
2. Set Supabase Auth **Site URL** to `https://smkimbal.github.io/NeighborhoodGarage/` and add that same URL to **Redirect URLs**. Local preview URLs (`http://localhost:5173` and/or `http://localhost:3000`) may remain allowlisted for development, but signup confirmation and password recovery intentionally use the canonical public callback.
3. Configure a custom SMTP provider before meaningful public traffic; Supabase's default mail service is intended for development/testing.
4. Enable CAPTCHA/bot protection for signup and password reset before public launch.
5. Add legal terms, privacy policy, cancellation/refund rules, support/dispute administration, and any real insurance terms before representing coverage to users.
6. Complete the Stripe Connect platform profile/liability setup and test connected-account onboarding, payment, return approval, transfer, payout, refund, and dispute scenarios end-to-end in Stripe sandbox before moving to live mode.

## Schema

The checked-in migrations under `supabase/migrations/` mirror the live project schema and policies used by this branch.
