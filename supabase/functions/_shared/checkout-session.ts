import type Stripe from 'npm:stripe@22.6.0';
import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.95.0';
import {checked,HttpError} from './runtime.ts';
export function matchesCheckout(s:Stripe.Checkout.Session,rentalId:string,extensionId?:string){
 const projectRef=new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0];
 return s.livemode===((Deno.env.get('STRIPE_MODE')||'sandbox')==='live')&&s.metadata?.project_ref===projectRef&&s.metadata?.rental_id===rentalId&&s.metadata?.extension_id===(extensionId||undefined)&&s.client_reference_id===(extensionId?rentalId+':'+extensionId:rentalId);
}
export async function recoverCheckout(stripe:Stripe,admin:SupabaseClient,record:any,extension=false){
 const rentalId=extension?record.rental_id:record.id,extensionId=extension?record.id:undefined;let session:Stripe.Checkout.Session|undefined;
 if(record.stripe_checkout_session_id)session=await stripe.checkout.sessions.retrieve(record.stripe_checkout_session_id);
 else{
  const gte=Math.floor((new Date(record.checkout_expires_at).getTime()-31*60000)/1000)-60;let after:string|undefined;
  // Finish pagination before treating a missing provider session as absent.
  for(let page=0;page<20;page++){
   const result=await stripe.checkout.sessions.list({created:{gte},limit:100,...(after?{starting_after:after}:{})});
   for(const candidate of result.data)if(matchesCheckout(candidate,rentalId,extensionId)){if(session&&session.id!==candidate.id)throw new HttpError('Multiple payment sessions need support reconciliation.',409);session=candidate;}
   if(!result.has_more)break;if(page===19)throw new HttpError('Payment history is still being checked. Please retry; no credits have been released.',503);
   after=result.data.at(-1)?.id;if(!after)throw new HttpError('Payment history could not be verified.',503);
  }
 }
 if(session){if(!matchesCheckout(session,rentalId,extensionId))throw new HttpError('Payment does not match this rental.',409);if(!record.stripe_checkout_session_id)checked(await admin.from(extension?'rental_extensions':'rentals').update({stripe_checkout_session_id:session.id}).eq('id',record.id).eq('status','pending_payment').is('stripe_checkout_session_id',null));}
 return session;
}
export async function releaseMissingCheckout(admin:SupabaseClient,userId:string,record:any,extension=false){
 if(new Date(record.checkout_expires_at).getTime()>Date.now())throw new HttpError('Payment creation is being reconciled. Retry Check payment status after '+new Date(record.checkout_expires_at).toISOString()+'. Your held credits will be released if no payment session exists.',409);
 checked(await admin.rpc('release_uncreated_checkout',{p_user:userId,p_rental:extension?record.rental_id:record.id,p_extension:extension?record.id:null}));
}
