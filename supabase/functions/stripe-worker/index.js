import {assertSandboxStripeSync} from '../_shared/stripe-sync-sandbox.ts';

assertSandboxStripeSync(name => Deno.env.get(name));
// Dynamic loading keeps installed initialization behind the sandbox guard.
// The installed worker retains its independent Vault bearer authentication.
await import('./installed-worker.js');
