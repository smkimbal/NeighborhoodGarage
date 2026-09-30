import {authenticate,checked,checkedUrl,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req);
 const {toolId,days,successUrl,cancelUrl,requestId}=await req.json();
 if(!Number.isInteger(days)||days<1||days>30||!requestId)throw new HttpError('Choose 1–30 days and retry checkout.');
 const success=checkedUrl(successUrl),cancel=checkedUrl(cancelUrl);
 const r=checked(await admin.rpc('reserve_rental',{p_user:user.id,p_tool:toolId,p_days:days,p_request:requestId}));
 if(r.status==='reserved')return {paid:true,rental:r};
 const stripe=stripeClient(); // Credit-only reservations return above without Stripe configuration or calls.
 if(r.status!=='pending_payment')throw new HttpError('This checkout has ended. Start a new reservation.');
 if(r.stripe_checkout_session_id){const existing=await stripe.checkout.sessions.retrieve(r.stripe_checkout_session_id);if(existing.status==='open')return {checkoutUrl:existing.url,rental:r};throw new HttpError('Payment is processing or checkout has ended. Check My rentals.');}
 const session=await stripe.checkout.sessions.create({
  mode:'payment',success_url:success,cancel_url:cancel+(cancel.includes('?')?'&':'?')+'payment=cancel&rental='+r.id,
  client_reference_id:r.id,metadata:{rental_id:r.id,user_id:user.id},
  line_items:[{price_data:{currency:'usd',unit_amount:r.amount_due_cents,product_data:{name:'Neighborhood Garage tool rental and refundable deposit'}},quantity:1}],
  payment_intent_data:{metadata:{rental_id:r.id},transfer_group:'RENTAL_'+r.id},
  expires_at:Math.floor(new Date(r.created_at).getTime()/1000)+1860,
  integration_identifier:'neighborhood_garage_ajdkeqps'
 },{idempotencyKey:'ng-checkout-'+r.id});
 checked(await admin.from('rentals').update({stripe_checkout_session_id:session.id}).eq('id',r.id).eq('status','pending_payment'));
 return {rental:r,checkoutUrl:session.url};
}));
