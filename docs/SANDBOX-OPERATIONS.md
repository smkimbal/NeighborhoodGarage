# Sandbox operations checkpoint — October 5, 2026

This work uses the existing `neighborhood-garage-test` branch and Supabase sandbox `ilfpugydxlzmmxjfrmrv`. Production `main` remains at `dc3ad3faaabbef627c5fa6f24ca3d6c8c4dbff70`, with its last Node 22/24 validation and Cloudflare release passing. No additional remote branch is created. This checkpoint does not authorize a paid upgrade, live Stripe charges or real outbound messages.

## Checkpoint 1: inventory

The sandbox was behind main: three verified accounts, one listing, no rentals and no credit entries. Migration timestamps differ from repository timestamps, so synchronization uses reviewed migration names and schema prerequisites rather than a blind `db push`. GitHub's authenticated repository owner email matches one verified sandbox account; that identity is the intended first operator. No account currently has a verified authenticator.

Main is unprotected. The public sandbox web address returns 404. The Supabase organization is on the Free plan, which does not include native leaked-password enforcement.

## Checkpoint 2: implementation and local validation

- Operator approval/revocation is service-only, verified against Auth, and recorded in the operation audit. Operator cases, evidence, retries and money decisions require an active allowlist entry, a verified authenticator and an AAL2 session. Restricted/deleting operators lose access immediately. Account deletion removes the role and releases retained case assignment references.
- Audited decisions bind a request UUID to its actor, case, action, note and amount. The form retains that UUID after an uncertain response; changed replays are rejected. Case evidence includes recent decisions and verified payment summaries. Invalid, fractional or oversized cent amounts cannot silently become a zero-dollar decision.
- Own notifications have an unread count, timestamps, refresh, older history, individual read controls and batch read controls. Cross-account reads and updates remain blocked. Restricted accounts can reach their own Support queue to appeal.
- Delivery has atomic claims, lease fencing, bounded retry/backoff, retained failures and audited operator retries. A scheduled sandbox worker records generic delivery previews; it never fetches an outbound provider or looks up recipient emails, even with copied delivery credentials. Future external adapters must honor the stable idempotency key.
- Signup, recovery and password changes screen known breached passwords on submission through the free Pwned Passwords range API. Only a five-character SHA-1 prefix is sent, with padding and no cookies/referrer. Lookup errors block saving a new password; sign-in remains available. Password changes use password-manager fields, confirmation, current-password proof and an optional provider reauthentication nonce.
- The application breach check is client-side and can be bypassed through direct Auth API calls. Native minimum length/current-password/reauthentication settings still need dashboard access. Native breached-password enforcement requires Pro; no upgrade has been made.
- Default builds use only the sandbox project; browser config rejects server/Stripe secrets. The sandbox backend refuses live Stripe mode before payment or Stripe Sync initialization. Only the Pages deployment job can request an OIDC token; tests have read-only repository permissions.
- Test publishing validates Node 22 and 24 and all three browser journeys before retaining its artifact. It checks actual Pages settings and skips deployment clearly when Actions hosting is unavailable or incorrectly points to a production custom domain. Missing hosting is not reported as a deployed application.

Local validation: 109 tests pass with no skips on Node 22 and Node 24; all 13 Edge Functions type-check. Browser journeys cover the existing marketplace, real PostgreSQL/RLS rental transitions, password blocking/change forms, operator MFA gates, notification history/isolation and restricted-account appeals. Auth, Stripe and outbound deliveries in browser tests use fixtures; these checks do not attest a personal MFA enrollment or actual email delivery.

The Cloudflare validation build and asset-packaging dry run also pass. They compile local artifacts only; no production deployment or release attestation was performed.

## Checkpoint 3: sandbox backend

Eleven reviewed migrations and all 13 current functions are applied/deployed to the sandbox. `release_version()` returns `2026-10-05-sandbox-ops-1`. The original three accounts and one listing remain; rentals and credit entries remain zero. One verified repository-owner account has one audited operator grant; it has no verified MFA factor yet. No other account was granted access.

Automatic approval review initially rejected the historical hardening migration because it bundled removal of deprecated AI objects with financial/security changes. A read-only check proved that legacy AI usage, rentals and credit entries were empty. Reapplication added a transaction guard that aborts if any of those tables contains rows; it passed without deleting user or financial records. Do not reuse that sandbox guard on production or replay existing migrations there.

