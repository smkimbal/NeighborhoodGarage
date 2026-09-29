# Neighborhood Garage

Neighborhood Garage is a production-oriented peer-to-peer tool sharing web app backed by Supabase.

## Live architecture

- **Frontend:** static mobile-first ES modules, deployable to GitHub Pages.
- **Auth:** Supabase Auth with email/password, email verification, password reset, persistent sessions, and optional TOTP MFA. When a user enrolls MFA, RLS requires an `aal2` session for application tables.
- **Database:** Supabase Postgres with RLS on every exposed application table.
- **Storage:** private `tool-photos`, `return-photos`, and `avatars` buckets with user/participant policies.
- **Realtime:** Supabase Realtime for message inserts.
- **Payments:** Stripe Checkout created by the `create-checkout` Edge Function; Stripe webhooks finalize paid rentals.
- **Privileged rental transitions:** `rental-action` Edge Function validates renter/owner identity before pickup, return, approval, dispute, and deposit-credit issuance.
- **Credits:** append-only `credit_ledger`; approved deposits become Tool Share Credits.

There is no Demo Mode, fake checkout, seeded marketplace inventory, localStorage wallet, or simulated account system.

## Supabase project

Project ref: `ilfpugydxlzmmxjfrmrv`

The browser uses only the project URL and publishable key in `config.js`. Those values are intentionally public. Never place Supabase secret keys, Stripe secret keys, or webhook secrets in `config.js` or any GitHub Pages asset.

## Required Stripe configuration

The deployed payment functions fail closed until real Stripe credentials are configured in Supabase Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Configure a Stripe webhook endpoint for:

`https://ilfpugydxlzmmxjfrmrv.supabase.co/functions/v1/stripe-webhook`

Subscribe at minimum to:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`

No payment secrets are committed to this repository.

## Run locally

```sh
npm run dev
# http://localhost:5173
npm test
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

Storage upload paths begin with the authenticated user's UUID. Return-image reads are limited to participants in the rental referencing that object.

## Production checklist

1. Connect/configure Stripe and set the two Edge Function secrets above.
2. Configure Auth redirect URLs for the GitHub Pages production URL and local development URL.
3. Configure a custom SMTP provider before meaningful public traffic; Supabase's default mail service is intended for development/testing.
4. Enable CAPTCHA/bot protection for signup and password reset before public launch.
5. Add legal terms, privacy policy, cancellation/refund rules, support/dispute administration, and any real insurance terms before representing coverage to users.
6. For a true marketplace payout model, add Stripe Connect onboarding and owner payouts. Current checkout collects payment to the platform account; owner payout accounting is not yet automated.

## Schema

The checked-in migration under `supabase/migrations/` mirrors the live project schema and policies used by this branch.
