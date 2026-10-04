import test from 'node:test';
import assert from 'node:assert/strict';
import {edgeHandler as handler} from './helpers/edge-handler.mjs';
const checked=r=>{if(r.error)throw r.error;return r.data};
test('fully credit-funded checkout does not initialize or call Stripe',async()=>{
 let stripeCalls=0;
 const h=await handler('supabase/functions/create-checkout/index.ts',{
 authenticate:async()=>({user:{id:'renter'},admin:{rpc:async()=>({data:{status:'reserved',amount_due_cents:0}})}}),
 checked,checkedUrl:x=>x,endpoint:f=>f,HttpError:Error,stripeClient:()=>{stripeCalls++;throw Error('No Stripe credentials')}
 });
 const result=await h({json:async()=>({rentalId:'r',successUrl:'https://neighborhoodgarage.net/',cancelUrl:'https://neighborhoodgarage.net/'})});
 assert.equal(result.paid,true);assert.equal(stripeCalls,0);
});
test('fully credit-funded approved extension does not initialize or call Stripe',async()=>{
 let stripeCalls=0;
 const h=await handler('supabase/functions/create-checkout/index.ts',{
 authenticate:async()=>({user:{id:'renter'},admin:{rpc:async(name,args)=>{assert.equal(name,'begin_extension_checkout');assert.equal(args.p_extension,'extension');return {data:{status:'paid',amount_due_cents:0}}}}}),
 checked,checkedUrl:x=>x,endpoint:f=>f,HttpError:Error,stripeClient:()=>{stripeCalls++;throw Error('No Stripe credentials')}
 });
 assert.equal((await h({json:async()=>({extensionId:'extension',successUrl:'https://neighborhoodgarage.net/',cancelUrl:'https://neighborhoodgarage.net/'})})).paid,true);assert.equal(stripeCalls,0);
});
test('approval of internally credited earnings does not initiate external payout',async()=>{
 let stripeCalls=0;
 const rental={id:'r',owner_id:'owner',renter_id:'renter',status:'review',payout_status:'not_due'};
 const chain={select(){return this},eq(){return this},async single(){return {data:rental}}};
 const h=await handler('supabase/functions/rental-action/index.ts',{
 authenticate:async()=>({claims:{aal:'aal2'},user:{id:'owner'},admin:{from:()=>chain,rpc:async()=>({data:{...rental,status:'complete',payout_status:'credited'}})}}),
 checked,endpoint:f=>f,HttpError:Error,stripeClient:()=>{stripeCalls++;throw Error('Unexpected Stripe call')}
 });
 const result=await h({json:async()=>({rentalId:'r',action:'approve'})});
 assert.equal(result.rental.payout_status,'credited');assert.equal(stripeCalls,0);
});
test('withdrawal retries reuse an existing transfer instead of paying twice',async()=>{
 let creates=0,updates=0;
 const w={id:'w',user_id:'owner',amount_cents:500,destination:'acct_test',status:'pending',created_at:new Date(0).toISOString()};
 const chain={update(v){updates++;assert.equal(v.stripe_transfer_id,'tr_existing');return this},eq(){return this},select(){return this},async maybeSingle(){return {data:w}},async single(){return {data:{...w,status:'paid'}}}};
 const h=await handler('supabase/functions/withdraw-credits/index.ts',{
 authenticate:async()=>({claims:{aal:'aal2'},user:{id:'owner'},admin:{rpc:async()=>({data:w}),from:()=>chain}}),checked,endpoint:f=>f,HttpError:Error,
 stripeClient:()=>({transfers:{list:async()=>({data:[{id:'tr_existing',metadata:{withdrawal_id:'w'},destination:'acct_test',amount:500}]}),create:async()=>{creates++;throw Error('Duplicate')}}})
 });
 const result=await h({json:async()=>({amountCents:500,requestId:'w'})});
 assert.equal(result.withdrawal.status,'paid');assert.equal(creates,0);assert.equal(updates,1);
});
test('old ambiguous withdrawal cannot create a fresh transfer after idempotency expiry',async()=>{
 let creates=0;
 const h=await handler('supabase/functions/withdraw-credits/index.ts',{
 authenticate:async()=>({claims:{aal:'aal2'},user:{id:'owner'},admin:{from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'w'}})}),rpc:async()=>({data:{id:'w',amount_cents:500,destination:'acct_test',status:'pending',created_at:new Date(0).toISOString()}})}}),checked,endpoint:f=>f,HttpError:Error,
 stripeClient:()=>({transfers:{list:async()=>({data:[]}),create:async()=>{creates++}}})
 });
 await assert.rejects(()=>h({json:async()=>({amountCents:500,requestId:'w'})}),/support review/);
 assert.equal(creates,0);
});

