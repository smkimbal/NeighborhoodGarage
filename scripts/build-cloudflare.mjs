if(process.env.NG_PRODUCTION_BACKEND_READY!=='true') throw new Error('Production backend setup is incomplete. Finish migrations, Auth URLs and sandbox Stripe setup before setting NG_PRODUCTION_BACKEND_READY=true.');
process.env.NG_PUBLIC_SUPABASE_URL ??= 'https://zbbespojxxoheavodtqs.supabase.co';
process.env.NG_PUBLIC_SUPABASE_KEY ??= 'sb_publishable_f0Tc0Qz4sWlCRaT58d2qlA_ZKRi-7Ot';
// Cloudflare runs this on its own build infrastructure for the production branch.
// Explicit target prevents accidental sandbox builds when dashboard settings are absent.
process.env.NG_DEPLOY_TARGET = 'production';
await import('./build.mjs');
