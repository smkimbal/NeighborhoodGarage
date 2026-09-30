import type Stripe from 'npm:stripe@22.6.0';
import {adminClient,checked} from './runtime.ts';

// Invoke only AFTER signature verification. finish_payment enforces replay and amount checks.
export async function applyRentalPayment(event:Stripe.Event){
 const live=(Deno.env.get('STRIPE_MODE')||'sandbox')==='live';
 if(event.livemode!==live)throw new Error('Wrong payment environment');
 const paid=['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type);
 const failed=['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type);
 if(!paid&&!failed)return;
 const s=event.data.object as Stripe.Checkout.Session;
 const projectRef=new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0];
 // A shared Stripe sandbox may deliver both projects' events to this endpoint.
 if(s.metadata?.project_ref && s.metadata.project_ref!==projectRef)return;
 if(projectRef==='zbbespojxxoheavodtqs' && s.metadata?.project_ref!==projectRef)return;
 if(paid&&s.payment_status!=='paid')return;
 if(!s.metadata?.rental_id)return;
 checked(await adminClient().rpc('finish_payment',{p_event:event.id,p_type:event.type,p_session:s.id,p_rental:s.metadata.rental_id,p_paid:paid,p_amount:s.amount_total,p_currency:s.currency,p_intent:typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id||null,p_payload:{id:event.id,type:event.type,session_id:s.id}}));
}
