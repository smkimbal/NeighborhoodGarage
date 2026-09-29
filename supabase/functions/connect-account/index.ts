import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const origins=new Set(["https://smkimbal.github.io","http://localhost:5173","http://127.0.0.1:5173"]);
const cors=(req:Request)=>{const o=req.headers.get("Origin")||"";return{"Access-Control-Allow-Origin":origins.has(o)?o:"https://smkimbal.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Vary":"Origin"}};
const envKey=(name:string)=>JSON.parse(Deno.env.get(name)||"{}").default;
async function stripe(path:string,method="GET",body?:URLSearchParams){
  const key=Deno.env.get("STRIPE_SECRET_KEY"); if(!key) throw new Error("Stripe is not configured yet.");
  const r=await fetch("https://api.stripe.com"+path,{method,headers:{Authorization:"Bearer "+key,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body});
  const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||"Stripe request failed."); return j;
}
Deno.serve(async req=>{
 const headers=cors(req); if(req.method==="OPTIONS") return new Response("ok",{headers});
 try{
   const auth=req.headers.get("Authorization"); if(!auth?.startsWith("Bearer ")) throw new Error("Sign in required.");
   const url=Deno.env.get("SUPABASE_URL")!;
   const userClient=createClient(url,envKey("SUPABASE_PUBLISHABLE_KEYS"),{global:{headers:{Authorization:auth}}});
   const admin=createClient(url,envKey("SUPABASE_SECRET_KEYS"),{auth:{persistSession:false}});
   const {data:{user},error:userErr}=await userClient.auth.getUser(); if(userErr||!user) throw new Error("Invalid session.");
   const {data:profile,error:profileErr}=await admin.from("profiles").select("*").eq("id",user.id).single(); if(profileErr||!profile) throw new Error("Profile not found.");
   const body=await req.json().catch(()=>({})); const action=body.action||"onboard";
   let accountId=profile.stripe_account_id;
   if(action==="onboard"){
     if(!accountId){
       const p=new URLSearchParams();
       p.set("country","US");
       if(user.email) p.set("email",user.email);
       p.set("controller[fees][payer]","application");
       p.set("controller[losses][payments]","application");
       p.set("controller[stripe_dashboard][type]","express");
       p.set("controller[requirement_collection]","stripe");
       p.set("capabilities[transfers][requested]","true");
       p.set("metadata[supabase_user_id]",user.id);
       const acct=await stripe("/v1/accounts","POST",p);
       accountId=acct.id;
       await admin.from("profiles").update({stripe_account_id:accountId}).eq("id",user.id);
     }
     const account=await stripe("/v1/accounts/"+encodeURIComponent(accountId));
     const complete=!!account.details_submitted && !!account.payouts_enabled;
     await admin.from("profiles").update({stripe_onboarding_complete:complete}).eq("id",user.id);
     if(complete) return new Response(JSON.stringify({complete:true,accountId}),{headers});
     const p=new URLSearchParams();
     p.set("account",accountId); p.set("type","account_onboarding");
     p.set("refresh_url",body.refreshUrl); p.set("return_url",body.returnUrl);
     const link=await stripe("/v1/account_links","POST",p);
     return new Response(JSON.stringify({complete:false,url:link.url,accountId}),{headers});
   }
   if(action==="status"){
     if(!accountId) return new Response(JSON.stringify({complete:false}),{headers});
     const account=await stripe("/v1/accounts/"+encodeURIComponent(accountId));
     const complete=!!account.details_submitted && !!account.payouts_enabled;
     await admin.from("profiles").update({stripe_onboarding_complete:complete}).eq("id",user.id);
     return new Response(JSON.stringify({complete,accountId}),{headers});
   }
   if(action==="dashboard"){
     if(!accountId) throw new Error("Set up payouts first.");
     const login=await stripe("/v1/accounts/"+encodeURIComponent(accountId)+"/login_links","POST",new URLSearchParams());
     return new Response(JSON.stringify({url:login.url}),{headers});
   }
   throw new Error("Unknown action.");
 }catch(e){return new Response(JSON.stringify({error:e.message||"Connect setup failed."}),{status:400,headers});}
});
