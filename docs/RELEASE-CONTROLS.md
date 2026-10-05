> Sandbox-only follow-up and prepared administrative controls: [SANDBOX-OPERATIONS.md](SANDBOX-OPERATIONS.md).

# Hardening release controls — October 4, 2026

Status: the user authorized testing and publication. Local validation passes: 96 tests on Node 22 and 24, 13 Edge Function type checks, both production browser journeys with real security headers, and Wrangler asset packaging. Provider payment transport in these tests is mocked; this is not live payment or bank-arrival certification. See HARDENING-VALIDATION.md for the rollout checkpoint.

## Required order

1. Freeze a single source revision on `main`. Preserve `neighborhood-garage-test`; do not create replacement production branches. Never publish production using a sequence of GitHub file edits or Contents API commits.
2. Reconcile the production migration inventory with the repository. Existing migration timestamps differ from deployment history. Apply only the new reviewed migration; do not blindly run `supabase db push` or replay the old schema.
3. Before production application, authorize and complete database/payment scenario validation against the sandbox. Cover duplicate/out-of-order webhook events, dispute won/lost, deletion, settlement delays, simultaneous checkout/withdrawal, owner nonreceipt, owner approval, and case settlement. The local migration-backed PostgreSQL harness exercises these scenarios; actual provider acceptance remains a live-launch gate.
4. Stage all updated Edge Functions and the new `support`, `upload-photo`, and `notification-worker` functions. Apply `20261004173932_production_security_operations.sql` in a controlled maintenance window, deploy the matching function revision, and check `release_version()` returns `2026-10-04-hardening-1`. Storage policy changes require the new photo endpoint and matching frontend: old clients must refresh. Do not leave a mixed-version deployment accepting money.
5. Configure and verify operator MFA/allowlisting, Stripe refund/dispute webhook subscriptions, settlement reconciliation, support ownership, and notification delivery. Inventory existing Stripe sessions with no database session ID before changing fee handling. Reconcile or expire old pending sessions first.
6. Run the full existing validation and the new financial scenario matrix after test authorization. Record results against the immutable Git SHA, dependency locks, backend version, and artifact digest. Fixtures use the current RPCs, upload endpoint, quotes and pagination. Browser journeys run the actual Edge handlers and migrations with controlled Stripe transport.
7. Native Cloudflare builds wait for the successful `validate-production.yml` push workflow for the exact checked-out `main` SHA, and query the deployed public backend version before and after that wait. Failed/canceled/wrong-commit/PR/manual runs cannot authorize publication; network or timeout errors fail closed. A trusted manual publisher may instead supply both `NG_RELEASE_BACKEND_VERSION=2026-10-04-hardening-1` and `NG_RELEASE_VALIDATED_SHA=<fully validated commit SHA>`. Partial or incorrect attestations and dirty tracked source always fail. Manual values are operator attestations, not cryptographic proof.
8. Publish the reviewed artifact and observe failed payments, webhook retries, negative balances, case backlog, uploads, and return transitions. Roll back frontend/functions together to a compatible revision if necessary; retain additive schema and financial history. Never delete ledger rows or reverse migrations to hide a failed payment.

`NG_VALIDATION_BUILD=true npm run build:cloudflare` compiles an unpublished artifact. Do not set `NG_VALIDATION_BUILD` in the production deployment environment. `release:prepare` runs the authorized release checks. `release:publish` checks the prepared artifact manifest and production gate. `npm run deploy -- --dry-run` is packaging only. Wrangler is pinned in the npm lockfile; GitHub actions are pinned to retrieved commit SHAs.

## Provider settings requiring administrator access

These are not configured by source edits:

- GitHub: protect `main` with required validation checks, disallow force pushes/deletion, require review for payment/database/release files, and restrict bypass rights. Make branch protection available even when the maintainer normally edits through GitHub. Avoid unvalidated direct web edits.
- Cloudflare: use `main` and a controlled deploy path. Its push-triggered build does not wait for an independent GitHub workflow. Prefer disabling automatic publishing and uploading the validated artifact. The gated build and deploy scripts now verify the exact commit workflow and backend automatically. Confirm the Dashboard uses these scripts; do not set validation-only bypass flags there. Administrator settings were not changed through this code update.
- GitHub Pages sandbox: publish the Actions `dist` artifact, not the branch root. Root generated assets were removed on `main`; do not merge that cleanup into an old branch-root deployment without switching Pages first.
- Supabase: deploy backend before frontend, verify RLS/storage changes and webhook signing mode, retain separate production/sandbox projects, and remove retired remote `identify-tool`/`prepare-photo` functions after checking old-client use. Their local source is removed; remote deletion has not occurred.
- Operator allowlist: a database administrator uses the audited, service-only `set_operator_access` operation for the intended verified account ID; no self-enrollment API exists. Confirm at least one staffed operator and a backup before relying on the queue.
- Notifications: the in-app outbox/reminders are implemented. An approved HTTPS delivery adapter and secrets `NG_NOTIFICATION_DELIVERY_URL`/`NG_NOTIFICATION_DELIVERY_TOKEN` are required for outbound mail. Its contract accepts `{id,to,subject,text}` with a bearer token and `Idempotency-Key`; it must persist idempotency before acknowledging success. Schedule the authenticated worker, monitor attempts reaching 12, and provide a manual recovery procedure. No real messages were sent in this work.

## Money and fee policy

The 5% rental platform fee remains separate from payment costs. Internal credit transfers incur no new Stripe processing fee. A card-funded rental, extension, or credit purchase shows principal, processing fee, and total before confirmation; the server recalculates the quote and verifies the gross Stripe receipt. Processing-fee money is never minted as rental credit.

The sandbox incoming-payment schedule models 2.9% + $0.30 using gross-up to cover processing of the fee itself. This is an illustration, not the merchant's confirmed live contract. Sandbox outgoing transfers quote $0 separately and disclose that bank payout terms are controlled by Stripe. Existing reserved transfers remain reconcilable.

Live new external-payment and withdrawal quotes are deliberately blocked until the supported payment methods, jurisdiction rules, merchant contract, surcharge eligibility/caps, refund policy, and Connect payout costs are settled and implemented. A generic Checkout surcharge is not a substitute for determining card eligibility. Do not enable live mode by removing these checks. Credit funding also retains its existing Stripe-approval gate for the prepaid-credit/cash-out model.

Seven-day holds and pending-settlement deductions are conservative operational controls, not a guarantee against later disputes. Unknown settlement dates keep funds held until Stripe verification fills them. Refunds and disputes debit principal only up to the amount originally funded; fee losses and owner/renter allocation require an audited support decision. A won dispute may require reversing a prior operator allocation before resolving the case.
