import Stripe from 'npm:stripe@22.6.0';
import {adminClient,checked,stripeClient} from '../_shared/runtime.ts';
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Use POST',{status:405});
 const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');if(!secret)return new Response('Webhook not configured',{status:503});
 let event:Stripe.Event;
 try{event=await stripeClient().webhooks.constructEventAsync(await req.text(),req.headers.get('Stripe-Signature')||'',secret,undefined,Stripe.createSubtleCryptoProvider());}catch{return new Response('Invalid webhook signature or configuration',{status:400});}
 const live=(Deno.env.get('STRIPE_MODE')||'sandbox')==='live';if(event.livemode!==live)return new Response('Wrong payment environment',{status:400});
 try{
  const paid=['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type);
  const failed=['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type);
  if(!paid&&!failed)return new Response('ignored');
  const s=event.data.object as Stripe.Checkout.Session;
  if(paid&&s.payment_status!=='paid')return new Response('awaiting payment');
  if(!s.metadata?.rental_id)return new Response('ignored');
  checked(await adminClient().rpc('finish_payment',{p_event:event.id,p_type:event.type,p_session:s.id,p_rental:s.metadata.rental_id,p_paid:paid,p_amount:s.amount_total,p_currency:s.currency,p_intent:typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id||null,p_payload:{id:event.id,type:event.type,session_id:s.id}}));
  return new Response('ok');
 }catch(e){console.error(JSON.stringify({eventId:event.id,message:(e as Error).message}));return new Response('Processing failed; retry event',{status:500});}
});
