import {adminClient,checked,endpoint,HttpError} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const admin=adminClient();if(checked(await admin.rpc('rental_maintenance_authorized',{p_token:req.headers.get('x-rental-maintenance-token')}))!==true)throw new HttpError('Maintenance authentication required.',401);
 checked(await admin.rpc('queue_operation_reminders'));
 const url=Deno.env.get('NG_NOTIFICATION_DELIVERY_URL'),token=Deno.env.get('NG_NOTIFICATION_DELIVERY_TOKEN');
 if(!url||!token)return {inApp:true,outboundConfigured:false};
 const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password)throw new Error('Notification destination must be HTTPS.');
 const jobs=(checked(await admin.rpc('notification_batch')) as any[]);let sent=0;
 for(const job of jobs){
  try{
   const {data,error}=await admin.auth.admin.getUserById(job.user_id);if(error||!data.user?.email)throw new Error('Recipient unavailable.');
   // Only a generic notice leaves the app. Addresses, photos and case details stay private.
   const response=await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':'ng-notification-'+job.id},body:JSON.stringify({id:'ng-notification-'+job.id,to:data.user.email,subject:'Neighborhood Garage update',text:'You have a rental or support update. Sign in at https://neighborhoodgarage.net/#/support to review it.'}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('Delivery service returned '+response.status);
   checked(await admin.rpc('notification_result',{p_id:job.id,p_sent:true}));sent++;
  }catch{checked(await admin.rpc('notification_result',{p_id:job.id,p_sent:false,p_error:'Delivery failed; queued for retry.'}));}
 }
 return {sent,outboundConfigured:true};
}));
