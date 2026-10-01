# Cloudflare deployment — existing Worker

The October 1 log comes from **Workers Builds**, not Pages. The build succeeded,
but Wrangler auto-detected the repository root as its asset directory and tried
to upload node_modules. The committed wrangler.jsonc now restricts deployment to
dist-production. No source files, dependencies or backend secrets are uploaded.

## Configure the existing neighborhoodgarage Worker

Open Workers & Pages → neighborhoodgarage → Settings → Build.

| Setting | Value |
| --- | --- |
| Git repository | smkimbal/NeighborhoodGarage |
| Branch control → Production branch | production |
| Root directory | Repository root |
| Build command | npm ci && npm test && npm run check:edge && npm run build:cloudflare |
| Deploy command | npm run deploy |
| Non-production branch builds | Disabled |

Save these settings before retrying the latest production commit. Do not use
bun run build: that invokes the default sandbox build. Workers Builds does not
use a build command specified inside Wrangler configuration. The asset output is
set in wrangler.jsonc, not in a Pages output-directory field. Worker name must
remain neighborhoodgarage to match this configuration. Wrangler is version-pinned
in the deploy script so npx cannot silently select a newer release.

## Build environment

Set NODE_VERSION=22 and SKIP_DEPENDENCY_INSTALL=true (the explicit npm ci above
installs dependencies). Public production Supabase URL and publishable key default
in scripts/build-cloudflare.mjs. NG_PUBLIC_SITE_URL=https://neighborhoodgarage.net/
is the public site URL. Never put Stripe or Supabase service secrets in frontend
build settings.

NG_PRODUCTION_BACKEND_READY is optional. When it is absent or not true, the build
prints a reminder and still creates the production frontend. Deploy the site so
real-domain email and sandbox payment callbacks can be tested. This flag only
acknowledges verification; it does not check backend health or change payment mode.
The production domain, database and public-key validation still fail on invalid
configuration. Complete the following checks before accepting customers:

- Production schema and Edge Functions are deployed.
- Auth Site URL points to https://neighborhoodgarage.net/; verify signup and reset
  email delivery with an actual inbox.
- Stripe stays in sandbox. Copy the signing secret for production endpoint
  we_1ULkQ8RsHH5z9atPufFnwB0d into production Supabase STRIPE_WEBHOOK_SECRET.
  Confirm a signed event reaches stripe-webhook successfully.
- See VERIFICATION-2026-10-01.md for tested payments and outstanding verification.

## Domain and future releases

In the Worker Settings → Domains & Routes, add neighborhoodgarage.net as a Custom
Domain and follow Cloudflare's DNS/HTTPS setup. Preserve existing email DNS records.
The production backend permits this domain, not arbitrary workers.dev previews.
Do not configure this domain on GitHub Pages.

Cloudflare builds and hosts the application. GitHub holds source only for this
production deployment. Keep neighborhood-garage-zip-2026-09-28 and its GitHub Pages
sandbox active. Merge reviewed changes into production; Cloudflare automatically
builds and deploys that branch. There is no need to merge production into main.
Use Cloudflare deployment rollback for a bad frontend release; database changes
need a separate recovery plan.

## Pages alternative

If creating a Pages project instead, connect the production branch, use the same
build command/environment, set output directory dist-production, and omit a deploy
command. Do not combine those Pages settings with the existing Workers build.
The release:prepare/release:publish scripts are the older Pages Direct Upload
alternative and are not used by this Worker's automated deployment.

References:
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
