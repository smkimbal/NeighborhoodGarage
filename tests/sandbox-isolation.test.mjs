import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';
async function runtime(env){
 const source=(await readFile('supabase/functions/_shared/runtime.ts','utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const {code}=await transform(source,{loader:'ts'});class Stripe{constructor(key){this.key=key;}static createFetchHttpClient(){return {};}}
 return new Function('Deno','Stripe','createClient','allowedOrigins',code+'\nreturn {stripeClient};')({env:{get:k=>env[k]}},Stripe,()=>{},()=>new Set());
}
test('sandbox Stripe mode cannot be overridden by copied live settings or credentials',async()=>{
 const base={SUPABASE_URL:'https://ilfpugydxlzmmxjfrmrv.supabase.co',STRIPE_SECRET_KEY:'sk_test_fixture'};
 assert.equal((await runtime(base)).stripeClient().key,'sk_test_fixture');
 await assert.rejects(async()=>{(await runtime({...base,STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture'})).stripeClient();},/locked to Stripe test mode/);
 await assert.rejects(async()=>{(await runtime({...base,STRIPE_SECRET_KEY:'sk_live_fixture'})).stripeClient();},/do not match/);
});
