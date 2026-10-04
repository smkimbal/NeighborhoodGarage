# Hardening implementation checkpoint — October 4, 2026

Base revision: `95cc09c230e551df7c46a633357e4d32ab11d23d`, branch `main`.

**Updated after explicit authorization to test and push.** The prior no-test restriction was superseded. All 96 tests pass on Node 22 and 24; both production browser journeys pass on both runtimes with production security headers. Thirteen Edge Function checks and Cloudflare packaging pass. The new production migration and all 13 matching functions are deployed; the existing reservation remains intact. See [HARDENING-VALIDATION.md](HARDENING-VALIDATION.md) for evidence and remaining live-launch gates. No real-money charge, bank transfer or outbound notification was made.

## Changes and completion limits

| Finding | Implemented in source | Remaining release work |
|---|---|---|
| F1 — Rental reversals | Verified charge receipts; refund/dispute reconciliation; principal-capped compensating entries; participant payment holds; audited operator allocation bounded by verified loss/owner earnings | Validate event replay/order, won disputes and allocations; backfill/reconcile pre-release sessions; subscribe production refund/dispute events |
| F2 — Withdrawals | MFA; seven-day positive-credit hold; per-account settlement deduction; $1,000 daily limit; same-request transfer recovery; quote before new sandbox transfer | Validate concurrent requests and delayed settlement; confirm live Connect fee contract; monitor provider reserves independently of app balances |
| F3 — Return dead ends | Physical receipt required before deadline settlement; automatic nonreceipt case; owner approval records receipt before settlement; deadline events reflect actual completion | Validate all old/new return states; staff operator cases; nonreceipt cannot be solved safely by an automatic refund |
| F4 — Deletion | Block nonzero wallets, open cases and active disputes; 180-day recent-financial-evidence hold; preserve wallet identity for later funding reversals; remove forfeiture language | Adopt a jurisdiction-specific retention/closure policy and operational privacy-request process; validate post-deletion webhooks |
| F5 — Operations | MFA/allowlisted operator queue; evidence links; assignment, receipt, settlement, account restrictions and audited financial allocation; participant notifications; retryable outbox and SQL reminders | Configure operator identities, approved outbound delivery adapter and authenticated worker schedule; monitor exhausted retries; case response targets require staffing |
| F6 — Abuse | Endpoint rate windows, message serialization/rate limit, user block/report, upload limits and bounded request bodies; browsing no longer runs global rental maintenance | Validate adversarial direct API access, tune quotas, monitor abuse and add edge/WAF controls appropriate to measured traffic |
| F7 — Photo privacy | Every frontend upload re-encodes; service strips JPEG APP/COM and PNG ancillary metadata; size/dimension/type checks; direct authenticated bucket insertion blocked | New images only: existing stored photos are not rewritten; assess a separate metadata cleanup/backfill with backups. Validate mobile formats and evidence paths |
| F8 — CSP | Script/default/connect/worker/image/font/form policies; per-build database origin; local OCR/QR support; no object/frame embedding | Browser validation across maps, model downloads, QR, camera and OCR is still required; do not infer runtime compatibility from compilation |
| F9 — Truncation | Stable-key page traversal; bounded server-side marketplace search; message/history/review load-more controls; active rentals separate from 50-row history pages; direct rental retrieval; events/extensions scoped to loaded rentals; support keyset pagination | Validate cursors, concurrent insertions and large histories. Owned inventory and authored-review metadata still traverse scoped pages; message history currently pages across conversations. Geographic ranking and per-thread optimization remain roadmap items |

## Fee implementation

5% rental revenue is unchanged. Credit-only use adds no Stripe fee. Incoming sandbox Stripe payments show a separate server-calculated fee, persist it, and verify principal plus fee against the provider. Fee amounts are excluded from minted credits. Outgoing sandbox transfers show the debit, fee and amount sent before confirmation. Live new external quotes remain disabled pending approved method/jurisdiction/Connect terms; the sandbox rate is not a live-cost guarantee. See RELEASE-CONTROLS.md.

## Cleanup checkpoint

Removed tracked generated `assets/app.js`/`assets/app.css`, the build step copying bundles back into the repository root, unused app imports/helpers, pending external-AI handlers/shared vision helper, and disabled local cloud-AI endpoints. A forward migration retires the unused AI quota table/function. Historical migrations and still-used compatibility wrappers remain. Historical validation reports are labeled as historical; README differentiates production/sandbox project IDs.

No replacement branches were created; this release updates main in one atomic publication. The user's manual branch cleanup remains authoritative. Remote retired function deletion and provider configuration are not claimed complete.

## Release checkpoint

Added a backend version marker, frontend compatibility check, exact-source CI/backend verification with a trusted manual attestation option, gated publishing, SHA-pinned GitHub Actions and lockfile-pinned Wrangler. The sandbox deploy workflow publishes a built artifact. The provider branch protection and Cloudflare settings still require administrator configuration; source code alone cannot establish those settings.

A separate Deno dependency lock could not be generated: Deno's registry fetch was refused in this environment. Edge checks currently resolve exact direct npm imports through installed packages managed by `package-lock.json`. A frozen standalone Deno resolution remains a release follow-up; no fabricated lockfile was added.

## Validation and follow-up

Database tests cover physical nonreceipt, owner approval, fractional rental refunds, deadline recovery, duplicate/out-of-order payment reversals, won/lost disputes, operator allocation, withdrawal holds and retries, deletion, role isolation and ledger history. Endpoint checks cover fee policies, upload membership, metadata removal and operator MFA/allowlisting. Browser checks cover maps, OCR, QR decoding, condition capture, return disputes, review history, credits, responsive layouts and source-release gates.

Validation found and fixed a migration that overwrote newer reservation-window pricing, a misleading return-success message, missing receipt confirmation on approval, and a CSP rule blocking the map tile host. The latest window-pricing wrapper remains in use.

Provider controls requiring administrator credentials remain documented: main branch protection, compromised-password checking, operator identity allowlisting, external notification delivery/scheduling, deletion of the two retired remote AI functions, and a standalone frozen Deno resolution. Stripe's production-project sandbox endpoint already has the required Checkout/refund/dispute subscriptions. Live fee eligibility, Stripe approval of prepaid credit cash-out, insurance/legal work and real bank/email acceptance remain launch gates. The roadmap in PRODUCTION-ROADMAP.md covers these operating decisions.
