# Approved rental workflow verification — October 3, 2026

The owner/renter workflow, unfinished backend checkpoint and production interface
were integrated following approval of the consolidated 15-item review.

## Verified locally

- All 59 unit/database checks pass on Node 22.23.3 and Node 24.19.0.
- All 11 Edge Function entrypoints pass Deno type checks.
- Production build and pinned Wrangler dry run pass; only dist-production is uploaded.
- The existing browser walkthrough passes signup/sign-in, optional MFA recovery,
  GPS/maps, private chat, reputation badges, centered previews and full photo zoom,
  OCR/QR fallback, listing edits/removal/restoration, error handling and sign-out.
- The two-account browser journey uses actual PostgreSQL migrations, RLS and Edge
  handlers with fake Auth/Stripe transport. It verifies uncharged reservation,
  owner approval, pickup scheduling, permanent per-item website QR, pickup and
  return directions, future bookings, credit-only and partial-card checkout,
  approved extensions, held-return inspection, documented partial deposit refund,
  renter contest, independent receipt/readiness after settlement and review/chat.
- Database regression verifies timer refunds with pending extension payment,
  blocked next pickup before physical readiness, audited corrections after financial
  completion, late extension earnings exactly once, and restricted financial RPCs.

## Follow-up test case fixes

- Return condition capture uses the actual video/canvas/JPEG path in Chromium,
  stops camera tracks afterward and shows a condition preview before submission.
- Only one condition-photo picker is visible. QR-photo reading remains an
  optional separate action.
- Camera permission denial, unsupported phone images and a 9 MB PNG are tested;
  the large image is resized into a supported private upload.
- Reservation length is read-only and recalculates with the price from earliest
  pickup to latest return, including time before collection. Reversed endpoints
  move forward automatically. A daylight-saving interval uses actual elapsed time.
- PostgreSQL checks exact fractional refunds, adjusted owner/platform earnings,
  independent deposit inspection, frozen return time, duplicate settlement,
  physical corrections, saved-rate extensions, late partial extension payment,
  safe sub-minimum card checkout failure and denied direct financial access.

## Verified against the production backend

The follow-up migration is recorded as
20261003232139_reservation_window_pricing_and_early_returns.sql. A transaction
against the deployed production functions verified reservation pricing,
credit checkout, return photo ownership, a $15.75 fractional rental refund,
inspection hold, duplicate approval, $50 deposit release, $10.21 net owner
earnings and denied client refund privileges. All test writes were rolled back;
the existing six rental records were preserved.


- Applied additive inventory/reconciliation migrations with connector-assigned
  timestamps recorded in the repository. The prior reservation migration is
  recorded as 20261003181022; no initial schema was reapplied.
- Deployed rental-action v5, rental-booking v2, rental-maintenance v1 and stripe-webhook v5.
- Both ng-rental-deadlines and ng-rental-reconciliation cron jobs are active at
  five-minute intervals. Maintenance uses a scoped token stored in Vault; clients
  cannot read it or call its operator configuration function.
- A scheduled-style authenticated maintenance request returned HTTP 200 with
  reconciled=1, deferred=0 and no errors. The stale pending extension is resolved.
- Stripe remains in the Neighborhood Garage sandbox. Production endpoint
  we_1UMasLRsHH5z9atPyjeqkeJQ is enabled for checkout completion/expiration and
  asynchronous payment results. Its signing secret is encrypted in Supabase Vault,
  accessible through a fixed-name service-only lookup; an Edge secret remains a
  supported override. The replaced endpoint is disabled, and the existing GitHub
  sandbox endpoint remains enabled.
- A valid signed production probe returned HTTP 200; a forged signature returned
  HTTP 400. A real sandbox Checkout Session was created through the authenticated
  app API and expired through verified maintenance. Stripe delivered
  evt_1UMaxuRsHH5z9atPoLCcq3Z6 (checkout.session.expired), recorded by the webhook's
  amount/project/reference-checked fulfillment RPC. The rental became
  payment_failed with no money charged and no pending provider hold.
- The webhook regression uses the actual Stripe SDK and confirms altered body
  bytes cannot reach fulfillment. Anonymous/authenticated roles cannot retrieve
  either maintenance credentials or the webhook signing secret.

Actual inbox delivery and physical phone-camera scanning remain separate manual
acceptance checks. Internal credits are the deposit refund method disclosed in
checkout; this release does not enable live payments or automatic card refunds.
The GitHub Pages sandbox and its database remain separate from production.
