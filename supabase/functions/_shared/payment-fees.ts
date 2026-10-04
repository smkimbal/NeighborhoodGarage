import {HttpError} from './runtime.ts';
/** Sandbox schedule, deliberately not a representation of the merchant's live contract. */
export function paymentQuote(principal:number){
 if(!Number.isSafeInteger(principal)||principal<0)throw new HttpError('Invalid payment amount.');
 if(principal===0)return {principalCents:0,processingFeeCents:0,totalCents:0,policy:'credits-no-fee'};
 if((Deno.env.get('STRIPE_MODE')||'sandbox')==='live')throw new HttpError('Live external payments require an approved payment-method and jurisdiction-specific fee policy. Credit-only spending remains available.',503,'live_fee_policy_required');
 // Gross-up includes the processor percentage on the processing fee itself.
 const total=Math.ceil((principal+30)*10000/9710);
 return {principalCents:principal,processingFeeCents:total-principal,totalCents:total,policy:'sandbox-domestic-2.9-30-v1'};
}
export function feeLine(cents:number){return {price_data:{currency:'usd',unit_amount:cents,product_data:{name:'Payment processing fee',description:'Separate from rental price, refundable deposit and 5% platform rental fee. No fee for internal credit spending.'}},quantity:1};}
