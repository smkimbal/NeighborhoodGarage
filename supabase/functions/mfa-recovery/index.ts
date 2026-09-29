import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigins=new Set([
  "https://smkimbal.github.io",
  "http://localhost:5173","http://127.0.0.1:5173",
  "http://localhost:3000","http://127.0.0.1:3000"
]);
function cors(req:Request){
  const origin=req.headers.get("Origin")||"";
  return {
    "Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://smkimbal.github.io",
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Content-Type":"application/json","Vary":"Origin"
  };
}
function envKey(name:string,key="default"){const raw=Deno.env.get(name);if(!raw)throw new Error("Missing "+name);return JSON.parse(raw)[key]}

Deno.serve(async(req)=>{
  const headers=cors(req);
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  try{
    const auth=req.headers.get("Authorization");
    if(!auth?.startsWith("Bearer "))throw new Error("Sign in required.");
    const url=Deno.env.get("SUPABASE_URL")!;
    const userClient=createClient(url,envKey("SUPABASE_PUBLISHABLE_KEYS"),{global:{headers:{Authorization:auth}}});
    const admin=createClient(url,envKey("SUPABASE_SECRET_KEYS"),{auth:{persistSession:false}});
    const {data:{user},error:userError}=await userClient.auth.getUser();
    if(userError||!user)throw new Error("Invalid session.");

    const body=await req.json().catch(()=>({}));
    const action=body.action||"status";
    const {data,error}=await admin.auth.admin.mfa.listFactors({userId:user.id});
    if(error)throw error;
    const pending=(data?.factors||[]).filter((factor:any)=>factor.factor_type==="totp"&&factor.status==="unverified");

    if(action==="status"){
      return new Response(JSON.stringify({
        pending:pending.map((factor:any)=>({
          id:factor.id,
          friendlyName:factor.friendly_name||"Authenticator",
          createdAt:factor.created_at||null
        }))
      }),{headers});
    }

    if(action==="cleanup"){
      const removed:string[]=[];
      for(const factor of pending){
        const del=await admin.auth.admin.mfa.deleteFactor({userId:user.id,id:factor.id});
        if(del.error)throw del.error;
        removed.push(factor.id);
      }
      return new Response(JSON.stringify({removed}),{headers});
    }

    throw new Error("Unknown MFA recovery action.");
  }catch(e){
    return new Response(JSON.stringify({error:e.message||"MFA recovery failed."}),{status:400,headers});
  }
});
