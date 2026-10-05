# Neighborhood Garage production roadmap

Working plan — October 5, 2026. Sandbox operator, notification, password-screening and provider-control progress is recorded in [SANDBOX-OPERATIONS.md](SANDBOX-OPERATIONS.md). Engineering validation is recorded in HARDENING-VALIDATION.md; public paid launch still requires the operating and provider acceptance gates below. The goal is a small, reliable, locally dense marketplace before geographic expansion.

## Minimum viable paid launch

Start with an invitation-only neighborhood, a limited catalog of low-risk tools, verified adult participants, capped rental/deposit values, and staffed support. Choose launch geography and eligible categories before enabling real money. Suggested exclusions for the first pilot include chainsaws, firearms, hazardous materials, lifting/life-support equipment, and tools whose safe use requires a professional license. These are proposed product restrictions, not a statement of law.

Required user journey: owner listing with condition evidence → dated reservation → owner approval and agreed meeting location → clear rental/deposit/payment-fee quote → verified payment → item-specific QR pickup → planned return window → return evidence → owner physical-receipt confirmation and inspection → prompt undisputed deposit return → review. Extension requests need owner approval. Early returns reduce unused rental principal proportionally; keep processing-fee refund terms separately disclosed. The same QR identifies the item, never acts as an authorization token.

A rental must always identify who acts next. Nonreceipt and contested deductions go to a named support operator. A deadline must not silently refund a tool that is still missing. Operators must be able to see evidence, record reasons, contact participants, restrict abusive accounts, and reconcile the ledger without editing history.

## Milestones and acceptance gates

| Phase | Deliverables | Exit gate |
|---|---|---|
| 0 — Engineering hardening | F1–F9 changes; payment reconciliation; fee receipts; support queue; photo privacy; pagination; controlled releases | Authorized database, payment, browser and recovery validation passes; zero unresolved money-loss issues; backend/frontend release manifest matches |
| 1 — Operating setup | Launch geography/category rules, entity/accounting setup, terms/privacy/rental agreement, insurance scope, tax and stored-credit review, staffed support | Written decisions on fee eligibility and credit/cash-out model; coverage accurately described; incident and dispute procedures rehearsed |
| 2 — Invitation pilot | Suggested 20–30 households and 30–50 inspected listings in one small area; conservative value limits | Suggested first 50 completed rentals with every ledger/provider difference explained, every return actionable, and support deadlines staffed |
| 3 — Local paid MVP | Repeatable owner acquisition, renter onboarding, availability search, reliable messaging/reminders, measurable unit economics | Positive contribution per rental over a representative period, acceptable repeat usage, no unresolved critical incidents |
| 4 — Expand selectively | More neighborhoods/categories, better search pagination, risk-based limits and automation | Support and loss costs remain covered; safety requirements and insurance reviewed for each category/region |

Numeric pilot targets are planning assumptions, not forecasts or industry benchmarks. Reassess them after real observations.

## Profitability at a 5% rental fee

Keep the promised 5% rental fee distinct from renter-paid eligible external-payment costs. Deposits and prepaid credits are liabilities, not revenue. Fee reimbursement is not additional rental margin.

For a $40 rental, 5% produces $2 of platform revenue before support, hosting, insurance, fraud/chargeback losses, refunds, tax/accounting, and acquisition costs. Even if eligible processor costs are fully recovered, $2 is not guaranteed profit. Model:

`contribution = 0.05 × earned rental principal − support cost − insurance allocation − unrecovered payment/loss cost − variable infrastructure cost`

`monthly break-even rentals = monthly fixed operating cost ÷ positive contribution per rental`

Illustrative assumptions: at $1 contribution per rental and $300 monthly fixed cost, break-even is 300 rentals/month. If contribution is zero or negative, more volume makes the problem worse. Measure actual support minutes and losses instead of assuming they vanish because the renter pays processing.

Prioritize repeat rentals, dense local inventory, reliable pickup, bundles/multi-day bookings, and referrals after successful returns. Consider optional owner subscriptions for inventory/calendar tools only after users demonstrate demand. Do not sell favorable trust badges, reward only positive reviews, use deposits as profit, or rely on forfeited credits to fund operations. Review incentives should reward honest participation regardless of rating.

Track weekly: reservation-to-approval conversion, approval-to-payment conversion, fulfillment/cancellation rate, on-time returns, repeat renters, active owners, response time, disputes per completed rental, unrecovered loss dollars, contribution per rental, outstanding credit liabilities, and reconciliation differences. Keep acquisition cost below observed lifetime contribution, not projected rental volume.

## User safety and liability workstream

- Define age, prohibited-item, training, recall, maintenance, accessory and protective-equipment requirements. Require owners to describe defects and confirm safety-critical parts/guards are present. Make unsafe listings reportable and removable.
- Add category-specific handoff checklists and manufacturer manual links. Teach safe setup and shutoff without implying that an AI image assessment certifies safety. Review badges indicate marketplace behavior, not technical qualifications or insurance coverage.
- Encourage daylight/public or clearly agreed pickup locations. Reveal exact location only to the authorized participants. Offer report/block and escalation even when a restricted account cannot transact. Do not imply support is emergency response.
- Establish injury, theft, damage, recall and harassment incident procedures, evidence retention, access control and escalation responsibilities. Preserve necessary evidence under a documented retention policy; avoid retaining unrelated identity/location information indefinitely.
- Have qualified local counsel review the rental agreement, assumption-of-risk language, deposit/damage standards, early-return/cancellation terms, privacy/retention, fee disclosures and jurisdiction-specific marketplace obligations. Entity formation and waivers should not be treated as substitutes for operational safety or insurance.
- Have a licensed insurance professional confirm what covers the platform, owners, renters, tools, theft, bodily injury and exclusions. Do not advertise “included insurance” until there is an actual applicable policy and accurate claims process.
- Confirm tax reporting, rental taxes, identity verification and Stripe's approval of prepaid credits plus withdrawals before real-money launch. Maintain a reconciled cash reserve for credit liabilities and disputes; do not describe the ordinary platform Stripe balance as escrow or a protected bank account.

## After MVP

Improve geographic ranking within bounded server-side search and optimize per-thread message pagination before marketplace scale. Add operator analytics, automated reconciliation exceptions, push/email delivery observability, account closure/privacy requests, and category-specific risk controls. Consider verified owner training, repair/maintenance records, recall alerts, multiple pickup locations, and repeat-booking shortcuts after the core handoff and return process is reliable.

Delay broad categories, geographic expansion, complicated loyalty rewards, and automatic AI damage decisions until safety/support economics support them.

## References to verify during launch planning

- Stripe pricing and the actual signed merchant/Connect agreement: https://stripe.com/pricing
- Stripe Connect platform balance and negative-balance responsibilities: https://docs.stripe.com/connect/account-balances
- Stripe restricted businesses and approval requirements: https://stripe.com/legal/restricted-businesses
- CPSC recalls and product safety warnings: https://www.cpsc.gov/Recalls
- SBA business launch resources, including insurance planning: https://www.sba.gov/counseling/launch-your-business/

This roadmap proposes product and operating decisions. It does not establish legal compliance, bind insurance coverage, or authorize a live fee schedule.
