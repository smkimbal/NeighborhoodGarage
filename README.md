# Neighborhood Garage

Neighborhood Garage is a mobile-first peer-to-peer tool-sharing prototype. This revision keeps the original Demo Mode and adds a runnable local backend for real account onboarding, persistent user data, two-factor authentication, server-authoritative rentals/credits, encrypted private fields/messages, and provider adapters for email/SMS verification, AI photo analysis, and Stripe.

## What works now

- Demo Mode still runs entirely in the browser for quick UI exploration.
- Live Mode uses the local API at `http://localhost:8787` when the site is opened from localhost.
- Signup supports email or phone verification.
- Verification must complete before TOTP two-factor setup.
- TOTP must be enabled before profile creation and marketplace actions.
- Sessions use HttpOnly cookies; session tokens are stored only as hashes server-side.
- Passwords use Node's scrypt implementation with per-user salts.
- Private profile fields, TOTP secrets, return photos, and message bodies use AES-256-GCM encryption at rest in the local SQLite prototype.
- Listings, rentals, checkout math, credits, return approval, reviews, and messaging are enforced by the server rather than trusted from browser state.
- Email verification can use Resend; SMS can use Twilio. With no provider keys in local development, the code is printed to the API console and returned to the local UI.
- AI photo analysis can use the OpenAI Responses API when `OPENAI_API_KEY` is configured. Without a key, local development returns an explicit development-only result.
- Stripe has a server-side PaymentIntent adapter. Without a Stripe key, local development uses a clearly marked simulated payment. A proper hosted/client payment-method flow is still required before production use.
- PostgreSQL/Supabase-oriented schema scaffold remains in `backend/schema.sql`; the runnable local prototype uses `backend/schema.sqlite.sql`.

## Run locally

Requires Node 22.5+ and Python 3.

```sh
npm run dev
# Web: http://localhost:5173
# API: http://localhost:8787
```

The first Live Mode account can use the verification code shown in the local API terminal. Use any TOTP-compatible authenticator for the 2FA step.

To configure real providers, copy `.env.example` to your preferred local environment loader or export the variables before starting. This project intentionally has no runtime npm dependencies.

## Verify

```sh
npm test
npm run build
```

`npm test` covers the original demo lifecycle plus a live API path for signup → verification → TOTP → profile → listing → rental → pickup → return → owner approval → credit refund → review → encrypted chat.

`tests/browser-smoke.cjs` is retained for browser-level verification and requires Playwright/Chromium to be installed separately:

```sh
npm run dev
npm run test:browser
```

## Deployment split

GitHub Pages can host only the static `dist/` frontend. The backend must run on a server/runtime that can keep secrets and persistent storage. For early hosted prototyping, Supabase remains the recommended next step because it provides Postgres, Auth, Storage, Realtime, and a Free plan; the production migration should explicitly configure grants/RLS and private Storage rather than exposing tables or service-role keys to the browser.

Before a public launch, add a real payment collection UI/hosted checkout, payment webhooks and reconciliation, private object storage with signed URLs, provider-managed email/SMS limits, production KMS/secret management, support/dispute administration, legal/insurance terms, monitoring/backups, abuse controls, and a security review.

## Important security notes

- Never place API, database service-role, Stripe secret, OpenAI, Twilio, or Resend keys in `config.js` or any file served by GitHub Pages.
- `NG_MASTER_KEY` is required in production. Without it, local development intentionally falls back to a known development-only key.
- The local SQLite backend is for prototyping. It is not a replacement for managed backups, high availability, production audit logging, or a reviewed authorization model.
- The browser compresses/re-encodes uploaded images before sending them, which strips normal EXIF metadata, but production object ingestion should still validate decoded file types and strip metadata server-side.
- Deposits are not automatically refunded as cash in this design; owner-approved deposits are credited to the user's internal Tool Share Credits ledger. Disputes keep the deposit held for support review.
