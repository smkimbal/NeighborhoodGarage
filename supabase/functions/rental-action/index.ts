import {authenticate,checked,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
import {assessReturn} from '../_shared/vision.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req);
 const body=await req.json(),{rentalId,action}=body;
 let r=checked(await admin.from('rentals').select('*').eq('id',rentalId).single());
 if(![r.owner_id,r.renter_id].includes(user.id))throw new HttpError('Rental not found.',404);
 let data:Record<string,unknown>={code:body.code};
 if(action==='return'){
  if(r.renter_id!==user.id||r.status!=='out')throw new HttpError('Return is unavailable.');
  const path=String(body.returnPhotoPath||'');
  if(!path.startsWith(`${user.id}/${r.id}/`))throw new HttpError('Invalid return photo.');
  checked(await admin.storage.from('return-photos').download(path));
  let assessment:Record<string,unknown>={source:'manual',note:'AI is unavailable. The owner must compare the original and return photographs.'};
  if(Deno.env.get('OPENAI_API_KEY')){
   try{checked(await admin.rpc('take_ai_slot',{p_user:user.id}));assessment=await assessReturn(admin,r,path);}catch{assessment.note='AI could not assess this return. Owner review is required.';}
  }
  data={photo:path,handoff:body.handoffMethod,code:body.code,assessment:{...assessment,renterNote:String(body.note||'').slice(0,500)}};
 }
 if(action==='cancel'){
  if(r.renter_id!==user.id||r.status!=='pending_payment')throw new HttpError('Cancellation is not available.');
  // Never free a tool after an ambiguous network error or already completed payment.
  if(!r.stripe_checkout_session_id)throw new HttpError('Checkout is still being created. Retry checkout to recover its session before cancelling.');
  const stripe=stripeClient();
  const session=await stripe.checkout.sessions.retrieve(r.stripe_checkout_session_id);
  if(session.status==='complete')throw new HttpError('Payment is processing or complete; this checkout cannot be cancelled.');
  if(session.status!=='expired')await stripe.checkout.sessions.expire(session.id);
 }
 if(action!=='retry-payout')r=checked(await admin.rpc('change_rental',{p_user:user.id,p_rental:r.id,p_action:action,p_data:data}));
 let payoutWarning:string|undefined;
 if((action==='approve'||action==='retry-payout')&&r.owner_id===user.id&&r.status==='complete'&&r.payout_status==='pending'){
  try{
   const owner=checked(await admin.from('profiles').select('stripe_account_id,stripe_onboarding_complete').eq('id',user.id).single());
   if(!owner||!owner.stripe_account_id||!owner.stripe_onboarding_complete)throw new Error('Finish owner payout setup.');
   const stripe=stripeClient();
   // Credits may fund this loan: pay from the platform balance rather than an unrelated card charge.
   const prior=await stripe.transfers.list({transfer_group:'RENTAL_'+r.id,limit:100});
   const previous=prior.data.find(t=>t.metadata.rental_id===r.id&&t.amount===r.owner_payout_cents&&t.destination===owner.stripe_account_id);
   const transfer=previous||await stripe.transfers.create({amount:r.owner_payout_cents,currency:'usd',destination:owner.stripe_account_id,transfer_group:'RENTAL_'+r.id,metadata:{rental_id:r.id}},{idempotencyKey:'ng-owner-payout-'+r.id});
   r=checked(await admin.from('rentals').update({stripe_transfer_id:transfer.id,payout_status:'paid'}).eq('id',r.id).select('*').single());
  }catch{payoutWarning='Deposit credits were returned. Owner payout is pending; retry from My garage after checking Stripe balance and payout setup.';}
 }
 if(action==='retry-payout'&&(r.owner_id!==user.id||r.status!=='complete'))throw new HttpError('Payout retry is unavailable.');
 return {rental:r,payoutWarning};
}));
