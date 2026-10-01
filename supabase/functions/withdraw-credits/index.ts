import {authenticate,checked,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req);
 const {amountCents,requestId}=await req.json();
 if(!Number.isSafeInteger(amountCents)||amountCents<100||!requestId)throw new HttpError('Enter at least $1.');
 const stripe=stripeClient(); // A withdrawal, unlike internal spending, requires external payments.
 const w=checked(await admin.rpc('reserve_credit_withdrawal',{p_user:user.id,p_amount:amountCents,p_request:requestId}));
 if(w.status==='paid')return {withdrawal:w};
 const group='NG_WITHDRAWAL_'+w.id;
 const prior=await stripe.transfers.list({transfer_group:group,limit:100});
 let transfer=prior.data.find(t=>t.metadata.withdrawal_id===w.id&&t.destination===w.destination&&t.amount===w.amount_cents);
 // Never create another transfer after Stripe's idempotency retention window.
 // Ambiguous/old requests remain held for operator reconciliation, never silently recredited.
 if(!transfer && Date.now()-new Date(w.created_at).getTime()>23*3600000)throw new HttpError('Withdrawal needs support review. Your reserved credits remain protected.',409,'withdrawal_review');
 transfer ||= await stripe.transfers.create({amount:w.amount_cents,currency:'usd',destination:w.destination,transfer_group:group,metadata:{withdrawal_id:w.id}},{idempotencyKey:group});
 const withdrawal=checked(await admin.from('credit_withdrawals').update({status:'paid',stripe_transfer_id:transfer.id,paid_at:new Date().toISOString()}).eq('id',w.id).select('*').single());
 return {withdrawal}; // Transfer to connected balance, not a guarantee of bank settlement.
}));
