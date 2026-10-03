import test from 'node:test';import assert from 'node:assert/strict';import Stripe from 'stripe';import{edgeHandler}from'./helpers/edge-handler.mjs';
test('Vault-backed webhook verifies the original body before any fulfillment',async()=>{
 const stripe=new Stripe('sk_test_fixture'),secret='whsec_local_test_only',payload=JSON.stringify({id:'evt_fixture',object:'event',type:'checkout.session.expired',livemode:false,data:{object:{id:'cs_fixture'}}});let fulfilled=0;
 const h=await edgeHandler('supabase/functions/stripe-webhook/index.ts',{Stripe,StripeSync:{},stripeClient:()=>stripe,adminClient:()=>({rpc:async name=>{assert.equal(name,'stripe_webhook_signing_secret');return {data:secret};}}),checked:r=>{if(r.error)throw r.error;return r.data;},applyRentalPayment:async e=>{assert.equal(e.id,'evt_fixture');fulfilled++;}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.equal((await h(new Request('https://fixture.invalid/',{method:'POST',body:payload}))).status,400);assert.equal(fulfilled,0);
 const old=console.error;console.error=()=>{};try{assert.equal((await h(new Request('https://fixture.invalid/',{method:'POST',body:payload+' ',headers:{'Stripe-Signature':signature}}))).status,400);assert.equal(fulfilled,0);}finally{console.error=old;}
 assert.equal((await h(new Request('https://fixture.invalid/',{method:'POST',body:payload,headers:{'Stripe-Signature':signature}}))).status,200);assert.equal(fulfilled,1);
});
