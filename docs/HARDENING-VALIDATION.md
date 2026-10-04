# Hardening validation and rollout — October 4, 2026

The user explicitly authorized tests and publication, superseding the prior no-test checkpoint. This report covers the combined F1–F9/security/cleanup release based on main `95cc09c230e551df7c46a633357e4d32ab11d23d`. Publish the complete validated tree in one commit; no feature/production replacement branch is needed.

## Validation checkpoint

| Check | Result |
|---|---|
| Node 22.23.3 unit/database/service suite | 96 passed, 0 failed, 0 skipped |
| Node 24.19.0 unit/database/service suite | 96 passed, 0 failed, 0 skipped |
| Deno checks | All 13 Edge Functions pass |
| Production browser journeys | Both pass on Node 22 and Node 24 with Chromium 153 |
| Real production CSP headers | Maps, local OCR/QR workers and exercised app flows pass |
| Cloudflare build and Wrangler dry run | Pass; only dist-production assets packaged |
| Source whitespace | git diff --check passes |

The browser rental journey executes actual Edge handlers and the full PostgreSQL migration chain in PGlite. Stripe/Auth transport is controlled test transport. OCR reads a real label fixture; QR decoding uses a real generated image. Camera capture uses a canvas video stream and also checks denied permissions/unsupported files. These checks do not certify physical phone hardware, email inbox arrival, actual Stripe transfers or bank arrival.

Financial cases include duplicate/out-of-order webhooks, partial and full refunds, won/lost disputes, bounded compensating entries, operator allocations, withdrawal holds/retry recovery, retained wallet identities after deletion, principal-only credit issuance and credit-only checkout without Stripe. Access checks cover service-only financial mutations, operator MFA plus allowlisting, rental photo membership, ledger tampering, rate windows, support reports and private data isolation. Pagination/history and responsive layouts are exercised by the database/browser suites.

Validation found and fixed: an obsolete change_rental copy that replaced current window pricing, a false deposit-release toast, missing receipt confirmation before return approval, and a CSP allowlist missing the actual map tile hostname. Test fixtures were updated for the new RPCs, fee quotes, receipts, MFA, settlement holds and sanitized upload endpoint.

Validated app artifact SHA-256: `68f6e1c1fc8bba14a2a2618447d4c6e61ccc90151b2a23343a49a8163fd2dbc1` (`dist-production/assets/app.js`). Generated assets and QA credentials are not committed.

## Backend checkpoint

Production Supabase project: `zbbespojxxoheavodtqs`.

- Applied only the new production_security_operations migration. Historical migrations were not replayed; earlier connector timestamps differ from repository filenames.
- Deployed all 13 matching Edge Functions, including new support, upload-photo and notification-worker handlers. Custom verified-user authentication/MFA, maintenance-token checks and webhook signatures remain mandatory; gateway JWT settings match the existing deployment.
- release_version() returns `2026-10-04-hardening-1` through both SQL and the anonymous public HTTP readiness API.
- All four new public tables have RLS. Anonymous users cannot reconcile payments; authenticated client roles cannot operate support cases. Direct authenticated photo insertion is blocked. The reminder Cron job is active.
- The existing reserved/pending-pickup rental remains intact. No pending rental/extension payment, credit purchase or withdrawal existed before application.
- All 12 non-webhook functions reject unauthenticated POSTs with HTTP 401. Invalid webhook signature returns 400; untrusted support origin returns 403.
- Stripe sandbox endpoint `we_1UMasLRsHH5z9atPyjeqkeJQ` is enabled with the four Checkout and six refund/dispute subscriptions already required by this release. Its signing secret and account were not changed.

No real-money charge, bank payout or outbound notification was created by this validation. The in-app reminder queue is enabled; no external delivery adapter or operator identity was invented.

## Publication controls and remaining operating gates

Cloudflare native builds automatically wait for successful production validation of their exact main SHA and verify the deployed backend version before publication. The validation workflow compiles an unpublished artifact and runs the browser journeys independently. Build/deploy fail closed on failed/canceled/unavailable validation or incompatible backend. A trusted manual publisher can use both explicit exact-revision attestations; validation-only flags must never be set in production Dashboard settings.

GitHub main currently has no branch protection; this connector cannot configure it. Enable required checks/review and prevent force pushes through administrator settings. Provider Dashboard build/deploy commands must continue to use the gated scripts. Check actual hosted asset hashes and CI status after push; backend deployment alone is not proof of frontend publication.

The Supabase security advisor still reports compromised-password protection disabled; enable it through supported Auth administrator settings. Its wallet_summary SECURITY DEFINER notice is intentional: the function binds to auth.uid(), checks session/MFA/restrictions, uses an empty search path and returns that account's totals. Anonymous execution is revoked; SQL access tests cover isolation. The private maintenance credential table intentionally has no client policy. Advisor references: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Before public paid launch: allowlist the verified MFA operator and backup, configure approved outbound delivery/scheduling, reconcile provider balances/credit liabilities, complete bank/email/device acceptance, and settle the live fee, prepaid-credit, insurance/legal and retention decisions in PRODUCTION-ROADMAP.md. Live new external-payment/withdrawal quotes remain blocked; sandbox fee examples are not a confirmed live surcharge contract. The two retired remote AI handlers still require administrator deletion; their source and obsolete AI quota schema were removed. A standalone Deno dependency lock remains an environment-limited follow-up.
