import {adminClient,checked,endpoint,HttpError} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const admin=adminClient();if(checked(await admin.rpc('rental_maintenance_authorized',{p_token:req.headers.get('x-rental-maintenance-token')}))!==true)throw new HttpError('Maintenance authentication required.',401);
 checked(await admin.rpc('queue_operation_reminders'));
 const sandbox=Deno.env.get('SUPABASE_URL')==='https://ilfpugydxlzmmxjfrmrv.supabase.co';
 const url=Deno.env.get('NG_NOTIFICATION_DELIVERY_URL'),token=Deno.env.get('NG_NOTIFICATION_DELIVERY_TOKEN');
 // Sandbox capture is unconditional, including when production secrets are copied by mistake.
 if(!sandbox&&Deno.env.get('NG_NOTIFICATION_DELIVERY_ENABLED')!=='true')return {inApp:true,outboundConfigured:false};
 if(!sandbox&&(!url||!token))throw new HttpError('Notification delivery credentials are missing.',503);
 if(!sandbox){const target=new URL(url!);if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash)throw new Error('Notification destination must be HTTPS without URL credentials.');}
 const jobs=checked(await admin.rpc('claim_notifications')) as {id:number,user_id:string,lease_token:string}[];let sent=0,captured=0,failed=0;
 for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(async job=>{
  try{
   if(sandbox){if(checked(await admin.rpc('capture_notification',{p_id:job.id,p_lease:job.lease_token})))captured++;return;}
   const {data,error}=await admin.auth.admin.getUserById(job.user_id);if(error||!data.user?.email||!data.user.email_confirmed_at)throw new Error('Verified recipient unavailable.');
   // Addresses, photos, case details and the in-app message never leave the app.
   const response=await fetch(url!,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':'ng-notification-'+job.id},body:JSON.stringify({id:'ng-notification-'+job.id,to:data.user.email,subject:'Neighborhood Garage update',text:'You have a rental or support update. Sign in at https://neighborhoodgarage.net/#/support to review it.'}),redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error('Delivery service returned '+response.status);
   if(checked(await admin.rpc('finish_notification',{p_id:job.id,p_lease:job.lease_token,p_sent:true,p_kind:'email'})))sent++;
  }catch{
   failed++;
   checked(await admin.rpc('finish_notification',{p_id:job.id,p_lease:job.lease_token,p_sent:false,p_error:'Delivery failed; retry with backoff.'}));
  }
 }));
 return {sent,captured,failed,sandbox,outboundConfigured:!sandbox};
}));
