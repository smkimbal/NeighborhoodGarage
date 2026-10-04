import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';
export async function edgeHandler(file,runtime){
 const Deno={serve:h=>{Deno.handler=h;},env:{get:k=>runtime.env?.(k)??(k==='SUPABASE_URL'?'https://zbbespojxxoheavodtqs.supabase.co':undefined)}};
 const helpers={};
 async function load(path,names){
  const source=(await readFile('supabase/functions/_shared/'+path+'.ts','utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
  const {code}=await transform(source,{loader:'ts',format:'esm'});
  const scope={Deno,...runtime,...helpers};
  Object.assign(helpers,new Function(...Object.keys(scope),code+'\nreturn {'+names.join(',')+'};')(...Object.values(scope)));
 }
 await load('checkout-session',['recoverCheckout','releaseMissingCheckout','matchesCheckout']);
 await load('payment-fees',['paymentQuote','feeLine']);
 await load('receipts',['recordReceipt','reconcileRentalCharge','refreshSettlements']);
 await load('reconcile-rentals',['reconcileRentals']);
 await load('credit-funding',['fundingLive','fundingEnabled','matchesTopup','recoverTopup','settleTopup','applyCreditPayment']);
 await load('image-safety',['sanitizeImage']);
 const imports={itemCode:value=>value,...helpers,...runtime},main=(await readFile(file,'utf8')).replace(/^import .*;\n/gm,'');
 const {code}=await transform(main,{loader:'ts',format:'esm'});new Function('Deno',...Object.keys(imports),code)(Deno,...Object.values(imports));Deno.handler.creditHelpers=helpers;return Deno.handler;
}
