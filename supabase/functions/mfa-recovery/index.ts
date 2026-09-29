import {authenticate,checked,endpoint,HttpError} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 // A verified factor is NEVER removable here; this endpoint only recovers unfinished enrollments.
 const {user,admin}=await authenticate(req,{allowMfaRecovery:true});const {action='status'}=await req.json();
 const result=checked(await admin.auth.admin.mfa.listFactors({userId:user.id}));
 const pending=result!.factors.filter(f=>f.factor_type==='totp'&&f.status==='unverified');
 if(action==='status')return {pending:pending.map(f=>({id:f.id,friendlyName:f.friendly_name||'Authenticator',createdAt:f.created_at}))};
 if(action==='cleanup'){
  const removed=[];
  for(const factor of pending){checked(await admin.auth.admin.mfa.deleteFactor({userId:user.id,id:factor.id}));removed.push(factor.id);}
  return {removed};
 }
 throw new HttpError('Unknown MFA recovery action.');
}));
