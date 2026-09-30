# Cloudflare production migration — 2026-09-30

## Deployment separation

| Environment | Hosting | Backend | Updates |
| --- | --- | --- | --- |
| Sandbox | GitHub Pages: https://smkimbal.github.io/NeighborhoodGarage/ | Existing Supabase ilfpugydxlzmmxjfrmrv and Stripe sandbox | Existing branch/Actions |
| Production (prepared, not provisioned) | Cloudflare Pages: https://neighborhoodgarage.net/ | Separate Supabase project; payment activation remains a separate launch step | Reviewed direct-upload artifact from trusted workstation or non-GitHub CI |

No Cloudflare project, custom-domain binding, DNS record, production database or live payment configuration has been changed in this checkpoint. Cloudflare account access is still required. Production is independent of GitHub Pages and GitHub Actions; GitHub remains the experimentation/source checkpoint. Copy an approved release into a private production workspace if production source must also be kept outside GitHub.

## One-time Cloudflare setup

Use the existing account that owns neighborhoodgarage.net. Install Wrangler 4.145.0 on the trusted release runner (`npm install --global wrangler@4.145.0`). Authenticate and create a **Direct Upload** Pages project named `neighborhood-garage-production`, production branch `production`:

```sh
wrangler pages project create neighborhood-garage-production --production-branch production
```

Do not connect this project to GitHub. In Pages → Custom domains, associate `neighborhoodgarage.net` with this project **before** creating the DNS target. Let Cloudflare create the required apex record after reviewing existing DNS; preserve mail records. Add `www.neighborhoodgarage.net` as another custom domain and configure a permanent redirect to the apex. Wait for domain verification and HTTPS certificate activation. Do not add a CNAME file to the GitHub sandbox.

Use a scoped Cloudflare API token with Account / Cloudflare Pages / Edit, restricted to this account, on the release runner. Keep `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in its secret store, never source or browser config. DNS changes are separate from routine releases.

## Production backend and launch prerequisites

Create a separate Supabase project; apply the repository migrations and deploy its Edge Functions (including the combined Stripe webhook). Do not copy sandbox customer/test records. Set production Edge secret `NG_DEPLOY_TARGET=production`: the shared runtime then accepts only `https://neighborhoodgarage.net`, while the existing sandbox defaults stay unchanged. Preview domains are intentionally not trusted.

Set production Auth Site URL and allowed redirect URL to `https://neighborhoodgarage.net/`. Configure production mail delivery and verify signup, confirmation, reset and optional MFA on the actual domain. Configure storage and verify RLS with two unrelated test accounts. Keep the sandbox project's current GitHub redirect intact.

Stripe live activation is not part of this hosting change. Current app text and workflows still describe sandbox payments. Before a commercial launch, complete owner onboarding → renter payment → return → approval → payout tests, update payment disclosures for the selected mode, configure a production webhook and its signing secret, and verify production keys/account separately. Hosting on Cloudflare alone does not make payment processing production-ready.

## Repeatable release (no GitHub deployment dependency)

On a trusted workstation or non-GitHub CI runner, install locked dependencies with `npm ci`. Supply these public build settings through the runner environment:

```sh
export NG_PUBLIC_SITE_URL=https://neighborhoodgarage.net/
export NG_PUBLIC_SUPABASE_URL=https://PRODUCTION_PROJECT.supabase.co
export NG_PUBLIC_SUPABASE_KEY=sb_publishable_REPLACE_WITH_PRODUCTION_PUBLIC_KEY
npm run release:prepare
```

The command runs unit/contract tests and Edge type checks, builds `dist-production/`, and creates a SHA-256 inventory in `production-release.json`. It rejects missing production config, the existing sandbox project and secret keys. It does not modify the committed sandbox config or root assets. Only explicitly enumerated public values enter the browser bundle.

Review/preview this artifact and run the browser journey plus actual-domain acceptance before business launch. The automated checks do not replace provider integration tests. Preserve the artifact and manifest in the private release runner's artifact store. Then, with Cloudflare credentials injected:

```sh
npm run release:publish
```

Publishing verifies the inventory and uploads the exact reviewed bytes to the explicit production project/branch. It does not rebuild and cannot accidentally choose the experimental Git branch. In CI, keep prepare and publish separate, with a protected production approval between them. No production workflow is added to GitHub.

For rollback, select the previous known-good production deployment in Cloudflare Pages. Frontend rollback does not undo database changes; use backward-compatible migrations and independent database backups.

## Acceptance before DNS launch

Check HTTPS, apex/www canonical behavior, config origin, static headers, email callbacks, profile, listing/photo upload, GPS/map, private chat, deletion protections and checkout/Connect callbacks. Verify the GitHub sandbox remains unchanged. Do not direct paying customers to an unverified production backend.

References: https://developers.cloudflare.com/pages/get-started/direct-upload/ and https://developers.cloudflare.com/pages/configuration/custom-domains/.
