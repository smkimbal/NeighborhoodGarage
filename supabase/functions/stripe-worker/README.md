# Retained sandbox Stripe Sync worker

This is the existing installed Sync engine, not a replacement installation.
`installed-worker.js` retains the deployed worker's vendor payload and its Vault
bearer-token authentication. Its wrapper validates the sandbox project, mode and
test credential before dynamically loading that payload. It cannot initialize
with copied live credentials or run in the production Supabase project.

Provenance: sandbox `ilfpugydxlzmmxjfrmrv`, function `stripe-worker`, installed
version 1; bundled `@stripe/sync-engine` version 1.0.32. Retrieved October 5, 2026.
The retained vendor payload's SHA-256, excluding the two comment lines added for
the checked-in compiled JavaScript snapshot, is:

`64088387cca9a67de50fec9e83ecf5fb80e01569b175bfcf6bd436269cff3b1b`

Runtime npm imports are pinned in `deno.json`. PostgreSQL clients and libraries
are included in the development lockfile so local type checking and the
deployment dependency audit can resolve the retained worker. Generated application bundles
remain excluded from source control.

The installed vendor bundle is compiled JavaScript. The release check validates
its syntax and the wrapper's syntax, and type-checks the new TypeScript credential
guard alongside the existing application functions. It does not try to retrofit
TypeScript declarations onto the retained vendor bundle. Endpoint/maintenance
verification is required after deployment.

Keep `verify_jwt = false`: the installed worker validates its own bearer secret
against Vault; a Supabase user token is not maintenance authorization. Do not
print or commit that secret. Do not deploy this sandbox worker to production or
reinstall the Stripe setup handler over the application webhook.
