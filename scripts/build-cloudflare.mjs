// Cloudflare runs this on its own build infrastructure for the production branch.
// Explicit target prevents accidental sandbox builds when dashboard settings are absent.
process.env.NG_DEPLOY_TARGET = 'production';
await import('./build.mjs');
