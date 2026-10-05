// Validate before the retained Sync worker creates a database or Stripe client.
// This worker belongs only to the existing experimentation sandbox.
export function assertSandboxStripeSync(get: (name: string) => string | undefined) {
  if (get('SUPABASE_URL') !== 'https://ilfpugydxlzmmxjfrmrv.supabase.co') {
    throw new Error('Stripe Sync worker is restricted to the Neighborhood Garage sandbox project.');
  }
  if ((get('STRIPE_MODE') || 'sandbox') !== 'sandbox') {
    throw new Error('Stripe Sync worker is locked to Stripe sandbox mode.');
  }
  if (!/^(sk|rk)_test_[A-Za-z0-9_]+$/.test(get('STRIPE_SECRET_KEY') || '')) {
    throw new Error('Stripe Sync worker requires a Stripe sandbox credential.');
  }
}
