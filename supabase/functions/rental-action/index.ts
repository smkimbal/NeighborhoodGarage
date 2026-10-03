import {authenticate,checked,endpoint,HttpError,stripeClient,itemCode} from '../_shared/runtime.ts';
import {recoverCheckout,releaseMissingCheckout} from '../_shared/checkout-session.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req),body=await req.json(),{rentalId,action}=body;
 let r=checked(await admin.from('rentals').select('*').eq('id',rentalId).single());
 if(!r||![r.owner_id,r.renter_id].includes(user.id))throw new HttpError('Rental not found.',404);
 const validateSession=(s:any,extensionId?:string)=>{
  const projectRef=new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0];
  if(s.livemode!==((Deno.env.get('STRIPE_MODE')||'sandbox')==='live')||s.metadata?.project_ref!==projectRef||s.metadata?.rental_id!==r.id||s.client_reference_id!==(extensionId?r.id+':'+extensionId:r.id)||s.metadata?.extension_id!==(extensionId||undefined))throw new HttpError('Payment does not match this rental.',409);
 };
 const photo=async(path:unknown)=>{if(typeof path!=='string'||!path.startsWith(user.id+'/'+r.id+'/'))throw new HttpError('Upload an inspection or return photo for this rental.');checked(await admin.storage.from('return-photos').download(path));return path;};
 if(action==='sync-payment'){
  if(r.status!=='pending_payment')return {rental:r};const s=await recoverCheckout(stripeClient(),admin,r);if(!s){await releaseMissingCheckout(admin,user.id,r);return {released:true};}validateSession(s);
  if(s.status!=='expired'&&(s.status!=='complete'||s.payment_status!=='paid'))throw new HttpError('Stripe has not confirmed this payment yet.');
  checked(await admin.rpc('finish_payment',{p_event:'reconcile:'+s.id,p_type:'checkout.session.reconciled',p_session:s.id,p_rental:r.id,p_paid:s.status==='complete',p_amount:s.amount_total,p_currency:s.currency,p_intent:typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id||null,p_payload:{session_id:s.id,source:'stripe_api'}}));return {rental:checked(await admin.from('rentals').select('*').eq('id',r.id).single())};
 }
 if(['approve-extension','decline-extension','cancel-extension','sync-extension'].includes(action)){
  const e=checked(await admin.from('rental_extensions').select('*').eq('id',body.extensionId).eq('rental_id',r.id).single());if(!e)throw new HttpError('Extension not found.',404);let safe=false;
  if(action==='sync-extension'){
   if(e.status!=='pending_payment')return {extension:e};const s=await recoverCheckout(stripeClient(),admin,e,true);if(!s){await releaseMissingCheckout(admin,user.id,e,true);return {released:true};}validateSession(s,e.id);
   if(s.status!=='expired'&&(s.status!=='complete'||s.payment_status!=='paid'))throw new HttpError('Stripe has not confirmed the extension payment yet.');
   checked(await admin.rpc('finish_extension_payment',{p_event:'reconcile:'+s.id,p_type:'checkout.session.reconciled',p_session:s.id,p_extension:e.id,p_paid:s.status==='complete',p_amount:s.amount_total,p_currency:s.currency,p_intent:typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id||null,p_payload:{session_id:s.id,source:'stripe_api'}}));return {extension:checked(await admin.from('rental_extensions').select('*').eq('id',e.id).single())};
  }
  if(action==='cancel-extension'&&e.status==='pending_payment'){
   const stripe=stripeClient(),s=await recoverCheckout(stripe,admin,e,true);if(!s){await releaseMissingCheckout(admin,user.id,e,true);return {released:true};}validateSession(s,e.id);if(s.status==='complete')throw new HttpError('Check the extension payment status before cancelling.');if(s.status!=='expired')await stripe.checkout.sessions.expire(s.id);safe=true;
  }
  return {extension:checked(await admin.rpc('change_rental_extension',{p_user:user.id,p_extension:e.id,p_action:action.split('-')[0],p_safe:safe}))};
 }
 let data:Record<string,unknown>={...body};delete data.rentalId;delete data.action;delete data.paymentSafe;
 if(action==='pickup')data.code=itemCode(body.code);
 if(action==='return'){
  if(r.renter_id!==user.id||r.physical_state!=='out'||!['out','review','disputed','complete'].includes(r.status))throw new HttpError('Return is unavailable.');
  data={photo:await photo(body.returnPhotoPath),handoff:body.handoffMethod,code:body.handoffMethod==='scan'?itemCode(body.code):null,assessment:{source:'manual',note:'Compare the original and return photos. Normal wear is acceptable; deductions require documented damage and renter agreement.',renterNote:String(body.note||'').slice(0,500)}};
 }
 if(action==='claim-damage')data.photo=await photo(body.inspectionPhotoPath);
 if(action==='cancel'&&r.status==='pending_payment'){
  const stripe=stripeClient(),s=await recoverCheckout(stripe,admin,r);if(!s){await releaseMissingCheckout(admin,user.id,r);return {released:true};}validateSession(s);if(s.status==='complete')throw new HttpError('Payment is processing or complete. Check payment status before cancelling.');if(s.status!=='expired')await stripe.checkout.sessions.expire(s.id);data.paymentSafe=true;
 }
 if(action!=='retry-payout')r=checked(await admin.rpc('change_rental',{p_user:user.id,p_rental:r.id,p_action:action,p_data:data}));
 let payoutWarning:string|undefined;
 if(action==='retry-payout'&&r.owner_id===user.id&&r.status==='complete'&&r.payout_status==='pending'){
  try{
   const owner=checked(await admin.from('profiles').select('stripe_account_id,stripe_onboarding_complete').eq('id',user.id).single());if(!owner?.stripe_account_id||!owner.stripe_onboarding_complete)throw new Error('Finish owner payout setup.');
   const stripe=stripeClient(),prior=await stripe.transfers.list({transfer_group:'RENTAL_'+r.id,limit:100}),previous=prior.data.find(t=>t.metadata.rental_id===r.id&&t.amount===r.owner_payout_cents&&t.destination===owner.stripe_account_id);
   const transfer=previous||await stripe.transfers.create({amount:r.owner_payout_cents,currency:'usd',destination:owner.stripe_account_id,transfer_group:'RENTAL_'+r.id,metadata:{rental_id:r.id}},{idempotencyKey:'ng-owner-payout-'+r.id});r=checked(await admin.from('rentals').update({stripe_transfer_id:transfer.id,payout_status:'paid'}).eq('id',r.id).select('*').single());
  }catch{payoutWarning='Owner payout is pending; retry from My garage after checking Stripe balance and payout setup.';}
 }
 if(action==='retry-payout'&&(r.owner_id!==user.id||r.status!=='complete'))throw new HttpError('Payout retry is unavailable.');return {rental:r,payoutWarning};
}));
