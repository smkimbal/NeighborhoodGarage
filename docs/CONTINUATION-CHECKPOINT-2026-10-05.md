# Continuation checkpoint — October 5, 2026

The saved reservation/QR/return implementation was compared with the repository’s newer state. The canonical production branch is now `main`; `neighborhood-garage-test` remains the separate sandbox. The October 4 release already includes the approved rental workflow and further payment, return, upload and support safeguards. No old checkpoint was replayed and no replacement production branch was created.

## Verified current release

Baseline source: `dc3ad3faaabbef627c5fa6f24ca3d6c8c4dbff70`.

- Exact-commit push validation [37229872617](https://github.com/smkimbal/NeighborhoodGarage/actions/runs/37229872617) succeeded on Node 22 and 24.
- Retrieved Node 22 job logs confirm 96 tests passed, zero failed, the Edge check and production build, both browser journeys with production CSP, and Wrangler asset dry run.
- Browser logs cover account/profile flows, optional MFA, GPS/maps, private chat, badges, centered previews and image zoom, free local OCR/QR, owner-first reservations, shared item QR pickup/return, private directions, future booking, extensions, held-return review, partial deposit refunds and physical corrections.
- Cloudflare’s check for that exact commit reports successful production build `4a97061e-2dc3-40be-b84a-5b03ad1fb16a`, Worker version `efaa2178-09f4-4b41-91a1-e6be7a6c27c6`.
- Production Supabase reports `release_version() = 2026-10-04-hardening-1`; the corresponding migration and current Edge Function inventory are present.
- Rental deadline/reconciliation jobs run every five minutes, and operation reminders every fifteen minutes. Recent database Cron executions succeeded.
- Rental extensions have RLS enabled; authenticated clients cannot execute `begin_rental_checkout`.
- Stripe endpoint `we_1UMasLRsHH5z9atPyjeqkeJQ` is enabled, sandbox-only, and points at production Supabase with the required Checkout/refund/dispute events. The encrypted production webhook signing secret exists; its value was not retrieved or printed.

The local execution and browser environment was offline during this continuation. These browser results come from the successful exact-source GitHub job; a new physical-phone, inbox or hosted-browser journey is not claimed. Cloudflare’s successful deployment check is provider evidence; hosted asset bytes were not independently hashed in this continuation.

## Disposable test cleanup

Stripe confirms the interrupted October 3 QA checkout is complete and paid for $5 in sandbox. Its abandoned extension and later unpaid checkout are expired, not duplicate charges.

The tagged disposable QA reservation was cancelled through the existing production rental RPC after checking its exact fixture identities, reservation state and amounts. The renter received $5 in internal credits, verified against the ledger. Both QA listings are archived and unavailable; zero listings from that fixture owner remain visible.

No new Stripe charge, external transfer, bank/card refund or real-money transaction was created. Test financial records and identities are retained for the current wallet/evidence rules; no ledger history was erased. Customer accounts and customer rentals were not changed.

## Documentation correction

README now distinguishes the production and sandbox Auth callback URLs, documents the production Vault-backed webhook, and correctly explains that owner earnings stay as credits until an explicit withdrawal. The previous production checklist incorrectly instructed use of the GitHub callback and described automatic post-return owner transfers.

This continuation changes documentation only. Existing application/backend source and the validated release controls remain in place.

## Remaining acceptance checks

The current hardening report and roadmap retain the inbox/physical-device and operating launch checks. The security advisor still flags native leaked-password protection as disabled; see [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The bounded, current-account `wallet_summary` SECURITY DEFINER access and private maintenance table without client policies remain intentional and tested; see [the advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The user-approved rental fixes are present in the current production release. Stripe remains sandbox, and live external-payment quotes remain blocked by the existing release policy.
