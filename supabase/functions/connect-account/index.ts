import {authenticate,checked,checkedUrl,endpoint,HttpError,stripeClient} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req);
 const body=await req.json(),action=body.action||'onboard';
 if(!['onboard','status','dashboard'].includes(action))throw new HttpError('Unknown Connect action.');
 const stripe=stripeClient();
 const profile=checked(await admin.from('profiles').select('*').eq('id',user.id).single());
 let accountId=profile.stripe_account_id;
 if(action==='onboard'&&!accountId){
  // Validate redirects before creating any external account.
  checkedUrl(body.returnUrl);checkedUrl(body.refreshUrl);
  const account=await stripe.v2.core.accounts.create({
   contact_email:user.email,display_name:profile.display_name||'Neighborhood Garage owner',
   dashboard:'express',identity:{country:'us'},
   defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},
   configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},
   metadata:{supabase_user_id:user.id},include:['configuration.recipient']
  },{idempotencyKey:`ng-connect-${user.id}`});
  accountId=account.id;
  checked(await admin.from('profiles').update({stripe_account_id:accountId}).eq('id',user.id));
 }
 if(!accountId)return {complete:false,mode:Deno.env.get('STRIPE_MODE')||'sandbox'};
 if(action==='dashboard')return {url:(await stripe.accounts.createLoginLink(accountId)).url};
 const account=await stripe.v2.core.accounts.retrieve(accountId,{include:['configuration.recipient','requirements']});
 const capabilities=account.configuration?.recipient?.capabilities?.stripe_balance;
 const complete=capabilities?.stripe_transfers?.status==='active'&&capabilities?.payouts?.status==='active';
 checked(await admin.from('profiles').update({stripe_onboarding_complete:complete}).eq('id',user.id));
 if(action==='status'||complete)return {complete,mode:Deno.env.get('STRIPE_MODE')||'sandbox'};
 const link=await stripe.v2.core.accountLinks.create({account:accountId,use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],refresh_url:checkedUrl(body.refreshUrl),return_url:checkedUrl(body.returnUrl)}}});
 return {complete:false,url:link.url,mode:Deno.env.get('STRIPE_MODE')||'sandbox'};
}));
