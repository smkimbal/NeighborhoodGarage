import {authenticate,checked,checkedUrl,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
import {fundingLive,fundingEnabled,recoverTopup,settleTopup} from '../_shared/credit-funding.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req),body=await req.json();
 if(body.action==='options')return {sandbox:!fundingLive(),enabled:fundingEnabled(),minimumCents:100,maximumCents:50000};
 const create=body.action==='create';
 if(!['create','status','cancel'].includes(body.action))throw new HttpError('Choose Add funds, Check payment, or Cancel funding.');
 if(create&&!fundingEnabled())throw new HttpError('Live credit funding requires Stripe approval of the prepaid-credit and withdrawal model.',503,'funding_approval_required');
 if(create&&(!Number.isSafeInteger(body.amountCents)||body.amountCents<100||body.amountCents>50000))throw new HttpError('Add between $1 and $500.');
 const id=create?body.requestId:body.topupId;
 if(typeof id!=='string'||!/^([0-9a-f]{8}-){1}[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError('Invalid funding request.');
 // Check the callback before reserving anything.
 const back=create?new URL(checkedUrl(body.returnUrl)):null;
 const t=create?checked(await admin.rpc('create_credit_topup',{p_user:user.id,p_amount:body.amountCents,p_request:id})):checked(await admin.from('credit_topups').select('*').eq('id',id).eq('user_id',user.id).single());
 if(t.user_id!==user.id)throw new HttpError('Funding request unavailable.',404);
 if(t.status==='paid')return {topup:t,paid:true};
 if(t.status!=='pending_payment')return {topup:t};
 const stripe=stripeClient();let s=await recoverTopup(stripe,admin,t);
 if(s){
  if(body.action==='cancel'&&s.status==='open')s=await stripe.checkout.sessions.expire(s.id);
  if(s.payment_status==='paid'||s.status==='expired'){
   const topup=await settleTopup(stripe,admin,t,s,'verified-topup:'+s.id+':'+s.payment_status+':'+s.status,s.status==='expired'?'verified_checkout_cancel':'verified_checkout_sync');return {topup,paid:topup.status==='paid'};
  }
  return {topup:t,...(s.status==='open'?{checkoutUrl:s.url}:{awaitingPayment:true})};
 }
 if(new Date(t.checkout_expires_at).getTime()<=Date.now())return {topup:checked(await admin.rpc('cancel_uncreated_credit_topup',{p_user:user.id,p_topup:t.id}))};
 if(!create)throw new HttpError('Funding creation is being reconciled. Retry after '+t.checkout_expires_at+'. No credits have been added.',409);
 if(new Date(t.checkout_expires_at).getTime()<Date.now()+1800000)throw new HttpError('Retry the existing funding request after its checkout deadline.',409);
 const metadata={kind:'tool_share_credits',topup_id:t.id,user_id:user.id,project_ref:new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0]};
 back!.hash='/profile?wallet=funds&topup='+t.id;const cancel=new URL(back!);cancel.hash+='&funding=cancelled';
 s=await stripe.checkout.sessions.create({mode:'payment',success_url:back!.toString(),cancel_url:cancel.toString(),client_reference_id:'topup:'+t.id,metadata,
  line_items:[{price_data:{currency:'usd',unit_amount:t.amount_cents,product_data:{name:'Neighborhood Garage Tool Share Credits',description:'Prepaid credits for tool rentals. Added only after payment confirmation.'}},quantity:1}],
  payment_intent_data:{metadata,transfer_group:'NG_CREDITS_'+t.id},expires_at:Math.floor(new Date(t.checkout_expires_at).getTime()/1000),integration_identifier:'neighborhood_garage_credits_qmvaejkt'
 },{idempotencyKey:'ng-credit-topup-'+t.id});
 checked(await admin.from('credit_topups').update({stripe_checkout_session_id:s.id}).eq('id',t.id).eq('status','pending_payment').is('stripe_checkout_session_id',null));
 return {topup:t,checkoutUrl:s.url};
}));
