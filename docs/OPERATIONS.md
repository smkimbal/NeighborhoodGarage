# Supabase + Stripe + AI operations

The static GitHub Pages frontend uses only the Supabase public URL/key in `config.js`. Secrets belong in Supabase Edge Function secrets, never in GitHub Pages assets.

## Environment

- `STRIPE_SECRET_KEY`: sandbox `rk_test_…` with the required Connect, Checkout, PaymentIntent, and Transfer permissions (or a sandbox secret key during initial setup).
- `STRIPE_MODE`: `sandbox` by default. Live keys are rejected until explicitly set to `live`.
- `STRIPE_WEBHOOK_SECRET`: signing secret for this project's endpoint, matching the sandbox.
- `OPENAI_API_KEY`: required by the pending AI implementation. External photo processing is currently disabled pending owner approval. The disabled deployed endpoints send no photos to OpenAI. Ready-to-review identification and cleanup handlers are in `supabase/pending-ai`; return comparison is in `_shared/vision.ts`. Once approved, copy the pending handlers to their function index files, adjust imports from `../functions/_shared/` to `../_shared/`, and deploy. Re-enable return comparison only with renter consent. Without it, manual listing and owner review remain functional; AI controls explain what is missing.
- Optional `OPENAI_VISION_MODEL` (default `gpt-4.1-mini`) and `OPENAI_IMAGE_MODEL` (default `gpt-image-1`).
- Supabase supplies its URL and credentials; both legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` and newer `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` JSON maps are supported.

Deploy migrations with `npx supabase db push` and functions with `npx supabase functions deploy <name> --no-verify-jwt`. Every user-facing function validates its bearer token with Auth `getUser` and enforces enrolled MFA itself; the webhook validates Stripe's signature. The gateway flag alone is not the authentication mechanism.

Functions: `connect-account`, `create-checkout`, `rental-action`, `stripe-webhook`, `mfa-recovery`, `identify-tool`, `prepare-photo`.

## Stripe sandbox

Enable Connect in the same Stripe sandbox as the server key. New owners use Accounts v2 recipient accounts and Stripe-hosted onboarding. Never mark onboarding complete from a redirect alone: the server re-reads the transfer capability. Onboarding links are single-use; expired links return through the refresh handler.

Register `https://ilfpugydxlzmmxjfrmrv.supabase.co/functions/v1/stripe-webhook` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

A card checkout is a **charge**, including a refundable deposit, not a card authorization hold or regulated escrow service. Credit reservation and release are atomic. Deposits become internal, non-cash-out Tool Share Credits only after owner concurrence. Approved loans can have pending owner payouts; owners retry in My garage. Maintain enough platform balance to fund transfers for credit-funded loans. A 5% marketplace fee does not guarantee profitability after Stripe fees.

Do not simply replace sandbox keys in a database containing sandbox account and payment IDs. Before launch, use a separate production Supabase/Stripe environment, register its webhook, onboard owners again, and reconcile balances. Configure durable payout jobs/reconciliation, disputes/refunds, retention, email delivery, abuse controls, and applicable payment/insurance arrangements. The prototype makes no insurance-coverage promise.

## Data and access

Private chats use participant RLS and TLS; they are not end-to-end encrypted. Photo buckets are private with short-lived signed URLs. Tool coordinates are rounded to two decimal places; actual pickup addresses belong in private chat. Original listing photos are immutable evidence while in use. AI-edited catalog images never replace those originals. AI cannot determine hidden mechanical safety or finalize a damage claim.

MFA stays optional in the sandbox but is enforced by RLS and Edge Functions for users who enable it. Enable Supabase leaked-password protection if the plan supports it. Enable email confirmation, set the Site URL and allowed redirect URL to `https://smkimbal.github.io/NeighborhoodGarage/`, and configure production SMTP before public signup.

## Local and GitHub Pages

Run `npm ci`, `npm test`, `npm run check:edge`, `npm run dev`. Local static preview: `http://localhost:5173`. `npm run build` bundles pinned dependencies into `dist`; there is no browser CDN dependency for the Supabase client. Map tiles require access to OpenStreetMap. Respect its tile usage policy and move to a suitable tile provider as traffic grows.

The Pages workflow targets the working branch, not main. GitHub's `github-pages` environment must permit deployments from that branch. Assets are relative so `/NeighborhoodGarage/` works.
