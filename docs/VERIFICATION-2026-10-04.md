# Profile, trust and credit funding verification

The release fixes selected profile-tab contrast, introduces 22 badges and
independent Bronze–Platinum owner/renter trust stars, enables two-way reviews,
and adds verified Stripe credit funding with an append-only wallet audit.
It retains the existing reservation, photographed-return and early-refund work.

## Automated checks

- All **81 tests pass on Node 22 and Node 24**. This includes real Postgres
  migration/function/RLS execution through PGlite, provider recovery and payment
  receipt checks, refunds/disputes, immutable ledger entries, role isolation,
  1,100-entry balances and stable activity pagination, and two-way reviews.
- Deno checks pass for all 12 Edge Function entrypoints.
- Both full browser journeys pass against the production bundle. They cover
  selected Account/Badges contrast of at least 4.5:1 when hovered/focused, owner
  stars, mobile layouts, verified funding and cashout, ledger totals, owner renter
  reviews, existing reservations, camera/file return photos, extensions, disputes,
  independent receipt/readiness, full-photo zoom, messaging and sign-out.
- Production build and pinned Wrangler 4.145.0 deploy dry-run pass. Browser payment
  transport is a sandbox fixture; it does not prove real bank settlement.

## Production backend

- Applied `20261004030609_trust_tiers_and_verified_credit_funding` to the intended
  production Supabase project, `zbbespojxxoheavodtqs`.
- Deployed all 12 function bundles, including new `credit-funding`, the combined
  Stripe Sync/app webhook, withdrawal and account-deletion handlers. Existing
  custom bearer/MFA and webhook signature checks remain active.
- Expanded this project's sandbox Stripe webhook subscriptions to refunds and
  dispute lifecycle events while preserving its Checkout subscriptions and
  endpoint-specific signing secret.
- Transactional assertions passed for verified topup replay, refund replay,
  withdrawal holds during disputes, won-dispute restoration, blocked ledger edits,
  client-role isolation, wallet totals and owner/renter review attribution. The
  transaction rolled back: the pre-existing six rentals and five ledger entries
  were unchanged.
- The deployed authenticated funding endpoint created an actual **$1 sandbox
  Checkout session**. Checking the unpaid session granted no credits; cancelling
  expired the provider session and left the wallet balance and ledger unchanged.
  The resolved test funding receipt remains in the audit history. No card charge
  or bank transfer was made by this verification.
- Security Advisor no longer reports the exposed reputation SECURITY DEFINER
  warning. Its existing private maintenance-table INFO and leaked-password Auth
  setting warning remain; this release adds no new advisory warning.

## Live funding condition

The existing Stripe sandbox remains active. Live credit funding is blocked until
Stripe approves the prepaid-credit and withdrawal model, followed by an explicit
server approval flag. Credit liabilities, provider receipts, settlement, refunds,
pending transfers and reserve operations must be reconciled before live use.
See [credit funding and reputation](CREDITS-AND-REPUTATION.md).
