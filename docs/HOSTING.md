# Hosting and releases

| Environment | Host | Backend | Source branch |
| --- | --- | --- | --- |
| Production | Cloudflare Worker `neighborhoodgarage`, https://neighborhoodgarage.net/ | Supabase `zbbespojxxoheavodtqs`; Stripe sandbox | `main` |
| Sandbox | GitHub Pages, https://smkimbal.github.io/NeighborhoodGarage/ | Supabase `ilfpugydxlzmmxjfrmrv`; Stripe sandbox | `neighborhood-garage-test` |

Cloudflare Workers Builds installs locked dependencies, validates and builds the
production frontend, then runs the pinned Wrangler deploy command. The committed
`wrangler.jsonc` uploads only `dist-production`. Follow
[CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md) for the existing Worker's settings.
GitHub Actions validates `main`; its Pages deployment is restricted to the
sandbox branch. Root sandbox assets and its public configuration remain separate.

The production build includes only the production public Supabase URL/key and
canonical site URL. Backend service keys, Stripe keys and webhook signing secrets
belong in Supabase's secret store. Deploy backward-compatible database migrations
and Edge handlers before publishing frontend changes. Reconcile historical
migration names/content before using CLI `db push`: earlier connector deployments
assigned timestamps different from the original local files.

An optional manual release uses the same Worker:

```sh
npm ci --engine-strict
npm run release:prepare
# Review the tested dist-production artifact and production-release.json.
# Inject scoped Cloudflare credentials through the runner's secret store.
npm run release:publish
```

Prepare runs unit/database checks, Edge type checks, the production build and
browser journeys. Publish verifies both the asset inventory and Wrangler
configuration digest, then uploads those exact bytes without rebuilding.
Cloudflare account ID and a scoped API token must already be in the trusted
runner environment. No Pages project is created or published by this path.

Verify the deployed commit and actual-domain asset hashes after a release. Keep
the prior known-good Cloudflare deployment for frontend rollback; it does not undo
database migrations. Preserve existing mail DNS and the separate GitHub sandbox.

Stripe remains in sandbox. Verify signed production-project webhook delivery,
actual-domain signup/reset emails and two-account rental/return journeys before
accepting customers. Local provider simulations do not establish email delivery
or real payment fulfillment. See [RENTAL-WORKFLOW.md](RENTAL-WORKFLOW.md).