Maintenance credentials are in Vault, with a hashed authorization credential and the exact sandbox endpoint stored in the private schema. Reconciliation, deadlines and notification capture run every five minutes; in-app reminders run every fifteen minutes. A real worker probe returned HTTP 200 with one preview captured, zero emails, zero failures and outbound delivery disabled. A second invocation does not duplicate an already captured notice. The in-app operator setup notice awaits the user's authenticator enrollment.

HTTP checks confirmed twelve user/maintenance endpoints reject unauthenticated requests with 401, the webhook rejects a missing signature with 400 and Support rejects an untrusted origin with 403. Ordinary and anonymous roles cannot execute operator grants, case actions/history, delivery claims/status or retries directly. These probes do not create rentals or payments.

Retired remote `identify-tool`, `prepare-photo` and the one-time `stripe-setup` installer now return 410 using the retained retirement source in `supabase/retired/index.ts`. `stripe-worker` and its installed Sync cron job remain active; the current combined webhook still uses that integration. The connected API cannot delete remote functions, so permanent removal requires administrative access. Do not reinstall Stripe Sync over the validated application webhook.

The security advisor found three installed Stripe helpers with mutable search paths. A conditional migration pins those helpers to `pg_catalog`; a database test verifies their trigger/rate-limit behavior remains intact. Those three warnings are cleared. The remaining advisories are documented controls: [private tables intentionally have no client RLS policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [the own-account wallet summary deliberately uses a definer function with identity/session checks](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [native leaked-password protection awaits an approved eligible plan](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Checkpoint 4: GitHub/provider controls

Prepared configuration is reviewable in `configuration/`:

| Control | Desired setting | Activation status |
| --- | --- | --- |
| Main | PR required, current-branch checks `validate (22)` and `validate (24)` from GitHub Actions app 15368, resolve conversations, enforce for administrators, prevent force pushes/deletion | Needs GitHub Settings/API administration access |
| Existing test branch | Prevent force pushes/deletion; keep normal staging pushes possible | Needs GitHub Settings/API administration access |
| Password policy | Minimum 12 characters; require current password and reauthentication for changes; preserve optional ordinary-user MFA | Needs sandbox Auth dashboard access |
| Native breached passwords | Enable only after an explicitly approved Pro upgrade | Unavailable on the current Free plan |
| Sandbox web hosting | GitHub Pages source = GitHub Actions; allow the existing test branch in the `github-pages` environment; no production custom domain | Needs Pages settings verification/setup |
| Operator activation | User enables and verifies an authenticator from Profile | Requires the user's device/code |
| Real email/SMS | Select provider, sender, delivery contract, preferences and operational monitoring | Deferred; sandbox previews only |

`node scripts/configure-branch-protection.mjs` prints a plan without network writes. On a trusted workstation, an authorized administrator can supply `GITHUB_ADMIN_TOKEN` with repository Administration:write and add `--apply`. Both existing rules are read before a write; stronger existing rules are retained or flagged for review. Tokens never appear in source or command output. The connected code tool does not expose branch-rule or Auth-policy writes.

After activation, edit the existing test branch and open its PR into main. A single maintainer cannot approve their own PR, so the prepared policy requires zero external approvals while still requiring the PR and both checks. Do not require the post-merge Cloudflare deployment status as a pre-merge check. Production deployment still needs its matching backend version, exact-main CI and the existing release controls. No production promotion is part of this checkpoint.

## Remaining pilot roadmap

1. Finish Pages, branch rules, native free-plan Auth settings and the operator's authenticator. Rehearse own-case appeals, missed handoffs, return disputes and delivery retries in the sandbox.
2. Designate a backup operator and confirm response coverage; choose transactional delivery only when its recipients, provider and sender are authorized. Prove delivery idempotency and failed-job recovery before enabling real messages.
3. Complete the business/insurance/terms/privacy/tax and Stripe acceptance decisions in `PRODUCTION-ROADMAP.md`. Keep paid launch blocked while those decisions remain open.
4. Run an invitation pilot with conservative item values/categories, physical condition evidence, actionable returns and complete ledger/provider reconciliation. Measure repeat rentals, support time and losses against the 5% platform margin.
5. Promote through a reviewed test-to-main PR only after the pilot and production backend/configuration match. Passing fixtures alone is not a paid-launch decision.
