// Public deployment configuration only; never read provider secrets here.
export function normalizeSiteUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('NG_PUBLIC_SITE_URL must be an HTTPS base URL without credentials, query or fragment.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}
