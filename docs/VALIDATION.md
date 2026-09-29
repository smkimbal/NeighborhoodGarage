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
