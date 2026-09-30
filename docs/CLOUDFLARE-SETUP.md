> Current backend status: see [PRODUCTION-BACKEND-STATUS.md](PRODUCTION-BACKEND-STATUS.md). The project now exists, but migration/security approval and provider setup are incomplete. Cloudflare deployment is intentionally gated.

# Neighborhood Garage — production branch deployment

The `production` branch starts at test-branch commit `4f4261bcd4939207e02a7a40f6070daf89f82611` and adds production deployment setup. GitHub stores source; **Cloudflare builds and hosts the live website**. The experimental branch and its GitHub Pages URL remain separate and active. This supersedes the previous preference for Direct Upload only.

## 1. Configure the production backend first

Use a separate Supabase project. Do not use sandbox project `ilfpugydxlzmmxjfrmrv` for business customers. Apply the repository's `supabase/migrations`, deploy its Edge Functions, and configure their provider secrets. The repository includes schema and functions, not a running production database.

Set these settings in the **production Supabase project**, leaving sandbox settings unchanged:

- Auth → URL Configuration: Site URL `https://neighborhoodgarage.net/`; allow that exact redirect URL.
- Edge Function secret `NG_DEPLOY_TARGET=production` enables the existing exact-origin allowlist for the new domain.
- Configure email delivery and verify confirmation/reset links.
- Obtain the project's HTTPS URL and **publishable** key for the Cloudflare build below. Never use its secret/service-role key in Cloudflare's frontend build settings.

Stripe remains a separate launch decision. Existing workflows/disclosures still describe sandbox payments. Do not enable real charges until owner onboarding, checkout, return, deposit credit and payout have been validated and production payment settings/disclosures are ready. Hosting migration does not automatically switch Stripe live.

## 2. Create the Cloudflare Pages project

1. Sign into the Cloudflare account that owns `neighborhoodgarage.net`.
2. Open **Workers & Pages → Create application → Pages → Connect to Git** (choose Pages, not a Worker deployment).
3. Authorize Cloudflare's GitHub integration for only `smkimbal/NeighborhoodGarage` and select that repository.
4. Set project name to `neighborhood-garage-production` and **Production branch to `production`**, not `main` or the test branch.
5. Configure:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root / leave blank |
| Build command | `npm ci && npm test && npm run check:edge && npm run build:cloudflare` |
| Build output directory | `dist-production` |

6. Add these **Production** environment variables before deploying:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NG_PUBLIC_SITE_URL` | `https://neighborhoodgarage.net/` |
| `NG_PUBLIC_SUPABASE_URL` | `https://zbbespojxxoheavodtqs.supabase.co` (also defaults in the build) |
| `NG_PUBLIC_SUPABASE_KEY` | `sb_publishable_f0Tc0Qz4sWlCRaT58d2qlA_ZKRi-7Ot` (public; also defaults in the build) |
| `NG_PRODUCTION_BACKEND_READY` | Set to `true` only after the backend checklist is complete |

7. Save and deploy. A successful build produces the static frontend on Cloudflare. Missing/invalid production configuration intentionally fails the build.
8. In project **Settings → Builds → Branch control**, verify `production` is the production branch and set **Preview branches to None**. This prevents experiments and pull requests from deploying with production settings. Keep production automatic deployments enabled.

No Cloudflare API token is needed in this Git-integrated build. Supabase service keys, Stripe secrets and webhook signing secrets belong only in the backend's secret store.

## 3. Connect neighborhoodgarage.net

1. Open the Pages project → **Custom domains → Set up a custom domain**.
2. Enter `neighborhoodgarage.net` and follow Cloudflare's DNS confirmation. Associate it in Pages first; do not create a standalone CNAME without the Pages custom-domain association.
3. Review the proposed web record against existing records. Preserve MX/TXT/email records. Cloudflare manages the apex record for a zone in the same account.
4. Wait until the domain status and HTTPS certificate are active.
5. If you also want `www`, add `www.neighborhoodgarage.net` and configure a permanent Cloudflare redirect to `https://neighborhoodgarage.net`, preserving the path/query.
6. Test the real domain: email signup/verification, reset, profile, photos/listings, GPS/map, private chat, account deletion guards and sandbox checkout/Connect callbacks. The production backend intentionally does not trust arbitrary `pages.dev` preview origins.

Do not set this domain in GitHub Pages. Leave GitHub Pages connected to `neighborhood-garage-zip-2026-09-28`. The production branch's GitHub Pages workflow is guarded so manually running it cannot publish production assets there.

## 4. Publish future updates

1. Experiment on `neighborhood-garage-zip-2026-09-28` and test its sandbox.
2. Open a pull request **into `production`** with only the changes ready for release. Review any build/config conflicts and preserve production deployment settings.
3. After review, merge. Cloudflare automatically tests/builds the new `production` commit and deploys it on success. No manual ZIP upload is required.
4. Verify the deployment and user journey. If necessary, use Cloudflare Pages → Deployments to roll back to a previous successful production deployment. Database migrations require independent backups and backward-compatible changes.

Recommended repository rule: protect `production` from deletion/force pushes and require a pull request. This rule is not configured automatically in this checkpoint. Provider/database configuration is also not created merely by creating the branch.

## Downloaded source package

`NeighborhoodGarage-production-source.zip` is an archive of the production branch, including source, lockfile, migrations and these instructions. It contains no installed dependencies or provider secrets. **It is a source package, not a ready-to-upload website ZIP**: Cloudflare must build it with the production public configuration above.

For a local build instead, unzip it, install Node 22, run `npm ci`, set the three public variables, and run the build command from the table. Upload only the contents of `dist-production/`, never the repository root. Direct Upload is an alternative project type and cannot later be switched into Git integration; use Git integration for the automatic branch updates requested here.

## Status at packaging

Branch and configuration are prepared. Cloudflare account setup, domain binding, DNS, production Supabase provisioning and commercial payment activation have not been performed. The cloud browser was blocked at Cloudflare security verification.

Official references:
- https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- https://developers.cloudflare.com/pages/configuration/branch-build-controls/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
