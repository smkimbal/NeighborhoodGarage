# Validation after the restoration checkpoint

Working branch: `neighborhood-garage-zip-2026-09-28`. Main was not changed.

## What was actually exercised

The UI ran locally against the **real Supabase project**, using three temporary, email-confirmed QA identities. Those identities were provisioned administratively for testing; email delivery/verification links were not simulated as a successful production mail delivery.

- Signed in and created owner/renter profiles using the UI.
- Checked navigation and horizontal overflow at 320, 375, 768, and 1280 pixels.
- Uploaded a photo to private Storage, entered listing details, set rounded location coordinates, published without Stripe onboarding, and checked the 5% fee projection.
- Displayed a generated tool QR code.
- Used geolocation, a two-mile filter, interactive map markers, and verified actual OpenStreetMap tiles loaded. OpenStreetMap tiles depend on an external network connection; the catalog remains usable when tiles cannot load.
- Sent messages in both directions through real Supabase Realtime. An incoming message preserved the unsent draft.
- Confirmed a third account cannot read those messages, impersonate a sender, read private Stripe account IDs, or call financial RPCs directly.
- Enrolled a real TOTP factor on a QA account. A fresh AAL1 session was denied by both RLS and Edge Functions; a verified TOTP challenge restored access. Removed the test factor afterward.
- Used a clearly isolated database rental fixture (no Stripe charge) to check incorrect/correct pickup codes, return photo upload, agreed drop-off, owner baseline/return comparison, approval, instant $75 credit return, pending payout, a completed-rental review, and earned renter/owner badge presentation. A second fixture confirmed that the owner received the return-review prompt without reloading and the renter received the completion update.
- Verified no uncaught browser JavaScript exceptions in these journeys.

Database integration assertions run in a transaction that is rolled back. They cover atomic credit reservation across multiple tools, checkout-request replay, incorrect payment amount rejection, repeated webhook delivery, delayed expiration after payment, action ownership, foreign return-photo rejection, repeated approval, payout/credit separation, asynchronous payment failure, and automatic review attribution.

Dependency audit: no production dependency vulnerabilities reported by `npm audit --omit=dev`.

Local checks: `npm test` (seven assertions), `npm run check:edge`, `npm run build`. Browser scripts are opt-in: `tests/journey.live.mjs`, `tests/rental.live.mjs`, `tests/mfa.live.mjs`; they require separately provisioned disposable credentials in `.qa/users.json` (ignored by git). `tests/database-contract.sql` is self-contained and rolls back its fixtures.

## Confirmed remaining configuration

1. **Stripe:** an authenticated request to the deployed Connect function returned `stripe_not_configured`: `STRIPE_SECRET_KEY` is absent from the Supabase function environment. Add the sandbox key directly in Supabase secrets, never in frontend config or a chat message. Confirm `STRIPE_WEBHOOK_SECRET` and the webhook events in `OPERATIONS.md`. Actual hosted onboarding, card payment, webhook delivery, and bank transfers could not be verified while the server key is absent. The connector's Stripe sandbox connection does not inject this secret into Supabase.
2. **AI:** automatic approval review rejected deployments that would send private tool photos to OpenAI without explicit project-owner approval. Deployed AI endpoints are authenticated availability responses that perform **no external photo processing**. Manual listing and owner return review are functional. Pending implementations remain in `supabase/pending-ai/`, with shared vision code in `_shared/vision.ts`; see `OPERATIONS.md` for activation after approval. No successful AI identification or background removal is claimed.
3. **Auth setting:** Supabase's security advisor reports leaked-password protection disabled. This requires an Auth configuration/plan setting; code changes do not enable it.
4. **Camera hardware:** QR generation and typed-code pickup were tested. Physical-camera decoding requires testing on a supported mobile browser; unsupported browsers retain manual code entry.

## Defects found and corrected during simulation

- Provider errors were hidden behind the generic non-2xx wrapper.
- A failed rental action closed its dialog as though it had succeeded.
- Location buttons stayed busy because an async handler used `event.currentTarget` after the event finished.
- An initially empty toast rendered as a small dark pill.
- SQL coordinate validation accepted half-empty coordinate pairs because CHECK constraints accept NULL.
- Pending card checkouts lacked resume/cancel controls.
- Temporary return uploads had no safe owner cleanup policy; unused uploads can now be deleted, while referenced evidence remains protected.

The original local unfinished SQLite backend was preserved and not copied over this Supabase branch.

Cleanup completed: all three temporary QA identities, their test tools/messages/rentals/reviews/credits, and five uploaded Storage objects were removed. The original user account was preserved. No Stripe charges or connected accounts were created.

