import {authenticate,checked,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin,claims}=await authenticate(req);
 if(claims.aal!=='aal2')throw new HttpError('Enable your authenticator in Profile and verify it before withdrawing.',403,'withdrawal_mfa_required');
 const {action,amountCents,requestId,confirmedFeeCents}=await req.json();
 if(action==='quote'){
  if(!Number.isSafeInteger(amountCents)||amountCents<100)throw new HttpError('Enter at least $1.');
  if((Deno.env.get('STRIPE_MODE')||'sandbox')==='live')throw new HttpError('Live withdrawals require the approved Connect transfer and payout fee schedule.',503,'withdrawal_fee_policy_required');
  return {creditsDebitedCents:amountCents,processingFeeCents:0,stripeTransferCents:amountCents,policy:'sandbox-transfer-no-fee',bankPayoutFee:'Shown by Stripe before a bank payout; bank arrival is not guaranteed by this transfer.'};
 }
 if(!Number.isSafeInteger(amountCents)||amountCents<100||!requestId)throw new HttpError('Enter at least $1.');
 const existing=checked(await admin.from('credit_withdrawals').select('id').eq('id',requestId).eq('user_id',user.id).maybeSingle());
 if(!existing){if((Deno.env.get('STRIPE_MODE')||'sandbox')==='live')throw new HttpError('Live withdrawal fees require configuration.',503,'withdrawal_fee_policy_required');if(confirmedFeeCents!==0)throw new HttpError('Review the transfer quote before confirming.',409);}
 const stripe=stripeClient(); // A withdrawal, unlike internal spending, requires external payments.
 const w=checked(await admin.rpc('reserve_credit_withdrawal',{p_user:user.id,p_amount:amountCents,p_request:requestId}));
 if(w.status==='paid')return {withdrawal:w};
 const group='NG_WITHDRAWAL_'+w.id;
 const prior=await stripe.transfers.list({transfer_group:group,limit:100});
 let transfer=prior.data.find(t=>t.metadata.withdrawal_id===w.id&&t.destination===w.destination&&t.amount===w.amount_cents);
 // Never create another transfer after Stripe's idempotency retention window.
 // Ambiguous/old requests remain held for operator reconciliation, never silently recredited.
 if(!transfer && Date.now()-new Date(w.created_at).getTime()>23*3600000)throw new HttpError('Withdrawal needs support review. Your reserved credits remain protected.',409,'withdrawal_review');
 if(!transfer){
  checked(await admin.rpc('credit_withdrawal_ready',{p_user:user.id,p_request:w.id}));
  const destination=await stripe.v2.core.accounts.retrieve(w.destination,{include:['configuration.recipient']});
  const capabilities=destination.configuration?.recipient?.capabilities?.stripe_balance;
  if(capabilities?.stripe_transfers?.status!=='active'||capabilities?.payouts?.status!=='active')throw new HttpError('Finish bank and payout setup in Stripe before retrying this same transfer. Reserved credits remain in your account.',409,'payout_setup_required');
  const balance=await stripe.balance.retrieve(),available=balance.available.filter(b=>b.currency==='usd').reduce((total,b)=>total+b.amount,0);
  if(available<w.amount_cents)throw new HttpError('Stripe funds are still settling. Retry this same transfer when the platform balance is available; your credits remain reserved.',409,'funds_settling');
 }
 transfer ||= await stripe.transfers.create({amount:w.amount_cents,currency:'usd',destination:w.destination,transfer_group:group,metadata:{withdrawal_id:w.id}},{idempotencyKey:group});
 const withdrawal=checked(await admin.from('credit_withdrawals').update({status:'paid',stripe_transfer_id:transfer.id,paid_at:new Date().toISOString()}).eq('id',w.id).select('*').single());
 return {withdrawal}; // Transfer to connected balance, not a guarantee of bank settlement.
}));
