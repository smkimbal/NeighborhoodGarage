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
| Branch control → Production branch | main |
| Root directory | Repository root |
| Build command | npm ci --engine-strict && npm run check:cloudflare |
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
installs dependencies). If you keep Cloudflare's automatic dependency installation,
leave SKIP_DEPENDENCY_INSTALL unset and use npm run check:cloudflare as the build
command instead. Choose one install path to avoid installing everything twice.
The existing npm ci && npm test && npm run check:edge && npm run build:cloudflare
command also remains valid; the compatibility fix does not require changing it.

The repository's .node-version selects Node 22. ZXing is pinned to 0.21.3, which
supports this runtime; versions 0.22.0 and 0.23.0 require Node 24. The local scanner
supports both Node's CommonJS import shape and the browser's ES module bundle.
The production validation workflow tests Node 22 and 24 and performs a browser
walkthrough and Wrangler dry run on Node 22. It does not publish a GitHub website.

Verification on October 2: a clean install with --engine-strict succeeded on
Node 22.23.3 / npm 10.9.9. All 26 tests, all nine Edge Function checks, the production
build, the browser walkthrough (including real local OCR and QR decoding), and
the pinned Wrangler dry run passed. Wrangler used only dist-production; the
largest asset is 3,905,767 bytes, below the 25 MiB limit. The remaining
node-domexception deprecation warning is a transitive development dependency of
the Supabase CLI. It does not fail installation and is not part of the frontend.
These are local verification results; Cloudflare's build/deployment must still
finish successfully for the pushed production commit.

Public production Supabase URL and publishable key default
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
- Stripe stays in sandbox. Production endpoint we_1UMasLRsHH5z9atPyjeqkeJQ
  uses the production Vault signing secret provisioned on October 3. The Edge
  STRIPE_WEBHOOK_SECRET remains a supported override. Signed probes and a real
  checkout-expiration delivery have passed; see VERIFICATION-2026-10-03.md.
- See VERIFICATION-2026-10-01.md for tested payments and outstanding verification.

## Domain and future releases

In the Worker Settings → Domains & Routes, add neighborhoodgarage.net as a Custom
Domain and follow Cloudflare's DNS/HTTPS setup. Preserve existing email DNS records.
The production backend permits this domain, not arbitrary workers.dev previews.
Do not configure this domain on GitHub Pages.

Cloudflare builds and hosts the application. GitHub holds source only for this
production deployment. Keep neighborhood-garage-test and its GitHub Pages
sandbox active. Merge reviewed changes into main. Main is the canonical production branch;
keep neighborhood-garage-test for the test build. Set the Cloudflare production
branch to main so future commits deploy automatically.
Use Cloudflare deployment rollback for a bad frontend release; database changes
need a separate recovery plan.

## Pages alternative

If creating a Pages project instead, connect the main branch, use the same
build command/environment, set output directory dist-production, and omit a deploy
command. Do not combine those Pages settings with the existing Workers build.
The release:prepare/release:publish scripts publish exact reviewed assets to the
same Worker and are an optional manual release path.

References:
- https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
