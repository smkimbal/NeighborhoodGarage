// Deploy the frontend before real-domain email and sandbox payment verification.
// This operator flag is advisory: it cannot establish backend health or enable payments.
if (process.env.NG_PRODUCTION_BACKEND_READY !== 'true') {
  console.warn('Backend readiness is unconfirmed. Building the production frontend for sandbox verification; verify signup emails and Stripe sandbox webhook delivery before accepting customers.');
}
process.env.NG_PUBLIC_SUPABASE_URL ??= 'https://zbbespojxxoheavodtqs.supabase.co';
process.env.NG_PUBLIC_SUPABASE_KEY ??= 'sb_publishable_f0Tc0Qz4sWlCRaT58d2qlA_ZKRi-7Ot';
// Cloudflare runs this on its own build infrastructure for the production branch.
// Explicit target prevents accidental sandbox builds when dashboard settings are absent.
process.env.NG_DEPLOY_TARGET = 'production';
await import('./build.mjs');
