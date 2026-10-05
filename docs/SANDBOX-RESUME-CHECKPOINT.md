# Sandbox continuation — October 5, 2026

## Verified baseline and completed work

The previous published sandbox checkpoint is
`e1342b77afc54d4a57b2a24f1130b2d4bbeeaad2`. Its [GitHub run
37253182191](https://github.com/smkimbal/NeighborhoodGarage/actions/runs/37253182191)
completed successfully: both Node 22/24 test jobs, Edge checks and sandbox builds;
Node 22 also completed all three browser journeys. The prior local checkpoint
records 109 passing tests on both runtimes and browser validation. Those completed
application checks were reused during this continuation, not repeated locally.

Sandbox `ilfpugydxlzmmxjfrmrv` already contains the reviewed migrations and current
application functions. Read-only verification found release
`2026-10-05-sandbox-ops-1`, three accounts, one tool, zero rentals and zero ledger
entries. There is one verified-email operator allowlist entry, zero verified
operator MFA factors, one private notification preview and zero email deliveries.
Reminder and delivery schedules are active; recent executions succeeded. The
existing access, notification and endpoint-retirement work did not need replaying.

Main had a newer documentation-only commit,
`02c3236f7a402e161207fbeb9aba5ad0fa27938d`. Its corrected README and continuation
report are incorporated into the existing test branch. Sandbox setup guidance is
retained. No replacement branch or production promotion is created.

## Recovered work from the interrupted action

Two described changes had not reached GitHub or the deployed Sync worker:

- Upgrade the development-only Supabase CLI from 2.81.3 to the pinned stable
  2.119.0. The updated lockfile removes its vulnerable archive dependency.
  Dependency auditing now blocks high/critical advisories in both release
  workflows. The audit reported zero advisories after the upgrade.
- Guard the retained Stripe Sync worker before initialization. The wrapper
  rejects another Supabase project, live/unknown payment modes, missing
  credentials and live Stripe keys. Original vendor code and Vault maintenance
  authentication are retained; source provenance is recorded beside the worker.
  Runtime dependencies are explicit and pinned for deployment and audit.

Only the new worker guard was exercised locally: two behavioral tests pass on
Node 22 and 24, including rejection before database/Stripe initialization.
The new TypeScript guard check and compiled JavaScript wrapper/vendor syntax
checks also pass. The installed vendor bundle is retained as JavaScript rather
than retrofitted with TypeScript declarations. The GitHub push workflow validates
the new combined commit; its result must be inspected rather than inferred from
the old successful commit.

The guarded worker is deployed as sandbox `stripe-worker` version 2, with its
pinned import map and existing Vault authentication. No other backend migration
or application-function redeployment was necessary in this continuation.

## Provider activation still required

| Task | Confirmed state | Required action |
| --- | --- | --- |
| Sandbox hosting | Legacy Pages serves sandbox configuration but `assets/app.js` returns 404. The old validated-artifact deployment was explicitly skipped. | Set [Pages](https://github.com/smkimbal/NeighborhoodGarage/settings/pages) source to GitHub Actions and permit the test branch in the `github-pages` environment. Then run the test-branch deployment workflow and verify its hosted assets. |
| Branch protection | Both branch summaries report `protected: false`; no repository rulesets exist. Administration reads/writes are unavailable to the connected code integration. | Apply the prepared policies in `configuration/` through [GitHub branch settings](https://github.com/smkimbal/NeighborhoodGarage/settings/branches), or run the documented administration script with a scoped administrator credential on a trusted workstation. |
| Native free-plan password settings | App screening and change forms are implemented and previously validated. Server Auth policy writes are unavailable to the connected Supabase integration, so activation is not claimed. | In [sandbox email Auth settings](https://supabase.com/dashboard/project/ilfpugydxlzmmxjfrmrv/auth/providers?provider=Email), set minimum length 12, require current password and enable password-change reauthentication; preserve email confirmation and optional ordinary-user MFA. |
| Operator activation | One account is approved; no verified authenticator exists for it. | The user enrolls and verifies their own authenticator in sandbox Profile before opening the private operator queue. |
| Native leaked-password rejection | Free plan does not provide native enforcement. App screening remains bypassable through direct Auth API calls. | Keep this explicit launch limitation; no paid upgrade is authorized or performed. |
| Real email/SMS | Delivery is sandbox preview capture only. | Provider/sender/recipient approval and delivery acceptance testing remain a later task. |

No real messages, live Stripe charging, paid-plan upgrades or production frontend
changes are part of this continuation. The available GitHub/Supabase integrations
were checked for administration capabilities; they do not expose the provider
settings writes above. An inactive provider setting is not recorded as complete.
