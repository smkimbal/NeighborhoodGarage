# Credit funding and community reputation

## Profile and trust

Selected Account, Badges and wallet tabs use dark green with white text. Both
profile tabs remain readable when hovered or focused. Badges now include 22
achievements for sharing, borrowing, careful returns and detailed reviews.

Owner and renter reputation are independent. Only completed rentals with a
confirmed physical return count toward the activity requirement; marking an
item ready for another renter preserves that completion. Owner stars use renter
reviews, and renter stars use owner reviews. All requirements in a row must be
met. The displayed tier can decrease if subsequent reviews lower the average.

| Star | Completed rentals | Reviews | Distinct reviewers | Minimum average |
| --- | ---: | ---: | ---: | ---: |
| Bronze | 3 | 2 | 2 | 4.0 |
| Silver | 10 | 5 | 3 | 4.5 |
| Gold | 25 | 10 | 5 | 4.7 |
| Platinum | 50 | 20 | 10 | 4.8 |

Each participant can publish one review per completed rental. The database
assigns its subject and role; users cannot review unrelated bookings or assign
themselves a rating. Owners see completed rentals awaiting their renter review
in My garage. Reviews of at least 30 trimmed characters count toward review
badges at **any** rating. Badges carry no monetary benefit. Stars are a community
history indicator, not identity verification or an insurance guarantee.

## Add funds, withdraw and audit

Profile → Manage credits offers Add funds, Withdraw and Activity. Funding uses
hosted Stripe Checkout, from $1 to $500 per purchase with a $1,000 rolling daily
limit. Checkout creates a charge in the platform's existing centralized Stripe
account. It is not segregated escrow. Only a verified paid session and succeeded
PaymentIntent with matching account, environment, amount, USD currency and
project metadata create credits. Redirect parameters and pending payments never
grant a balance. Stripe fees and settlement dates are stored separately; the
platform absorbs the processing fee while crediting the requested face amount.

Every movement is an append-only `credit_ledger` entry with a unique reference,
monotonic transaction number and pseudonymous wallet account. Corrections use
compensating entries. User balances are database aggregates of **all** ledger
entries, not a client-side sum limited by API row caps. Activity pages show
received/spent totals, a running balance, timestamps and reference IDs, with
stable 50-entry pagination. Funding receipts retain Checkout, PaymentIntent,
charge and Stripe balance-transaction references.

Creation retries reuse the same funding request and Stripe idempotency key.
Check payment/resume retrieves the provider receipt and recovers uncertain
creation before allowing another charge. Cancel funding expires an open Stripe
session; uncertain or asynchronous payments remain pending until verified.
Expired requests release their creation lease without adding credits.

Withdrawals reserve credits once, then transfer the same amount to the user's
connected Stripe balance. Stripe pays that balance to the bank configured in
Connect, following its settlement and payout schedule. Paying with a card does
not configure a payout bank account. Insufficient available platform funds,
incomplete payout setup or an uncertain response leaves the same withdrawal
retryable; it must not generate a new transfer. Old ambiguous requests require
operator reconciliation before another transfer is attempted.

Signed refund/dispute events are verified against the latest Stripe charge and
dispute. Cumulative refunds and disputed amounts append capped reversals;
duplicate events cannot debit twice. A won dispute restores the disputed portion
without restoring an actual refund. Negative wallets or active disputes pause
new spending and withdrawals. An already completed external transfer can still
be reconciled. Outstanding funding, disputes and withdrawals block account
deletion. Deleted profiles are redacted from settled ledger entries while the
pseudonymous financial history remains auditable.

## Operations and live funding

Keep `STRIPE_MODE=sandbox` for the current environment. Stripe treats prepaid
stored-value credits as a restricted product. Live credit purchases stay blocked
unless Stripe approves **this funding and cash-out model** and the operator sets
`NG_CREDIT_FUNDING_APPROVED=true`. Changing keys alone does not enable them. See
[Stripe's restricted businesses policy](https://stripe.com/legal/restricted-businesses).

Apply the trust/verified-funding migration before deploying `credit-funding`, the
combined `stripe-webhook` and `withdraw-credits`. Redeploy functions importing the
shared runtime. Preserve custom bearer/MFA authentication and Stripe signature
verification; the gateway JWT check remains disabled for these handlers.
Subscribe this project's endpoint to the four existing Checkout events plus
`charge.refunded` and dispute created, updated, closed, funds withdrawn and funds
reinstated events. Do not overwrite another project's signing secret or Sync
handler when configuring the shared sandbox.

Before live approval, establish reserve and reconciliation operations. The
service-only `credit_liability_summary()` reports positive active wallet balances,
negative-wallet receivables, pending transfer liabilities, archived balances and
unreleased rental deposits. Compare those liabilities with the same platform's
Stripe available/pending balances and payment receipts. Negative wallets must
not offset another user's credits. Processing fees, platform payouts, disputes,
Stripe reserves and other charges can reduce central funds; the withdrawal
liquidity check is not a proof that all outstanding credits are fully funded.
Keep enough funds to cover liabilities and reconcile ambiguous transfers and
refunds for deleted accounts by provider reference. Client roles cannot execute
the platform liability report or financial mutation functions.

Validation includes database receipt replay, refunds/disputes, ledger tampering,
role isolation, 1,100-entry totals, two-way reviews, funding recovery, live-mode
approval blocking and phone-sized browser funding/withdrawal flows. Stripe
transport is mocked in automated tests; those results do not establish live bank
arrival or live-product approval.
