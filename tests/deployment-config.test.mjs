import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentConfig} from '../scripts/deployment-config.mjs';
const production={NG_DEPLOY_TARGET:'production',NG_PUBLIC_SUPABASE_URL:'https://productionexample.supabase.co',NG_PUBLIC_SUPABASE_KEY:'sb_publishable_example'};
test('sandbox remains the default; production has separate output and only public config',()=>{
 assert.equal(deploymentConfig({}).output,'dist');
 const result=deploymentConfig({...production,STRIPE_SECRET_KEY:'do-not-serialize'});
 assert.equal(result.output,'dist-production');
 assert.equal(result.config.authRedirectUrl,'https://neighborhoodgarage.net/');
 assert.ok(!JSON.stringify(result).includes('do-not-serialize'));
});
test('production rejects sandbox database, secret keys, missing configuration and other origins',()=>{
 for(const overrides of [
 {NG_PUBLIC_SUPABASE_URL:'https://ilfpugydxlzmmxjfrmrv.supabase.co'},
 {NG_PUBLIC_SUPABASE_KEY:'sb_secret_bad'},
 {NG_PUBLIC_SUPABASE_KEY:''},
 {NG_PUBLIC_SUPABASE_URL:''},
 {NG_PUBLIC_SITE_URL:'https://smkimbal.github.io/NeighborhoodGarage/'},
 {NG_PUBLIC_SUPABASE_URL:'https://user:pass@productionexample.supabase.co'}
 ]) assert.throws(()=>deploymentConfig({...production,...overrides}));
});
