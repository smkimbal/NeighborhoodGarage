# Hosting preparation checkpoint — 2026-09-29

GitHub Pages remains the active sandbox at https://smkimbal.github.io/NeighborhoodGarage/.
The working branch is `neighborhood-garage-zip-2026-09-28`. No Cloudflare project, DNS change, custom domain, or migration has been performed.

## Prepared in this checkpoint

The static build still defaults to the committed GitHub callback. A future build can set `NG_PUBLIC_SITE_URL=https://your-chosen-domain.example/` to override only the public Auth callback in dist/config.js. The build rejects HTTP, credentials, query strings and fragments, and preserves subpaths. This variable is public, not a secret. No arbitrary environment variables are serialized into browser assets.

The build copies `_headers` into dist for future Cloudflare Pages static responses. It supplies frame protection, content-type protection, referrer policy and same-origin camera/GPS permissions. This is a limited CSP, not a complete script-source policy. GitHub Pages does not apply this file. Camera and GPS still require browser permission and HTTPS.

## When a migration is authorized

1. Use Node 22, build command `npm ci && npm test && npm run check:edge && npm run build`, output directory `dist`.
2. Set NG_PUBLIC_SITE_URL to the chosen HTTPS domain including its trailing slash. Configure the exact callback in Supabase Auth Site URL and Redirect URLs before testing email verification and password reset. Do not allow all preview domains.
3. Update and deploy the backend's exact CORS/Stripe return-URL allowlist in `supabase/functions/_shared/runtime.ts`. It currently permits GitHub and local previews only. The frontend build variable does not change this backend restriction.
4. Verify sign-up, confirmation, reset, optional Profile MFA, signed photo access, GPS, map, chat, Checkout, Connect return/refresh links and owner payout on that origin.
5. Only after approval, change DNS and the active hosting destination. Keep the GitHub sandbox for rollback until the new origin passes acceptance checks.

Cloudflare references: [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/) and [static response headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Review items still open

- Keep MFA enrollment optional and located in Profile security.
- Enable Supabase leaked-password protection in Auth settings if available; SQL cannot change this Auth setting.
- Review and test the intentionally privileged aggregate `reputation_summary` function before broad public access.
- Finish a complete sandbox owner onboarding, renter payment, pickup, return, approval and payout journey.
- Consolidate duplicate Pages publishing via repository Settings → Pages → Source → GitHub Actions after confirming the Actions deployment succeeds. This repository administration setting was not changed.
- Add a separate protected, manually triggered backend deployment workflow after its environment, review gate and secrets are configured.
- Messaging uses TLS and participant RLS, not end-to-end encryption. Listing photos are readable by authenticated users under Storage policies.

## Validation limits for this checkpoint

The local execution environment was unavailable. Changes were prepared through GitHub; no new browser journey or local backend test was executed. CI results must be checked on the resulting commit. This checkpoint does not claim the remaining application review is complete.
