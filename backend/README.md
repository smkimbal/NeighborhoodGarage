# Neighborhood Garage live backend

This directory now contains two layers:

1. A **runnable local prototype** using Node's built-in HTTP server and `node:sqlite` (`server.mjs`, `db.mjs`, `schema.sqlite.sql`).
2. A **hosted-production migration scaffold** (`schema.sql`) intended for PostgreSQL/Supabase or a comparable managed database.

## Local security model

- Account identifiers are normalized and stored as a one-way lookup hash plus an AES-256-GCM encrypted copy for provider delivery.
- Passwords are scrypt-hashed with per-user random salts.
- Six-digit verification codes are generated with cryptographic randomness, HMAC-hashed, expire after 10 minutes, and lock after repeated failures.
- Contact verification creates only a limited `verified` session.
- TOTP setup must succeed before that session is upgraded to `full`.
- Login requires password first, then a short-lived TOTP challenge.
- Session cookies are HttpOnly and the database stores only SHA-256 token hashes.
- State-changing requests require the `X-NG-Request: web` header. CORS is restricted to `NG_ALLOWED_ORIGINS`.
- Profile private fields, TOTP secrets, return photos, and message bodies are encrypted with AES-256-GCM.
- Credit balances are derived from an append-only ledger rather than accepted from the browser.
- Rental prices, deposit amounts, owner identity, tool availability, refund eligibility, and owner approval are computed/authorized server-side.
- A unique active-rental index protects against double-booking and a unique deposit-refund ledger key protects against duplicate refunds.

## Provider adapters

### Verification

- Email: Resend (`RESEND_API_KEY`, `RESEND_FROM`)
- SMS: Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`)
- Local fallback: logs and returns the verification code only outside production.

### AI image analysis

Set `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-5.6-luna` and can be changed without code changes. The API key remains server-side. The model result is treated as advisory: the owner must review listing fields and return approval remains a human decision.

### Payments

Set `STRIPE_SECRET_KEY`. The adapter creates/confirms a PaymentIntent only when a development payment method is also supplied through `STRIPE_TEST_PAYMENT_METHOD`. This is intentionally not the final production checkout UX. Replace it with Stripe-hosted/client collection plus verified webhooks before public launch.

Without Stripe credentials, non-production mode produces a clearly marked simulated payment reference so the complete local lifecycle can be tested safely.

## Local data

By default, SQLite data is written under `backend/data/`, which is gitignored. The seed catalog creates six non-login demo neighbors so a newly verified live account has tools to browse immediately.

## API surface

- `GET /health`
- `POST /auth/signup`
- `POST /auth/resend`
- `POST /auth/verify`
- `POST /auth/2fa/setup`
- `POST /auth/2fa/enable`
- `POST /auth/login`
- `POST /auth/login/2fa`
- `POST /auth/logout`
- `GET /profile`
- `PUT /profile`
- `GET /state`
- `POST /tools`
- `POST /scans`
- `POST /rentals`
- `POST /rentals/:id/pickup`
- `POST /rentals/:id/return`
- `POST /rentals/:id/approve`
- `POST /rentals/:id/dispute`
- `POST /rentals/:id/reviews`
- `POST /messages`

## Supabase migration direction

Use Supabase Auth rather than duplicating password/session storage once the project moves to hosted infrastructure. Move private photos to private Storage buckets and return only short-lived signed URLs. Keep pricing, credits, payment callbacks, AI provider calls, and owner approval in trusted server/Edge Function code. Apply RLS to every exposed table and create participant/owner policies deliberately; do not expose a service-role key in the frontend.

The included PostgreSQL schema is intentionally deny-by-default and does not claim to be a finished Supabase migration. Generate/review the actual migration after a Supabase project exists so Auth IDs, grants, Storage policies, Realtime publication, and current project settings can be tested against that project.