Deployment follow-up: both native branch Pages and the custom Actions workflow run for this branch. The branch now includes reproducible browser bundles, so native publishing cannot overwrite the site with uncompiled npm imports. Both deployment paths use the same static assets.

## GPS and on-device photo update (2026-09-29)

- Map now marks the device position in blue and keeps it in view when available, including an empty marketplace. It reports permission denial, unavailable positioning, insecure HTTP, and timeouts separately; high-accuracy GPS gets a low-accuracy fallback. Position is only held in the browser session; listings store neighborhood-rounded coordinates.
- Photo recognition now runs MobileNet in the browser. Its model weights download on first use, and it suggests only a broad title/category when confidence is sufficient. It cannot identify serial/model numbers, safely assess structural condition, or price deposits. Owners enter those fields. Plain, consistent backdrops can be removed by a local canvas edge flood-fill; complex backgrounds leave the original usable.
- The original tool photo is still uploaded to private Supabase Storage when the listing is published for condition evidence. Recognition itself does not upload it. The optional cleaned photo is uploaded to private Storage only if the user explicitly chooses cleanup. No OpenAI image endpoint is called.
- Stripe sandbox remains blocked until `STRIPE_SECRET_KEY` is installed in this Supabase project's Edge Function secrets. The connected Stripe account cannot transfer its secret API key to Supabase through the available connector. No key belongs in GitHub or a browser. The webhook signing secret must be set separately after registering the endpoint. Supabase leaked-password protection remains an Auth project setting, reported disabled by the security advisor; turn it on in Dashboard if supported by the project plan.

## Signup, session, and badges pass (2026-09-29)

- Reviewed Auth and Edge logs. The earlier `/signup` 500s named `permission denied for table profiles`; the trigger-owner migration at `20260929021649` addressed that. Subsequent signup and token requests succeeded. Current Auth user count matches profile count (2 each, no orphan profiles). Repeated earlier MFA 422s were friendly-name collisions; enrollment now uses a distinct friendly name for each new factor while resuming server-pending factors.
- Signup displays a persistent confirmation state and offers resend, then explicitly reconciles a session if one was created despite a client-side error. Sign-in loads account state directly. An account-load failure presents Retry and Sign out instead of a dead-end error. Confirmation redirect errors display a usable message. Profile onboarding verifies an updated row was returned.
- Badges have a dedicated profile tab with 11 earned milestones and neighbor-facing recognition on tool listings and public neighbor pages. The aggregate reputation RPC excludes private rental, chat, payment, and address details. Its limited authenticated `SECURITY DEFINER` grant is intentional and triggers Supabase advisor lint 0029; anonymous execution is denied. MFA session checks and a 50-ID request cap apply.
- Browser simulation at a 375px viewport passed confirmation state, sign-in without reload, badge tab, public badge page, and badge labels in marketplace cards with no uncaught JS errors. The simulated transport does not substitute for actual email delivery or a live card payment. A disposable `example.com` test signup was rejected by Auth address validation before any account was created. Existing real accounts were not modified.
- Latest Edge logs still show `stripe_not_configured` on payout/checkout; Supabase secrets remain required. The obsolete AI Edge 503 entries predate the on-device recognition UI. Earlier `rental-action` 400s are expected invalid-state tests. Full payment, phone GPS hardware, and mailbox verification need their external prerequisites.

## Stripe setup repair (2026-09-29, 12:59 UTC)

- Supabase's new Stripe key successfully authenticated to the expected sandbox. The Accounts v2 error was `non_connect_platform_accounts_v2_access_blocked`; enabled Connect with Stripe's idempotent sandbox `EnableConnect` operation, which returned `enabled: true`. Listing connected accounts then succeeded.
- Discovered that installing Stripe Sync had replaced the application's `stripe-webhook` with a Sync-only handler. Deployed combined handler version 6, retaining managed signature verification and synchronization before applying the application's rental-payment transaction.
- Confirmed the managed signing secret exists without fetching or logging it. An invalid signature returned HTTP 400. A genuine sandbox `customer.created` event returned HTTP 200 from deployed version 6 and synchronized its test customer into Postgres. This verifies the actual managed signing-secret path. No payment or charge was created.
- Temporary sandbox customer `cus_VLi2p5RQBq5Osu` is labeled as webhook verification. The connector did not expose a customer-deletion operation during cleanup discovery; it remains as an empty test record, with no email, payment method, or personal data.
- Full owner onboarding and a paid rental still require a user to complete Stripe-hosted test onboarding and checkout. The configuration block has been removed; no production settings were changed.
