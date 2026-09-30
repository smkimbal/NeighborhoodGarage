import {normalizeSiteUrl} from './site-url.mjs';
export const sandboxProject = 'ilfpugydxlzmmxjfrmrv';
export function deploymentConfig(env) {
  const target = env.NG_DEPLOY_TARGET || 'sandbox';
  if (!['sandbox', 'production'].includes(target)) throw new Error('Unknown NG_DEPLOY_TARGET.');
  if (target === 'sandbox') return {target, output: 'dist', config: null};
  const site = normalizeSiteUrl(env.NG_PUBLIC_SITE_URL || 'https://neighborhoodgarage.net/');
  if (site !== 'https://neighborhoodgarage.net/') throw new Error('Production must use https://neighborhoodgarage.net/.');
  const url = new URL(env.NG_PUBLIC_SUPABASE_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) throw new Error('Provide a production Supabase project URL.');
  if (url.hostname === `${sandboxProject}.supabase.co`) throw new Error('Production cannot use the sandbox database.');
  const key = env.NG_PUBLIC_SUPABASE_KEY || '';
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Production requires a public Supabase publishable key, never a secret key.');
  return {target, output: 'dist-production', config: {supabaseUrl:url.origin, supabaseKey:key, authRedirectUrl:site}};
}
