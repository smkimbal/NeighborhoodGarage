import type Stripe from 'npm:stripe@22.6.0';
import {checked,HttpError} from './runtime.ts';
export async function recordReceipt(stripe:Stripe,admin:any,s:Stripe.Checkout.Session,record:any,extension=false,topup=false){
 const principal=topup?record.amount_cents:record.amount_due_cents,fee=record.processing_fee_cents||0;
 if(s.currency!=='usd'||s.amount_total!==principal+fee)throw new HttpError('Payment total does not match the confirmed fee quote.',409);
 if(s.payment_status!=='paid')return;
 const id=typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id;if(!id)throw new HttpError('Payment receipt unavailable.',409);
 const pi=await stripe.paymentIntents.retrieve(id,{expand:['latest_charge.balance_transaction']});
 if(pi.status!=='succeeded'||pi.amount_received!==principal+fee||pi.currency!=='usd'||pi.livemode!==s.livemode)throw new HttpError('Payment is not verified.',409);
 const c=typeof pi.latest_charge==='string'?await stripe.charges.retrieve(pi.latest_charge,{expand:['balance_transaction']}):pi.latest_charge;
 if(!c||!c.paid)throw new HttpError('Charge receipt is pending.',409);
 const bt=typeof c.balance_transaction==='object'?c.balance_transaction:null;
 const renter=topup?record.wallet_account:extension?checked<any>(await admin.from('rentals').select('renter_id').eq('id',record.rental_id).single()).renter_id:record.renter_id;
 if(s.metadata?.user_id!==renter)throw new HttpError('Payment account identity mismatch.',409);
 const receipt={charge_id:c.id,payment_intent_id:pi.id,session_id:s.id,wallet_account:renter,
 rental_id:topup?null:extension?record.rental_id:record.id,extension_id:extension?record.id:null,topup_id:topup?record.id:null,
 principal_cents:principal,processing_fee_cents:fee,actual_fee_cents:bt?.fee??null,available_at:bt?new Date(bt.available_on*1000).toISOString():null};
 // Do not overwrite reversal bookkeeping when a completion is replayed.
 checked(await admin.from('payment_receipts').upsert(receipt,{onConflict:'charge_id',ignoreDuplicates:true}));
 return c;
}
export async function reconcileRentalCharge(event:Stripe.Event,stripe:Stripe,admin:any){
 if(event.type!=='charge.refunded'&&!event.type.startsWith('charge.dispute.'))return false;
 let dispute:Stripe.Dispute|null=event.type.startsWith('charge.dispute.')?await stripe.disputes.retrieve((event.data.object as Stripe.Dispute).id):null;
 const charge=await stripe.charges.retrieve(dispute?(typeof dispute.charge==='string'?dispute.charge:dispute.charge.id):(event.data.object as Stripe.Charge).id);
 if(!dispute&&charge.disputed){const list=await stripe.disputes.list({charge:charge.id,limit:1});dispute=list.data[0]||null;}
 if(!charge.metadata?.rental_id||charge.metadata.project_ref!==new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0])return false;
 if(charge.livemode!==((Deno.env.get('STRIPE_MODE')||'sandbox')==='live'))throw new Error('Wrong payment environment');
 let receipt=checked<any>(await admin.from('payment_receipts').select('*').eq('charge_id',charge.id).maybeSingle());
 if(!receipt){
  const extension=Boolean(charge.metadata.extension_id),record=checked<any>(await admin.from(extension?'rental_extensions':'rentals').select('*').eq('id',charge.metadata.extension_id||charge.metadata.rental_id).single());
  if(!record.stripe_checkout_session_id)throw new Error('Payment completion must be reconciled first.');
  const s=await stripe.checkout.sessions.retrieve(record.stripe_checkout_session_id);if(s.metadata?.user_id!==charge.metadata.user_id||s.metadata?.rental_id!==charge.metadata.rental_id)throw new Error('Receipt identity mismatch');
  await recordReceipt(stripe,admin,s,record,extension);receipt=checked<any>(await admin.from('payment_receipts').select('*').eq('charge_id',charge.id).single());
 }
 if(receipt.payment_intent_id!==(typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id)||charge.amount!==receipt.principal_cents+receipt.processing_fee_cents)throw new Error('Charge mismatch');
 const restored=dispute&&['won','warning_closed'].includes(dispute.status),closed=dispute&&['won','lost','warning_closed'].includes(dispute.status);
 checked(await admin.rpc('reconcile_rental_charge',{p_charge:charge.id,p_event:event.id,p_created:event.created,p_refunded:charge.amount_refunded,p_disputed:dispute?(restored?0:dispute.amount):receipt.disputed_cents,p_active:dispute?!closed:receipt.dispute_active}));return true;
}

/** Refresh only provider-verified settlement data; do not change ledger/reversal fields. */
export async function refreshSettlements(stripe:Stripe,admin:any){
 const rows=checked<any[]>(await admin.from('payment_receipts').select('charge_id,payment_intent_id,principal_cents,processing_fee_cents').is('available_at',null).order('created_at').limit(10))||[];
 for(const row of rows){
  const c=await stripe.charges.retrieve(row.charge_id,{expand:['balance_transaction']});
  const pi=typeof c.payment_intent==='string'?c.payment_intent:c.payment_intent?.id;
  if(pi!==row.payment_intent_id||c.amount!==row.principal_cents+row.processing_fee_cents||c.currency!=='usd')throw new Error('Settlement identity mismatch');
  const bt=typeof c.balance_transaction==='object'?c.balance_transaction:null;
  if(bt)checked(await admin.from('payment_receipts').update({available_at:new Date(bt.available_on*1000).toISOString(),actual_fee_cents:bt.fee}).eq('charge_id',c.id));
 }
}
