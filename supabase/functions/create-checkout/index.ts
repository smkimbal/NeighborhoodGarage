import {authenticate,checked,checkedUrl,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
import {recoverCheckout,releaseMissingCheckout} from '../_shared/checkout-session.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req),body=await req.json();
 const success=checkedUrl(body.successUrl),cancel=checkedUrl(body.cancelUrl);
 // Legacy frontends create approval requests, never automatic charges.
 if(!body.rentalId&&!body.extensionId){
  if(!Number.isInteger(body.days)||body.days<1||body.days>30||!body.requestId)throw new HttpError('Request a reservation first.');
  const rental=checked(await admin.rpc('reserve_rental',{p_user:user.id,p_tool:body.toolId,p_days:body.days,p_request:body.requestId}));return {rental,reservationRequested:true};
 }
 const extension=Boolean(body.extensionId);
 const record=checked(await admin.rpc(extension?'begin_extension_checkout':'begin_rental_checkout',extension?{p_user:user.id,p_extension:body.extensionId}:{p_user:user.id,p_rental:body.rentalId}));
 if(record.status===(extension?'paid':'reserved'))return {paid:true,...(extension?{extension:record}:{rental:record})};
 if(record.status!=='pending_payment')throw new HttpError('This checkout has ended. Open My rentals.');
 const stripe=stripeClient(); // Credit-only rentals AND extensions return before Stripe.
 const existing=await recoverCheckout(stripe,admin,record,extension);
 if(existing){if(existing.status==='open')return {checkoutUrl:existing.url};throw new HttpError('Check payment status in My rentals to reconcile a completed or expired checkout.');}
 if(new Date(record.checkout_expires_at).getTime()<Date.now()+1800000){await releaseMissingCheckout(admin,user.id,record,extension);return {released:true};}
 const rentalId=extension?record.rental_id:record.id;
 const metadata={rental_id:rentalId,user_id:user.id,project_ref:new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0],...(extension?{extension_id:record.id}:{})};
 const session=await stripe.checkout.sessions.create({mode:'payment',success_url:success,cancel_url:cancel,client_reference_id:extension?rentalId+':'+record.id:rentalId,metadata,
  line_items:[{price_data:{currency:'usd',unit_amount:record.amount_due_cents,product_data:{name:extension?'Neighborhood Garage approved rental extension':'Neighborhood Garage approved rental and refundable deposit'}},quantity:1}],
  payment_intent_data:{metadata,transfer_group:'RENTAL_'+rentalId},expires_at:Math.floor(new Date(record.checkout_expires_at).getTime()/1000),integration_identifier:'neighborhood_garage_ajdkeqps'
 },{idempotencyKey:(extension?'ng-extension-':'ng-checkout-')+record.id});
 checked(await admin.from(extension?'rental_extensions':'rentals').update({stripe_checkout_session_id:session.id}).eq('id',record.id).eq('status','pending_payment'));
 return {checkoutUrl:session.url,...(extension?{extension:record}:{rental:record})};
}));
