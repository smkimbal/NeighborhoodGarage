import type Stripe from 'npm:stripe@22.6.0';
import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.95.0';
import {checked} from './runtime.ts';
import {recoverCheckout,releaseMissingCheckout} from './checkout-session.ts';

/** Provider state is verified before releasing holds. Deposit deadlines are independent. */
export async function reconcileRentals(admin:SupabaseClient,stripe:Stripe){
 const now=new Date().toISOString(),deadline=Date.now()+45000;
 const [rentalResult,expiredResult,returnedResult]=await Promise.all([
  admin.from('rentals').select('*').eq('status','pending_payment').lt('checkout_expires_at',now).order('checkout_expires_at').limit(10),
  admin.from('rental_extensions').select('*,parent:rentals!rental_extensions_rental_id_fkey(status,renter_id)').eq('status','pending_payment').lt('checkout_expires_at',now).order('checkout_expires_at').limit(10),
  admin.from('rental_extensions').select('*,parent:rentals!rental_extensions_rental_id_fkey!inner(status,renter_id)').eq('status','pending_payment').in('parent.status',['review','disputed','complete','cancelled']).order('checkout_expires_at').limit(10)
 ]);
 const rentals=checked(rentalResult)||[],extensions=[...new Map([...(checked(expiredResult)||[]),...(checked(returnedResult)||[])].map((e:any)=>[e.id,e])).values()];
 let reconciled=0,deferred=0;const errors:string[]=[];
 for(const [record,extension] of [...rentals.map((r:any)=>[r,false] as const),...extensions.map((e:any)=>[e,true] as const)]){
  if(Date.now()>deadline){deferred++;continue;}
  try{
   const session=await recoverCheckout(stripe,admin,record,extension);
   if(!session){await releaseMissingCheckout(admin,extension?record.parent.renter_id:record.renter_id,record,extension);reconciled++;continue;}
   let verified=session;
   if(session.status==='open')verified=await stripe.checkout.sessions.expire(session.id);
   if(verified.id!==session.id)throw new Error('Provider session changed during verification.');
   if(verified.status!=='expired'&&(verified.status!=='complete'||verified.payment_status!=='paid')){deferred++;continue;}
   checked(await admin.rpc(extension?'finish_extension_payment':'finish_payment',{
    p_event:'reconcile:'+verified.id,p_type:'checkout.session.reconciled',p_session:verified.id,
    ...(extension?{p_extension:record.id}:{p_rental:record.id}),p_paid:verified.status==='complete',
    p_amount:verified.amount_total,p_currency:verified.currency,
    p_intent:typeof verified.payment_intent==='string'?verified.payment_intent:verified.payment_intent?.id||null,
    p_payload:{session_id:verified.id,source:'scheduled_stripe_verification'}
   }));reconciled++;
  }catch(error){deferred++;errors.push(error instanceof Error?error.message:'Payment verification unavailable');}
 }
 const deadlineRefunds=checked(await admin.rpc('process_rental_deadlines'));
 return {reconciled,deferred,deadlineRefunds,errors};
}
