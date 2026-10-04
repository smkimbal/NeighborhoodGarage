import test from 'node:test';import assert from 'node:assert/strict';import{edgeHandler}from'./helpers/edge-handler.mjs';
const checked=r=>{if(r.error)throw r.error;return r.data;};
test('maintenance requires its scoped credential before accessing Stripe',async()=>{
 let calls=0;const h=await edgeHandler('supabase/functions/rental-maintenance/index.ts',{checked,endpoint:f=>f,HttpError:Error,adminClient:()=>({rpc:async()=>({data:false})}),stripeClient:()=>{calls++;throw Error('Forbidden');}});
 await assert.rejects(()=>h({headers:new Headers()}),/authentication required/);await assert.rejects(()=>h({headers:new Headers({'x-rental-maintenance-token':'forged'})}),/authentication required/);assert.equal(calls,0);
});
test('background reconciliation expires open extensions, defers uncertain payments and processes deposit deadlines',async()=>{
 const parent={status:'complete',renter_id:'renter'},entries=['open','unpaid','foreign','timeout'].map(id=>({id,rental_id:'r',status:'pending_payment',amount_due_cents:1000,processing_fee_cents:0,stripe_checkout_session_id:'cs_'+id,parent,checkout_expires_at:new Date(0).toISOString()}));let finishes=[],expires=[],deadlines=0;
 const admin={from:()=>({select(){return this},eq(){return this},lt(){return this},in(){return this},order(){return this},limit(){return Promise.resolve({data:entries});}}),rpc:async(name,args)=>{if(name==='rental_maintenance_authorized')return {data:true};if(name==='process_rental_deadlines'){deadlines++;return {data:1};}finishes.push({name,args});return {data:null};}};
 // Rental query is empty; both extension queries overlap and must be deduplicated.
 const from=admin.from;admin.from=table=>['rentals','payment_receipts'].includes(table)?{...from(),is(){return this},limit(){return Promise.resolve({data:[]});}}:from();
 const h=await edgeHandler('supabase/functions/rental-maintenance/index.ts',{checked,endpoint:f=>f,HttpError:Error,adminClient:()=>admin,stripeClient:()=>({checkout:{sessions:{retrieve:async id=>{if(id==='cs_timeout')throw Error('Provider timeout');const key=id.slice(3);return {id,livemode:false,status:key==='unpaid'?'complete':'open',payment_status:'unpaid',metadata:{project_ref:key==='foreign'?'other':'zbbespojxxoheavodtqs',rental_id:'r',extension_id:key},client_reference_id:'r:'+key,amount_total:1000,currency:'usd'};},expire:async id=>{expires.push(id);return {id,status:'expired',amount_total:1000,currency:'usd'};}}}})});
 const result=await h({headers:new Headers({'x-rental-maintenance-token':'valid'})});assert.equal(result.reconciled,1);assert.equal(result.deferred,3);assert.equal(deadlines,1);assert.deepEqual(expires,['cs_open']);assert.equal(finishes.length,1);assert.equal(finishes[0].name,'finish_extension_payment');assert.equal(finishes[0].args.p_paid,false);
});
