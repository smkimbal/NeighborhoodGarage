# Reservations, handoffs and returns

Production is hosted on Cloudflare at https://neighborhoodgarage.net/ and uses
Supabase project `zbbespojxxoheavodtqs`. Stripe remains in the Neighborhood Garage
sandbox. The GitHub Pages sandbox and its database are separate.

## User journey

1. Request a rental for today or a future project, with pickup and return windows.
   Requests take no payment. The owner confirms the dates and privately shares
   designated meeting places or an explicitly captured current GPS position.
2. After approval, choose a pickup time or **Pick up now**, then confirm payment.
   Available Tool Share Credits fund the checkout first. A fully credit-funded
   rental or extension returns before Stripe is initialized. A partial payment
   sends only the remaining amount to hosted Stripe Checkout, subject to its
   $0.50 USD minimum. The existing 5% platform fee still applies to rental earnings.
3. The permanent item QR opens `/#/handoff/<tool UUID>`. The backend finds the
   authenticated participant's current booking and chooses pickup or return.
   Scanning opens a confirmation; it never silently changes possession. Existing
   text-only QR labels should be reprinted once. Their printed backup codes remain
   usable in the app. The same new website QR stays attached to the item.
4. Return at the agreed place/window with a condition photo, using the same QR or
   the designated drop-off option. Late or early returns can still be recorded;
   they do not trap an already-returned item in the checked-out state.
5. The owner inspects original and return photos and approves acceptable wear.
   The deposit returns as internal credits and net rental earnings are credited
   once. New approvals do not initiate a Stripe transfer. Withdrawals remain a
   separate, explicit external transaction.

Deposit refunds do not infer physical receipt or readiness. Owners confirm receipt
and mark the tool ready separately, or explicitly check both when approving an
inspected return. A completed financial rental stays on the garage dashboard while
its physical handoff is unresolved. The same item QR can record a physical return
after settlement. The next pickup is blocked until the owner marks the prior item
ready. Physical corrections have a reason and can include a revised return estimate.

Both meeting places offer Google Maps and Apple Maps directions. Exact addresses
and GPS points are visible only to the booking participants. Discovery uses
neighborhood-rounded coordinates. Currently rented tools remain searchable with
an approximate return date, reserved dates and future booking requests.

## Actionable exceptions

| Situation | Next action |
| --- | --- |
| Owner has not approved | Owner approves/declines; renter can cancel. Requests expire after 24 hours. |
| Approved but unpaid | Renter chooses pickup and pays within 24 hours, requests a window change, or cancels. |
| Checkout pending | Resume, check verified Stripe status, or cancel after provider expiration. |
| Session creation timed out | Check payment status recovers a matching provider session; a verified missing session releases held credits only after its 31-minute creation lease. |
| Handoff differs from app | Owner records a reasoned, audited physical correction. Settled deposits cannot be reopened; physical receipt and readiness remain actionable afterward. |
| More rental time needed | Renter requests an extension; owner checks the calendar and approves; renter pays the continued daily rate. No second deposit. |
| Return held for inspection | Owner retains inspection, approval, receipt and documented-deduction actions. It stays a return review, never silently becomes rented again. |
| Damage deduction | Owner provides an inspection photo and itemized estimate; undisputed deposit returns immediately. Renter agrees or contests. Owner can reduce the deduction or approve a full refund. |
| Inspection/deduction overdue | Remaining deposit returns as credits at the deadline. Either participant can flag an unresolved review in its history. |

The prototype inspection policy is 48 hours with one additional hold of up to
24 hours. A documented deduction has a seven-day resolution deadline; an
unresolved deduction releases the remaining deposit. Normal wear is acceptable.
The five-minute `ng-rental-deadlines` cron sweep also runs without either user
opening the app. Pending extension payments never delay this deposit deadline. The separate
`ng-rental-reconciliation` job verifies Stripe every five minutes, expires abandoned
open checkouts and safely releases their held credits. Uncertain asynchronous
payments remain pending until verified. A late paid extension credits only its
additional net earnings once; it cannot reopen a settled deposit or calendar.
Flagging a review records it for operator follow-up; it does not promise a staffed
support response. Insurance is not activated in this prototype.

The owner calendar displays two weeks of requested/confirmed rentals and approved
extension holds, with separate lanes for overlapping requests. PostgreSQL locks
the tool row before confirming calendar occupancy. Confirmed overlaps are rejected
even if two approvals race. Only one physical checkout can exist per item.

## Deployment and verification

The production database already has `rental_reservations_handoffs_and_reviews`.
Apply the additive `rental_inventory_and_payment_reconciliation` migration and its
maintenance-schema/signing-secret follow-ups, then
deploy `rental-booking`, `create-checkout`, `rental-action`, `rental-maintenance` and `stripe-webhook` with
their shared dependencies before publishing the frontend. Existing migration
history uses connector-assigned timestamps; reconcile by name/content before
using CLI `db push`. Do not reapply the original schema under local timestamps.
After deploying the maintenance function, the database operator runs
`select private.configure_rental_maintenance('https://zbbespojxxoheavodtqs.supabase.co');`.
This creates a scoped token in Vault and schedules the endpoint; clients cannot
read its credential or call the configuration function.

The authenticated Edge handlers validate tokens, confirmed email/phone and enrolled
MFA. Financial RPCs are service-only, new tables have RLS and explicit grants,
condition evidence is private, and Stripe fulfillment requires verified provider
status/signatures, matching project/booking references, amounts and replay guards.

```sh
npm ci --engine-strict
npm run check:cloudflare
npx playwright install chromium
NG_TEST_DIST=dist-production npm run test:browser
npm run deploy -- --dry-run
```

Browser tests use fake Auth/provider transport. The two-person rental test runs
the actual migrations, RLS and Edge handler code in local PostgreSQL (PGlite);
it does not duplicate financial transitions in a UI mock. A separate actual-service
sandbox payment check is required before launch. Neither browser simulation nor
an administratively confirmed test identity proves email inbox delivery or
physical phone-camera performance.

Keep the webhook signing secret separate from `STRIPE_SECRET_KEY`. Production
uses encrypted Vault secret `ng_stripe_webhook_signing_secret`, with a fixed-name
service-only lookup. `STRIPE_WEBHOOK_SECRET` in Edge secrets remains supported.
Endpoint `we_1UMasLRsHH5z9atPyjeqkeJQ` replaces the disabled October 1 endpoint.
Never include either secret in frontend configuration or version control. A checkout return URL alone is never trusted as payment proof;
**Check payment status** independently verifies Stripe when a webhook is delayed.