test('payment recovery verifies Stripe state before settlement and rejects foreign project',async()=>{
 for(const foreign of [false,true]){
 let settled=0;
 const r={id:'r',owner_id:'owner',renter_id:'renter',status:'pending_payment',amount_due_cents:300,processing_fee_cents:0,stripe_checkout_session_id:'cs_test'};
 const chain={upsert(){return this},then(f){return Promise.resolve({data:null}).then(f)},select(){return this},eq(){return this},async single(){return {data:settled?{...r,status:'reserved'}:r}}};
 const h=await handler('supabase/functions/rental-action/index.ts',{
 authenticate:async()=>({user:{id:'renter'},admin:{from:()=>chain,rpc:async(name,args)=>{assert.equal(name,'finish_payment');assert.equal(args.p_amount,300);settled++;return {data:null}}}}),checked,endpoint:f=>f,HttpError:Error,
 stripeClient:()=>({paymentIntents:{retrieve:async()=>({id:'pi_test',status:'succeeded',amount_received:300,currency:'usd',livemode:false,latest_charge:{id:'ch_test',paid:true,balance_transaction:{fee:39,available_on:1791000000}}})},checkout:{sessions:{retrieve:async()=>({id:'cs_test',status:'complete',payment_status:'paid',livemode:false,metadata:{user_id:'renter',project_ref:foreign?'wrong':'zbbespojxxoheavodtqs',rental_id:'r'},client_reference_id:'r',amount_total:300,currency:'usd',payment_intent:'pi_test'})}}})
 });
 const call=()=>h({json:async()=>({rentalId:'r',action:'sync-payment'})});
 if(foreign){await assert.rejects(call,/does not match/);assert.equal(settled,0);}else{assert.equal((await call()).rental.status,'reserved');assert.equal(settled,1);}
 }
});

test('lost checkout creation is recovered across provider pages without another payment session',async()=>{
 let creates=0,pages=0,stored;
 const r={id:'r',status:'pending_payment',amount_due_cents:300,processing_fee_cents:0,checkout_expires_at:new Date(Date.now()+31*60000).toISOString()};
 const session={amount_total:300,id:'cs_existing',status:'open',url:'https://checkout.stripe.com/fixture',livemode:false,metadata:{project_ref:'zbbespojxxoheavodtqs',rental_id:'r'},client_reference_id:'r'};
 const chain={update(v){stored=v;return this},eq(){return this},is(){return this},then(resolve){return Promise.resolve({data:null}).then(resolve)}};
 const h=await handler('supabase/functions/create-checkout/index.ts',{
 authenticate:async()=>({user:{id:'renter'},admin:{rpc:async()=>({data:r}),from:()=>chain}}),checked,checkedUrl:x=>x,endpoint:f=>f,HttpError:Error,
 stripeClient:()=>({checkout:{sessions:{list:async args=>{pages++;if(pages===1)return {data:[{...session,id:'cs_foreign',metadata:{...session.metadata,project_ref:'foreign'}}],has_more:true};assert.equal(args.starting_after,'cs_foreign');return {data:[session],has_more:false};},create:async()=>{creates++;throw Error('Duplicate charge')}}}})
 });
 assert.equal((await h({json:async()=>({rentalId:'r',successUrl:'https://neighborhoodgarage.net/',cancelUrl:'https://neighborhoodgarage.net/'})})).checkoutUrl,session.url);assert.equal(creates,0);assert.equal(pages,2);assert.deepEqual(stored,{stripe_checkout_session_id:session.id});
});
test('unconfirmed asynchronous payment and failed cancellation never release held funds',async()=>{
 for(const action of ['sync-payment','cancel']){
 let writes=0;
 const r={id:'r',owner_id:'owner',renter_id:'renter',status:'pending_payment',stripe_checkout_session_id:'cs_test'};
 const chain={select(){return this},eq(){return this},async single(){return {data:r}}};
 const h=await handler('supabase/functions/rental-action/index.ts',{
 authenticate:async()=>({user:{id:'renter'},admin:{from:()=>chain,rpc:async()=>{writes++;return {data:null}}}}),checked,endpoint:f=>f,HttpError:Error,
 stripeClient:()=>({checkout:{sessions:{retrieve:async()=>({id:'cs_test',status:action==='cancel'?'open':'complete',payment_status:'unpaid',livemode:false,metadata:{project_ref:'zbbespojxxoheavodtqs',rental_id:'r'},client_reference_id:'r'}),expire:async()=>{throw Error('Provider timeout')}}}})
 });
 await assert.rejects(()=>h({json:async()=>({rentalId:'r',action,paymentSafe:true})}),action==='cancel'?/Provider timeout/:/not confirmed/);assert.equal(writes,0);
 }
});
test('absence of a payment session is verified before an expired creation hold is released',async()=>{
 for(const expired of [false,true]){
 let released=0;
 const r={id:'r',owner_id:'owner',renter_id:'renter',status:'pending_payment',checkout_expires_at:new Date(Date.now()+(expired?-60000:60000)).toISOString()};
 const chain={select(){return this},eq(){return this},async single(){return {data:r}}};
 const h=await handler('supabase/functions/rental-action/index.ts',{
 authenticate:async()=>({user:{id:'renter'},admin:{from:()=>chain,rpc:async name=>{assert.equal(name,'release_uncreated_checkout');released++;return {data:null}}}}),checked,endpoint:f=>f,HttpError:Error,stripeClient:()=>({checkout:{sessions:{list:async()=>({data:[],has_more:false})}}})
 });
 const call=()=>h({json:async()=>({rentalId:'r',action:'sync-payment'})});if(expired)assert.equal((await call()).released,true);else await assert.rejects(call,/being reconciled/);assert.equal(released,expired?1:0);
 }
});
