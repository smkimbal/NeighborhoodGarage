import {test} from 'node:test';import assert from 'node:assert/strict';import {edgeHandler} from './helpers/edge-handler.mjs';
const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',checked=r=>{if(r.error)throw r.error;return r.data};
const receipt=()=>({id,user_id:user,wallet_account:user,amount_cents:2550,status:'pending_payment',created_at:new Date().toISOString(),checkout_expires_at:new Date(Date.now()+31*60000).toISOString(),stripe_checkout_session_id:'cs_topup',disputed_cents:0,dispute_active:false});
const session=()=>({id:'cs_topup',status:'complete',payment_status:'paid',livemode:false,amount_total:2550,currency:'usd',payment_intent:'pi_topup',client_reference_id:'topup:'+id,metadata:{kind:'tool_share_credits',topup_id:id,user_id:user,project_ref:'zbbespojxxoheavodtqs'}});
const intent=()=>({id:'pi_topup',status:'succeeded',amount_received:2550,currency:'usd',livemode:false,metadata:session().metadata,latest_charge:{id:'ch_topup',paid:true,amount:2550,amount_refunded:0,currency:'usd',livemode:false,balance_transaction:{id:'txn_topup',fee:104,available_on:1791000000}}});
function chain(data,onUpdate=()=>{}){return {select(){return this},eq(){return this},is(){return this},upsert(){return this},maybeSingle(){return Promise.resolve({data})},update(v){onUpdate(v);return this},single(){return Promise.resolve({data})},then(resolve){return Promise.resolve({data}).then(resolve)}};}
test('Stripe top-up creation uses server amount, scoped metadata and a stable idempotency key',async()=>{
 const r={...receipt(),stripe_checkout_session_id:null};let creates=0,request,stored;
 const stripe={checkout:{sessions:{list:async()=>({data:[],has_more:false}),create:async(args,options)=>{creates++;request={args,options};return {id:'cs_created',url:'https://checkout.stripe.com/fixture'};}}}};
 const h=await edgeHandler('supabase/functions/credit-funding/index.ts',{authenticate:async()=>({claims:{aal:'aal2'},user:{id:user},admin:{rpc:async()=>({data:r}),from:()=>chain(r,v=>stored=v)}}),checked,checkedUrl:x=>x,endpoint:f=>f,HttpError:Error,stripeClient:()=>stripe});
 const result=await h({json:async()=>({action:'create',confirmedFeeCents:108,requestId:id,amountCents:2550,returnUrl:'https://neighborhoodgarage.net/'})});
 assert.equal(creates,1);assert.equal(result.checkoutUrl,'https://checkout.stripe.com/fixture');assert.equal(request.args.line_items[0].price_data.unit_amount,2550);assert.equal(request.options.idempotencyKey,'ng-credit-topup-'+id);assert.equal(request.args.payment_method_types,undefined);assert.equal(request.args.metadata.user_id,user);assert.match(request.args.success_url,/wallet=funds&topup=/);assert.equal(stored.stripe_checkout_session_id,'cs_created');
});
test('funding status verifies Stripe intent before settlement and rejects tampered receipts',async()=>{
 for(const problem of [null,'foreign','wrong_amount','unpaid']){
  let settled=0;const r=receipt(),s=session(),pi=intent();if(problem==='foreign')s.metadata.project_ref='foreign';if(problem==='wrong_amount')pi.amount_received=2500;if(problem==='unpaid'){s.payment_status='unpaid';pi.status='processing';}
  const admin={from:()=>chain(settled?{...r,status:'paid'}:r),rpc:async(name,args)=>{assert.equal(name,'finish_credit_topup');assert.equal(args.p_amount,2550);assert.equal(args.p_fee,104);settled++;return {data:{...r,status:'paid'}}}};
  const h=await edgeHandler('supabase/functions/credit-funding/index.ts',{authenticate:async()=>({claims:{aal:'aal2'},user:{id:user},admin}),checked,endpoint:f=>f,HttpError:Error,stripeClient:()=>({checkout:{sessions:{retrieve:async()=>s}},paymentIntents:{retrieve:async()=>pi}})});
  const call=()=>h({json:async()=>({action:'status',topupId:id})});
  if(problem==='foreign'||problem==='wrong_amount'){await assert.rejects(call,/match|verified/);assert.equal(settled,0);}else if(problem==='unpaid'){assert.equal((await call()).awaitingPayment,true);assert.equal(settled,0);}else{assert.equal((await call()).paid,true);assert.equal(settled,1);}
 }
});
test('lost top-up creation is recovered from all provider pages without another checkout',async()=>{
 let pages=0,creates=0;const r={...receipt(),stripe_checkout_session_id:null},s={...session(),status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/existing'};
 const h=await edgeHandler('supabase/functions/credit-funding/index.ts',{authenticate:async()=>({claims:{aal:'aal2'},user:{id:user},admin:{rpc:async()=>({data:r}),from:()=>chain(r)}}),checked,checkedUrl:x=>x,endpoint:f=>f,HttpError:Error,stripeClient:()=>({checkout:{sessions:{list:async args=>{pages++;if(pages===1)return {data:[{...s,id:'cs_foreign',metadata:{...s.metadata,project_ref:'foreign'}}],has_more:true};assert.equal(args.starting_after,'cs_foreign');return {data:[s],has_more:false};},create:async()=>{creates++;throw Error('duplicate')}}}})});
 assert.equal((await h({json:async()=>({action:'create',requestId:id,amountCents:2550,returnUrl:'https://neighborhoodgarage.net/'})})).checkoutUrl,s.url);assert.equal(creates,0);assert.equal(pages,2);
});
test('live prepaid funding stays blocked until the model has Stripe approval',async()=>{
 let writes=0;const h=await edgeHandler('supabase/functions/credit-funding/index.ts',{env:k=>k==='STRIPE_MODE'?'live':undefined,authenticate:async()=>({claims:{aal:'aal2'},user:{id:user},admin:{rpc:async()=>{writes++;}}}),checked,endpoint:f=>f,HttpError:Error});
 assert.equal((await h({json:async()=>({action:'options'})})).enabled,false);await assert.rejects(()=>h({json:async()=>({action:'create'})}),/Stripe approval/);assert.equal(writes,0);
});
test('signed top-up event processing rechecks the actual provider session, intent and project',async()=>{
 let settled=0;const r=receipt(),s=session(),admin={from:()=>chain({...r,status:'paid'}),rpc:async()=>{settled++;return {data:{...r,status:'paid'}}}},stripe={checkout:{sessions:{retrieve:async()=>s}},paymentIntents:{retrieve:async()=>intent()}};
 const h=await edgeHandler('supabase/functions/credit-funding/index.ts',{checked,endpoint:f=>f,HttpError:Error});
 const apply=h.creditHelpers.applyCreditPayment,event={id:'evt_topup',type:'checkout.session.completed',livemode:false,data:{object:s}};
 assert.equal(await apply(event,stripe,admin),true);assert.equal(settled,1);
 assert.equal(await apply({...event,data:{object:{...s,metadata:{...s.metadata,project_ref:'foreign'}}}},stripe,admin),false);assert.equal(settled,1);
 await assert.rejects(()=>apply({...event,livemode:true},stripe,admin),/environment/);
});
test('Stripe cashout waits for settled platform funds without duplicating or releasing its reserved credits',async()=>{
 let transfers=0;const w={id:'w',status:'pending',amount_cents:2550,destination:'acct_fixture',created_at:new Date().toISOString()};
 const h=await edgeHandler('supabase/functions/withdraw-credits/index.ts',{authenticate:async()=>({claims:{aal:'aal2'},user:{id:user},admin:{from:()=>chain(w),rpc:async()=>({data:w})}}),checked,endpoint:f=>f,HttpError:Error,stripeClient:()=>({transfers:{list:async()=>({data:[]}),create:async()=>{transfers++;}},v2:{core:{accounts:{retrieve:async()=>({configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'},payouts:{status:'active'}}}}}})}}},balance:{retrieve:async()=>({available:[{currency:'usd',amount:2500}]})}})});
 await assert.rejects(()=>h({json:async()=>({amountCents:2550,requestId:'w'})}),/still settling/);assert.equal(transfers,0);
});
test('cashout rechecks recipient transfer and bank payout capabilities before creating an external transfer',async()=>{
 for(const payouts of ['pending','active']){
  let transfers=0,checkedReady=0,stored;
  const w={id:'w',status:'pending',amount_cents:2550,destination:'acct_fixture',created_at:new Date().toISOString()};
  const admin={rpc:async name=>{if(name==='credit_withdrawal_ready')checkedReady++;return {data:name==='credit_withdrawal_ready'?true:w}},from:()=>chain(w,v=>stored=v)};
  const stripe={
   v2:{core:{accounts:{retrieve:async(id,args)=>{
    assert.equal(id,w.destination);assert.deepEqual(args.include,['configuration.recipient']);
    return {configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'},payouts:{status:payouts}}}}}};
   }}}},
   balance:{retrieve:async()=>({available:[{currency:'usd',amount:10000}]})},
   transfers:{list:async()=>({data:[]}),create:async(args,options)=>{
    transfers++;assert.equal(args.amount,2550);assert.equal(options.idempotencyKey,'NG_WITHDRAWAL_w');return {id:'tr_verified'};
   }}
  };
  const h=await edgeHandler('supabase/functions/withdraw-credits/index.ts',{authenticate:async()=>({claims:{aal:'aal2'},user:{id:user},admin}),checked,endpoint:f=>f,HttpError:Error,stripeClient:()=>stripe}),call=()=>h({json:async()=>({amountCents:2550,requestId:'w'})});
  if(payouts==='pending'){await assert.rejects(call,/bank and payout setup/);assert.equal(transfers,0);assert.equal(stored,undefined);}else{await call();assert.equal(transfers,1);assert.equal(stored.stripe_transfer_id,'tr_verified');}
  assert.equal(checkedReady,1);
 }
});
test('payout setup does not mark a recipient ready while its bank payout capability is restricted',async()=>{
 for(const payouts of ['restricted','active']){
  let stored;const p={stripe_account_id:'acct_fixture'},admin={from:()=>chain(p,v=>stored=v)};
  const account={configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'},payouts:{status:payouts}}}}}};
  const stripe={v2:{core:{accounts:{retrieve:async()=>account}}}};
  const h=await edgeHandler('supabase/functions/connect-account/index.ts',{authenticate:async()=>({claims:{aal:'aal2'},user:{id:user},admin}),checked,endpoint:f=>f,HttpError:Error,stripeClient:()=>stripe});
  const result=await h({json:async()=>({action:'status'})});assert.equal(result.complete,payouts==='active');assert.equal(stored.stripe_onboarding_complete,payouts==='active');
 }
});
