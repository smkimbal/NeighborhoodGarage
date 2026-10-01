import Stripe from 'npm:stripe@22.6.0';
import {StripeSync} from 'npm:@stripe/sync-engine@1.0.32';
import {stripeClient} from '../_shared/runtime.ts';
import {applyRentalPayment} from '../_shared/rental-payment.ts';

// Preserve the installed Supabase Stripe Sync integration AND fulfill app rentals.
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Use POST',{status:405});
 const signature=req.headers.get('Stripe-Signature');
 if(!signature)return new Response('Missing stripe-signature header',{status:400});
 const rawBody=new Uint8Array(await req.arrayBuffer());
 let sync:StripeSync|undefined;
 try{
  const databaseUrl=Deno.env.get('SUPABASE_DB_URL');
  const useSync=Deno.env.get('STRIPE_SYNC_ENABLED')==='true'||Deno.env.get('SUPABASE_URL')==='https://ilfpugydxlzmmxjfrmrv.supabase.co';
  if(databaseUrl&&useSync){
   const schemaName=Deno.env.get('SYNC_SCHEMA_NAME')||'stripe';
   sync=await StripeSync.create({poolConfig:{connectionString:databaseUrl,max:1},stripeSecretKey:Deno.env.get('STRIPE_SECRET_KEY')!,partnerId:'pp_supabase',schemaName,syncTablesSchemaName:Deno.env.get('SYNC_TABLES_SCHEMA_NAME')||schemaName});
   // Sync verifies the signature with its managed webhook secret before any processing.
   await sync.webhook.processWebhook(rawBody,signature);
  }else{
   const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');
   if(!secret)return new Response('Webhook not configured',{status:503});
   await stripeClient().webhooks.constructEventAsync(rawBody,signature,secret,undefined,Stripe.createSubtleCryptoProvider());
  }
  const event=JSON.parse(new TextDecoder().decode(rawBody)) as Stripe.Event;
  await applyRentalPayment(event);
  return new Response('ok');
 }catch(error){
  const e=error as {message?:string,type?:string};
  console.error(JSON.stringify({component:'neighborhood-garage-webhook',message:e.message||'Webhook processing failed'}));
  const invalid=e.type==='StripeSignatureVerificationError'||/signature|Wrong payment environment/i.test(e.message||'');
  return new Response(invalid?'Invalid webhook signature or environment':'Processing failed; retry event',{status:invalid?400:500});
 }finally{if(sync)await sync.postgresClient.pool.end();}
});
