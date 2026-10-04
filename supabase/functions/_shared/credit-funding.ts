import type Stripe from 'npm:stripe@22.6.0';
import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.95.0';
import {checked,HttpError} from './runtime.ts';
import {recordReceipt} from './receipts.ts';
export const fundingLive=()=>{const mode=Deno.env.get('STRIPE_MODE')||'sandbox';if(!['sandbox','live'].includes(mode))throw new HttpError('Invalid Stripe payment mode.',503);return mode==='live';};
export const fundingEnabled=()=>!fundingLive()||Deno.env.get('NG_CREDIT_FUNDING_APPROVED')==='true';
const project=()=>new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0];
export function matchesTopup(s:Stripe.Checkout.Session,t:any){
 return s.livemode===fundingLive()&&s.metadata?.project_ref===project()&&s.metadata?.topup_id===t.id&&s.metadata?.user_id===t.wallet_account&&s.metadata?.kind==='tool_share_credits'&&s.client_reference_id==='topup:'+t.id;
}
export async function recoverTopup(stripe:Stripe,admin:SupabaseClient,t:any){
 let found:Stripe.Checkout.Session|undefined;
 if(t.stripe_checkout_session_id)found=await stripe.checkout.sessions.retrieve(t.stripe_checkout_session_id);
 else{
  let after:string|undefined;
  for(let page=0;page<20;page++){
   const result=await stripe.checkout.sessions.list({created:{gte:Math.floor(new Date(t.created_at).getTime()/1000)-60},limit:100,...(after?{starting_after:after}:{})});
   for(const s of result.data)if(matchesTopup(s,t)){if(found&&found.id!==s.id)throw new HttpError('Multiple funding receipts need support review.',409);found=s;}
   if(!result.has_more)break;if(page===19)throw new HttpError('Funding history is still being checked. Retry the same request.',503);
   after=result.data.at(-1)?.id;if(!after)throw new HttpError('Funding history could not be verified.',503);
  }
 }
 if(found){
  if(!matchesTopup(found,t))throw new HttpError('Funding payment does not match your account.',409);
  if(!t.stripe_checkout_session_id)checked(await admin.from('credit_topups').update({stripe_checkout_session_id:found.id}).eq('id',t.id).eq('status','pending_payment').is('stripe_checkout_session_id',null));
 }
 return found;
}
export async function settleTopup(stripe:Stripe,admin:SupabaseClient,t:any,s:Stripe.Checkout.Session,eventId:string,eventType:string){
 if(!matchesTopup(s,t)||s.amount_total!==t.amount_cents+(t.processing_fee_cents||0)||s.currency!=='usd')throw new HttpError('Funding receipt does not match its verified amount or account.',409);
 const paid=s.payment_status==='paid';
 if(!paid&&s.status!=='expired'&&eventType!=='checkout.session.async_payment_failed')return t;
 let intent:Stripe.PaymentIntent|undefined,charge:Stripe.Charge|undefined,balance:Stripe.BalanceTransaction|undefined;
 if(paid){
  const id=typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id;if(!id)throw new HttpError('Funding payment receipt is not available yet.',409);
  intent=await stripe.paymentIntents.retrieve(id,{expand:['latest_charge.balance_transaction']});
  if(intent.status!=='succeeded'||intent.amount_received!==t.amount_cents+(t.processing_fee_cents||0)||intent.currency!=='usd'||intent.livemode!==fundingLive()||intent.metadata.project_ref!==project()||intent.metadata.topup_id!==t.id||intent.metadata.user_id!==t.wallet_account)throw new HttpError('Stripe has not verified this funding payment.',409);
  charge=typeof intent.latest_charge==='string'?await stripe.charges.retrieve(intent.latest_charge,{expand:['balance_transaction']}):intent.latest_charge||undefined;
  if(!charge||!charge.paid||charge.amount!==t.amount_cents+(t.processing_fee_cents||0)||charge.currency!=='usd'||charge.livemode!==fundingLive())throw new HttpError('Funding charge is still being verified.',409);
  balance=typeof charge.balance_transaction==='object'&&charge.balance_transaction?charge.balance_transaction:undefined;
 }
 await recordReceipt(stripe,admin,s,t,false,true);
 const result=checked(await admin.rpc('finish_credit_topup',{p_event:eventId,p_type:paid?(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(eventType)?eventType:'verified_checkout_sync'):eventType,
  p_topup:t.id,p_session:s.id,p_paid:paid,p_amount:t.amount_cents,p_currency:s.currency,p_intent:intent?.id||null,p_charge:charge?.id||null,p_balance_transaction:balance?.id||null,p_fee:balance?.fee??null,p_available_at:balance?new Date(balance.available_on*1000).toISOString():null,
  p_payload:{id:eventId,type:eventType,session_id:s.id,payment_intent_id:intent?.id,charge_id:charge?.id,amount_cents:s.amount_total,currency:s.currency}}));
 // A charge can already be refunded when an older completion is delivered.
 if(paid&&charge!.amount_refunded)checked(await admin.rpc('reverse_credit_topup',{p_topup:t.id,p_event:'verified-refund:'+eventId,p_type:'verified_charge_refund',p_charge:charge!.id,p_refunded:Math.min(t.amount_cents,charge!.amount_refunded),p_disputed:result.disputed_cents||0,p_active:result.dispute_active||false,p_payload:{charge_id:charge!.id,refunded_cents:charge!.amount_refunded}}));
 return checked(await admin.from('credit_topups').select('*').eq('id',t.id).single());
}
export async function applyCreditPayment(event:Stripe.Event,stripe:Stripe,admin:SupabaseClient){
 if(event.livemode!==fundingLive())throw new Error('Wrong payment environment');
 if(event.type.startsWith('checkout.session.')){
  const raw=event.data.object as Stripe.Checkout.Session;
  if(!raw.metadata?.topup_id||raw.metadata.project_ref!==project())return false;
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type))return true;
  const t=checked(await admin.from('credit_topups').select('*').eq('id',raw.metadata.topup_id).single());
  const s=await stripe.checkout.sessions.retrieve(raw.id);await settleTopup(stripe,admin,t,s,event.id,event.type);return true;
 }
 if(event.type!=='charge.refunded'&&!event.type.startsWith('charge.dispute.'))return false;
 let dispute:Stripe.Dispute|undefined;
 if(event.type.startsWith('charge.dispute.'))dispute=await stripe.disputes.retrieve((event.data.object as Stripe.Dispute).id);
 const raw=event.data.object as Stripe.Charge,chargeId=dispute?(typeof dispute.charge==='string'?dispute.charge:dispute.charge.id):raw.id;
 const charge=await stripe.charges.retrieve(chargeId);
 if(!charge.metadata?.topup_id||charge.metadata.project_ref!==project())return false;
 const t=checked(await admin.from('credit_topups').select('*').eq('id',charge.metadata.topup_id).single());
 const intent=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
 if(charge.livemode!==fundingLive()||charge.amount!==t.amount_cents+(t.processing_fee_cents||0)||charge.currency!=='usd'||charge.metadata.user_id!==t.wallet_account||(t.stripe_payment_intent_id&&intent!==t.stripe_payment_intent_id))throw new Error('Funding reversal receipt mismatch');
 const restored=dispute&&['won','warning_closed'].includes(dispute.status),closed=dispute&&['won','lost','warning_closed'].includes(dispute.status);
 checked(await admin.rpc('reverse_credit_topup',{p_topup:t.id,p_event:event.id,p_type:event.type,p_charge:charge.id,p_refunded:Math.min(t.amount_cents,charge.amount_refunded),p_disputed:dispute?(restored?0:Math.min(t.amount_cents,dispute.amount)):t.disputed_cents,p_active:dispute?!closed:t.dispute_active,p_payload:{id:event.id,type:event.type,charge_id:charge.id,refunded_cents:charge.amount_refunded,dispute_id:dispute?.id,dispute_status:dispute?.status}}));
 return true;
}
