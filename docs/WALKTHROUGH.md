# Walkthrough checkpoint — September 29, 2026

Completed against the current working branch with a real Chromium browser and controlled API responses. Separate tests ran against the actual Supabase database, inside transactions that rolled back all fixtures. No customer accounts, messages, listings, or balances were changed.

## Browser results

- Account creation shows the confirmation-email state; sign-in opens profile setup without a reload.
- Profile creation reaches the marketplace without mandatory MFA. Optional MFA survives focus changes and resumes its existing pending factor.
- Account/Badges tabs, earned badges on cards and public neighbor pages work.
- Navigation fits 320, 375, 768 and 1280 pixel widths.
- GPS sorting, radius filtering, map tool pins and the private position marker work with browser-provided test coordinates.
- Chat preserves text after a failed send, retries successfully, displays the sent message, and keeps drafts across navigation.
- Rental totals and deposit explanations display correctly. Pickup reports a bad tracking code with the server reference, accepts the correct code, and allows photographed agreed drop-off.
- Owner approval, deposit-credit display, pending-payout retry, and post-rental review interfaces work.
- Owner listing creation uploads the original evidence path, rounds GPS coordinates, shows earnings and a QR code. Editing, removal and paused restoration work.
- A photo unsuitable for local background removal gives a fallback; manual listing remains usable.
- Expired verification links show guidance; password-reset requests use the Auth flow.
- Sign-out survives reload. A delayed reputation request cannot reopen account subscriptions after sign-out.
- No uncaught JavaScript errors remained in the final journey.

## Reproduced and fixed

Leaving Explore while GPS was pending caused `Cannot set properties of null (setting 'textContent')`. Location responses now check that their screen and account are still active.

Account refresh previously assigned global data before asynchronous photo/reputation loading finished. It now prepares results separately and checks the active account and refresh sequence before committing them. Delayed message fetches also check account identity.

The browser journey is included in the GitHub Actions test job before deployment.

## Live database results

`tests/database-contract.sql` passed: atomic credit reservation, request/event replay, payment amount checks, delayed payment events, pickup permissions, photo-path ownership, idempotent owner approval and deposit credit, independent payout state, payment failure and review attribution.

`tests/community-access.sql` passed: sender/recipient message access, third-party isolation, sender-spoof rejection, bounded reputation batches and denied anonymous reputation access. The aggregate function intentionally remains SECURITY DEFINER to compute public reputation across private rental rows; its warning is not treated as automatically resolved.

## Remaining external acceptance checks

This run did not create verified email accounts or complete Stripe-hosted owner onboarding, card checkout, or bank payout. Browser API responses model those UI states; they do not establish provider integration success. Real two-account Realtime delivery, email delivery, physical phone GPS permissions, camera scanning, and photo-identification accuracy need external acceptance testing with appropriate test accounts/devices. Earlier Stripe webhook verification is recorded separately in operations documentation.

Security Advisor still reports leaked-password protection disabled, the intentional reputation aggregate, and mutable search paths on three Stripe Sync-managed functions. No managed Stripe functions or Auth settings were changed during this walkthrough. Leaked-password remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

Reviewed logs contained earlier expired/reused email links, MFA name conflicts and Stripe Sync initialization rate limiting. This pass does not claim those historical log entries are fresh failures or that all provider settings have been repaired.

## Reproduce

```sh
npm ci
npm test
npm run check:edge
npm run build
npx playwright install --with-deps chromium
node tests/walkthrough.browser.mjs
```

Run the SQL checks only against the intended sandbox. Both are rollback-only fixtures. GitHub Pages remains active; no Cloudflare migration was performed.
