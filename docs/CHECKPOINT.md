# Community restoration checkpoint

Branch: `neighborhood-garage-zip-2026-09-28`. Starting commit: `54349ea`.

Restored: mobile navigation, nearby list/map and radius filtering, approximate tool coordinates, reviews, earned owner/renter badges, listing earnings, tool QR codes, secure chat with draft preservation, AI identification/autofill, optional background removal, original-photo retention and AI-assisted return comparison with mandatory owner approval.

Backend changes: repaired optional-MFA enforcement (remote policies had drifted to `true`), removed payout-account access from listing RLS, validated evidence ownership, protected active tools, transactional credit reservation/refunds, signed and retryable webhook handling, Accounts v2 Connect onboarding, sandbox key validation, actionable Edge Function errors, separate retryable owner payouts.

This commit is the requested **pre-journey checkpoint**. Build and type checks are separate from the full user simulation, which starts after this commit. Final results and remaining provider configuration appear in `docs/VALIDATION.md`.
