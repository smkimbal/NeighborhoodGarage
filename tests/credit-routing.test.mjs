import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
async function handler(file,runtime){
 const source=(await readFile(file,'utf8')).replace(/^import .*runtime.ts';\n/,'');
 const {code}=await transform(source,{loader:'ts',format:'esm'});
 let result;
 new Function('Deno',...Object.keys(runtime),code)({serve:h=>result=h},...Object.values(runtime));
 return result;
}
const checked=r=>{if(r.error)throw r.error;return r.data};
test('fully credit-funded checkout does not initialize or call Stripe',async()=>{
 let stripeCalls=0;
 const h=await handler('supabase/functions/create-checkout/index.ts',{
 authenticate:async()=>({user:{id:'renter'},admin:{rpc:async()=>({data:{status:'reserved',amount_due_cents:0}})}}),
 checked,checkedUrl:x=>x,endpoint:f=>f,HttpError:Error,stripeClient:()=>{stripeCalls++;throw Error('No Stripe credentials')}
 });
 const result=await h({json:async()=>({toolId:'tool',days:1,requestId:'request',successUrl:'https://neighborhoodgarage.net/',cancelUrl:'https://neighborhoodgarage.net/'})});
 assert.equal(result.paid,true);assert.equal(stripeCalls,0);
});
test('approval of internally credited earnings does not initiate external payout',async()=>{
 let stripeCalls=0;
 const rental={id:'r',owner_id:'owner',renter_id:'renter',status:'review',payout_status:'not_due'};
 const chain={select(){return this},eq(){return this},async single(){return {data:rental}}};
 const h=await handler('supabase/functions/rental-action/index.ts',{
 authenticate:async()=>({user:{id:'owner'},admin:{from:()=>chain,rpc:async()=>({data:{...rental,status:'complete',payout_status:'credited'}})}}),
 checked,endpoint:f=>f,HttpError:Error,stripeClient:()=>{stripeCalls++;throw Error('Unexpected Stripe call')}
 });
 const result=await h({json:async()=>({rentalId:'r',action:'approve'})});
 assert.equal(result.rental.payout_status,'credited');assert.equal(stripeCalls,0);
});
test('withdrawal retries reuse an existing transfer instead of paying twice',async()=>{
 let creates=0,updates=0;
 const w={id:'w',user_id:'owner',amount_cents:500,destination:'acct_test',status:'pending',created_at:new Date(0).toISOString()};
 const chain={update(v){updates++;assert.equal(v.stripe_transfer_id,'tr_existing');return this},eq(){return this},select(){return this},async single(){return {data:{...w,status:'paid'}}}};
 const h=await handler('supabase/functions/withdraw-credits/index.ts',{
 authenticate:async()=>({user:{id:'owner'},admin:{rpc:async()=>({data:w}),from:()=>chain}}),checked,endpoint:f=>f,HttpError:Error,
 stripeClient:()=>({transfers:{list:async()=>({data:[{id:'tr_existing',metadata:{withdrawal_id:'w'},destination:'acct_test',amount:500}]}),create:async()=>{creates++;throw Error('Duplicate')}}})
 });
 const result=await h({json:async()=>({amountCents:500,requestId:'w'})});
 assert.equal(result.withdrawal.status,'paid');assert.equal(creates,0);assert.equal(updates,1);
});
test('old ambiguous withdrawal cannot create a fresh transfer after idempotency expiry',async()=>{
 let creates=0;
 const h=await handler('supabase/functions/withdraw-credits/index.ts',{
 authenticate:async()=>({user:{id:'owner'},admin:{rpc:async()=>({data:{id:'w',amount_cents:500,destination:'acct_test',status:'pending',created_at:new Date(0).toISOString()}})}}),checked,endpoint:f=>f,HttpError:Error,
 stripeClient:()=>({transfers:{list:async()=>({data:[]}),create:async()=>{creates++}}})
 });
 await assert.rejects(()=>h({json:async()=>({amountCents:500,requestId:'w'})}),/support review/);
 assert.equal(creates,0);
});
