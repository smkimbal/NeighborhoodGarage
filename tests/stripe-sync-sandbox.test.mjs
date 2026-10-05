import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

const source=await readFile('supabase/functions/_shared/stripe-sync-sandbox.ts','utf8');
const {code}=await transform(source,{loader:'ts',format:'esm'});
const {assertSandboxStripeSync}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const base={SUPABASE_URL:'https://ilfpugydxlzmmxjfrmrv.supabase.co',STRIPE_SECRET_KEY:'sk_test_fixture'};

test('retained Stripe Sync permits sandbox credentials and refuses missing or live configuration',()=>{
  for(const key of ['sk_test_fixture','rk_test_fixture']) {
    assert.doesNotThrow(()=>assertSandboxStripeSync(name=>({...base,STRIPE_SECRET_KEY:key})[name]));
    assert.doesNotThrow(()=>assertSandboxStripeSync(name=>({...base,STRIPE_SECRET_KEY:key,STRIPE_MODE:'sandbox'})[name]));
  }
  for(const values of [
    {...base,SUPABASE_URL:undefined},
    {...base,SUPABASE_URL:'https://zbbespojxxoheavodtqs.supabase.co'},
    {...base,STRIPE_MODE:'live'},
    {...base,STRIPE_MODE:'unknown'},
    {...base,STRIPE_SECRET_KEY:undefined},
    {...base,STRIPE_SECRET_KEY:'sk_live_fixture'},
    {...base,STRIPE_SECRET_KEY:'rk_live_fixture'},
    {...base,STRIPE_SECRET_KEY:'sk_test_fixture\n'}
  ]) assert.throws(()=>assertSandboxStripeSync(name=>values[name]),/restricted|locked|requires/);
});

test('worker rejects copied live settings before loading installed database or Stripe initialization',async()=>{
  const wrapper=(await readFile('supabase/functions/stripe-worker/index.js','utf8'))
    .replace(/^import .*;\n/m,'').replace("await import('./installed-worker.js');",'await loadInstalled();');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const start=new AsyncFunction('Deno','assertSandboxStripeSync','loadInstalled',wrapper);
  let loaded=0;
  for(const values of [{...base,STRIPE_MODE:'live'},{...base,STRIPE_SECRET_KEY:'sk_live_fixture'}]) {
    await assert.rejects(start({env:{get:name=>values[name]}},assertSandboxStripeSync,async()=>{loaded++;}),/locked|requires/);
  }
  assert.equal(loaded,0);
  await start({env:{get:name=>base[name]}},assertSandboxStripeSync,async()=>{loaded++;});
  assert.equal(loaded,1);
});
