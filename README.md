# Neighborhood Garage

A neighborhood tool-sharing application hosted at [neighborhoodgarage.net](https://neighborhoodgarage.net/), with Supabase accounts, private messaging and Stripe sandbox payments.

## Production and sandbox

| Environment | Source branch | Website | Supabase project |
| --- | --- | --- | --- |
| Production application; payments remain sandbox | `main` | https://neighborhoodgarage.net/ | `zbbespojxxoheavodtqs` |
| Experimentation sandbox | `neighborhood-garage-test` | https://smkimbal.github.io/NeighborhoodGarage/ | `ilfpugydxlzmmxjfrmrv` |

Cloudflare builds and hosts the production application. GitHub holds its source and validation checks; GitHub Pages hosts only the separate sandbox. Preserve the current branch arrangement.

See [Cloudflare setup](docs/CLOUDFLARE-SETUP.md), [release controls](docs/RELEASE-CONTROLS.md), [hardening validation](docs/HARDENING-VALIDATION.md), and the [October 5 continuation checkpoint](docs/CONTINUATION-CHECKPOINT-2026-10-05.md). Historical verification reports cover their original releases.

## User workflow

- Create an account, confirm the email, complete a profile and optionally enroll authenticator MFA. Once enrolled, MFA is required for protected account, database and storage access.
- Browse nearby tools in a list or map, read reviews and earned badges, and coordinate privately with the owner.
- Request today’s or a future reservation with pickup and return windows. The owner approves before the renter schedules pickup and pays.
- Use the permanent item website QR for pickup and return confirmations. Private agreed locations include Google Maps and Apple Maps directions.
- Return with a condition photo. The owner confirms receipt, inspects the item, approves the deposit or documents a deduction. Inspection holds retain clear next actions; physical corrections and disputes have an audit history.
- Owners see requested and confirmed bookings on the garage timeline. Currently rented tools remain discoverable with their expected return.
- Tap or click a centered tool preview for listing details and the full-image viewer. Local identification uses free browser classification, OCR and barcode decoding; suggestions require review.

Details: [rental workflow](docs/RENTAL-WORKFLOW.md), [free local photo identification](docs/LOCAL-PHOTO-SCAN.md), [credits and reputation](docs/CREDITS-AND-REPUTATION.md).

## Backend and money

The static ES-module frontend calls authenticated Supabase Edge Functions. PostgreSQL RLS restricts private profiles, rentals, messages, ledgers and evidence. Photos use private storage and the validated upload endpoint; realtime subscriptions retain participant access controls.

Tool Share Credits fund rentals and extensions without a new Stripe transaction when they cover the full amount. Partial payments send only the remaining new-money principal and its disclosed sandbox processing fee to Stripe Checkout. Processing fees never become spendable credits. The 5% rental platform fee is separate.

Approved deposits and net owner earnings stay in the internal ledger. Approval does **not** automatically transfer owner funds to Stripe. Cash-out is a separate, explicit operation with MFA, settlement and balance checks. Current sandbox fee examples and live-launch limits are documented in [release controls](docs/RELEASE-CONTROLS.md).

Only server-side handlers and restricted financial RPCs can change rental or wallet state. Checkout return URLs are not payment proof: fulfillment verifies Stripe status, amounts, project references and signatures, with replay protection and scheduled reconciliation.

## Correct Auth redirects

Configure each Supabase project independently:

| Project | Auth Site URL and allowed public redirect |
| --- | --- |
| Production | `https://neighborhoodgarage.net/` |
| Sandbox | `https://smkimbal.github.io/NeighborhoodGarage/` |

The production project’s default email callback must use the production domain. The frontend build supplies its canonical public callback. Test signup confirmation and password recovery with an actual inbox; a mocked browser test or administratively confirmed identity does not prove email delivery.

The browser receives only the project URL, publishable key and public callback in `config.js`. Supabase service credentials, Stripe secret keys and webhook signing secrets belong only in protected backend configuration.

## Stripe sandbox configuration

Production currently uses the **Neighborhood Garage sandbox**:

- Set `STRIPE_MODE=sandbox` and the sandbox test key as `STRIPE_SECRET_KEY` in production Supabase.
- Endpoint `we_1UMasLRsHH5z9atPyjeqkeJQ` targets `https://zbbespojxxoheavodtqs.supabase.co/functions/v1/stripe-webhook`.
- Production signature verification uses the encrypted Vault secret `ng_stripe_webhook_signing_secret`. `STRIPE_WEBHOOK_SECRET` in Edge secrets remains a supported override.
- Subscribe to Checkout completion, expiration and asynchronous success/failure, `charge.refunded`, and all `charge.dispute.*` events required by the handler.

The original sandbox project’s managed Stripe Sync setup is separate. Do not copy its callback, signing mode or database configuration into production.

## Run and validate

Use Node 22 or newer and the committed npm lockfile.

```sh
npm ci --engine-strict
npm run dev
# http://localhost:5173 — default sandbox build

npm test
npm run check:edge
NG_VALIDATION_BUILD=true npm run build:cloudflare
npx playwright install chromium
NG_TEST_DIST=dist-production npm run test:browser
npm run deploy -- --dry-run
```

`NG_VALIDATION_BUILD=true` is for unpublished validation builds only. Native Cloudflare production build/deploy scripts wait for successful validation of the exact `main` commit and verify the matching backend release version. Do not set the validation flag in production Dashboard settings.

The optional trusted manual release path is `npm run release:prepare` followed by `npm run release:publish`; see [release controls](docs/RELEASE-CONTROLS.md) for credentials, attestations and artifact verification.

## Deployment and operations

Deploy matching migrations and Edge Functions before their frontend, reconcile existing migration history by name/content, and preserve financial evidence. Never blindly replay the initial schema against production.

The [production roadmap](docs/PRODUCTION-ROADMAP.md) records remaining operator, notification, email/device, retention, insurance and live-payment decisions. Live new external-payment and withdrawal quotes remain blocked until the approved fee and launch policy is implemented. Stripe remains sandbox; this application has not enabled real-money charging.
