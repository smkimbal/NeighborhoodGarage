import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import Stripe from 'npm:stripe@22.6.0';
import {allowedOrigins} from './origins.ts';
export class HttpError extends Error { constructor(message:string,public status=400,public code='request_failed'){super(message);} }
const projectUrl=Deno.env.get('SUPABASE_URL');
const productionProject=projectUrl==='https://zbbespojxxoheavodtqs.supabase.co';
const origins=allowedOrigins(productionProject?'production':Deno.env.get('NG_DEPLOY_TARGET'));
export function envKey(jsonName:string,legacy:string){
 const direct=Deno.env.get(legacy); if(direct)return direct;
 try {const keys=JSON.parse(Deno.env.get(jsonName)||'{}');const value=keys.default||Object.values(keys)[0];if(typeof value==='string')return value;}catch{/* actionable failure below */}
 throw new HttpError('Backend credentials are not configured. Check '+jsonName+' in Supabase.',503,'backend_configuration');
}
export function adminClient(){return createClient(Deno.env.get('SUPABASE_URL')!,envKey('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});}
export async function authenticate(req:Request,{allowMfaRecovery=false}={}){
 const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))throw new HttpError('Sign in to continue.',401,'authentication_required');
 const client=createClient(Deno.env.get('SUPABASE_URL')!,envKey('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new HttpError('Your session expired. Sign in again.',401,'session_expired');
 if(!user.email_confirmed_at&&!user.phone_confirmed_at)throw new HttpError('Verify your email or phone before continuing.',403,'verification_required');
 const admin=adminClient();
 // getUser validates the signature; claims below are never accepted from an unvalidated token.
 const claims=JSON.parse(atob(auth.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
 const factors=await admin.auth.admin.mfa.listFactors({userId:user.id});if(factors.error)throw factors.error;
 if(!allowMfaRecovery&&factors.data.factors.some(f=>f.status==='verified')&&claims.aal!=='aal2')throw new HttpError('Enter your authenticator code before continuing.',403,'mfa_required');
 return {user,admin,client};
}
export function stripeClient(){
 const key=Deno.env.get('STRIPE_SECRET_KEY');
 if(!key)throw new HttpError('Stripe is not configured. Add STRIPE_SECRET_KEY from the Neighborhood Garage sandbox to Supabase Edge Function secrets.',503,'stripe_not_configured');
 const mode=Deno.env.get('STRIPE_MODE')||'sandbox';
 if(!['sandbox','live'].includes(mode))throw new HttpError('Set STRIPE_MODE to sandbox or live before creating a payment.',503,'stripe_mode_mismatch');
 if((mode==='sandbox'&&!/^(sk|rk)_test_/.test(key))||(mode==='live'&&!/^(sk|rk)_live_/.test(key)))throw new HttpError('Stripe key and STRIPE_MODE do not match. This application currently expects '+mode+' credentials.',503,'stripe_mode_mismatch');
 return new Stripe(key,{apiVersion:'2026-08-26.dahlia',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:15000});
}
export function checkedUrl(raw:string){
 let url:URL;try{url=new URL(raw);}catch{throw new HttpError('Invalid return URL.');}
 if(url.username||url.password||!origins.has(url.origin)||(url.origin==='https://smkimbal.github.io'&&!url.pathname.startsWith('/NeighborhoodGarage/')))throw new HttpError('Invalid return URL.');
 return url.toString();
}
export function checked<T>(result:{data:T,error:unknown}):T {if(result.error)throw result.error;return result.data;}
export function itemCode(raw:unknown){
 const value=String(raw||'').trim();
 if(/^NG[0-9A-F]{8}$/i.test(value))return value.toUpperCase();
 if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))return value.toLowerCase();
 try{const url=new URL(checkedUrl(value)),match=url.hash.match(/^#\/handoff\/([0-9a-f-]{36})$/i);if(match)return match[1].toLowerCase();}catch{}
 throw new HttpError('Scan this item’s Neighborhood Garage QR link or enter its tracking code.');
}
export function endpoint(handler:(req:Request)=>Promise<unknown>){return async(req:Request)=>{
 const origin=req.headers.get('Origin')||'';
 const headers:Record<string,string>={'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 if(origin&&!origins.has(origin))return new Response(JSON.stringify({error:'Origin not permitted.'}),{status:403,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Use POST.'}),{status:405,headers});
 const requestId=crypto.randomUUID();
 try{return new Response(JSON.stringify(await handler(req)),{headers});}
 catch(error){
  const e=error as {message?:string,status?:number,code?:string,type?:string,requestId?:string};
  let message=e.message||'The service could not complete this request.';
  if(e.type==='StripeAuthenticationError')message='Stripe rejected the server API key. Update STRIPE_SECRET_KEY with a valid sandbox key in Supabase.';
  if(e.type==='StripePermissionError')message='The Stripe key lacks Connect or payment permissions. Update its restrictions in the Stripe sandbox.';
  console.error(JSON.stringify({requestId,code:e.code||e.type||'request_failed',message,stripeRequestId:e.requestId}));
  return new Response(JSON.stringify({error:message,code:e.code||e.type||'request_failed',requestId}),{status:e.status&&e.status>=400&&e.status<=599?e.status:400,headers});
 }
};}
