import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';
export async function edgeHandler(file,runtime){
 const Deno={serve:h=>{Deno.handler=h;},env:{get:k=>runtime.env?.(k)??(k==='SUPABASE_URL'?'https://zbbespojxxoheavodtqs.supabase.co':undefined)}};
 const source=(await readFile('supabase/functions/_shared/checkout-session.ts','utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const helper=(await transform(source,{loader:'ts',format:'esm'})).code;
 const helpers=new Function('Deno','checked','HttpError',helper+'\nreturn {recoverCheckout,releaseMissingCheckout,matchesCheckout};')(Deno,runtime.checked,runtime.HttpError);
 const reconciliation=(await readFile('supabase/functions/_shared/reconcile-rentals.ts','utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const compiled=(await transform(reconciliation,{loader:'ts',format:'esm'})).code;
 helpers.reconcileRentals=new Function('checked','recoverCheckout','releaseMissingCheckout',compiled+'\nreturn reconcileRentals;')(runtime.checked,helpers.recoverCheckout,helpers.releaseMissingCheckout);
 const funding=(await readFile('supabase/functions/_shared/credit-funding.ts','utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const fundingCode=(await transform(funding,{loader:'ts',format:'esm'})).code;
 Object.assign(helpers,new Function('Deno','checked','HttpError',fundingCode+'\nreturn {fundingLive,fundingEnabled,matchesTopup,recoverTopup,settleTopup,applyCreditPayment};')(Deno,runtime.checked,runtime.HttpError));
 const imports={itemCode:value=>value,...helpers,...runtime},main=(await readFile(file,'utf8')).replace(/^import .*;\n/gm,'');
 const {code}=await transform(main,{loader:'ts',format:'esm'});new Function('Deno',...Object.keys(imports),code)(Deno,...Object.values(imports));Deno.handler.creditHelpers=helpers;return Deno.handler;
}
