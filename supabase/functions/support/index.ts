import {authenticate,checked,endpoint,HttpError} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin,claims,hasVerifiedMfa}=await authenticate(req),b=await req.json();
 const operatorEligible=checked(await admin.rpc('operator_allowed',{p_user:user.id}))===true;
 const operator=claims.aal==='aal2'&&hasVerifiedMfa&&operatorEligible;
 const noticeId=(id:unknown)=>{if(typeof id!=='string'||!/^\d{1,19}$/.test(id)||BigInt(id)<1n||BigInt(id)>9223372036854775807n)throw new HttpError('Invalid notification reference.');return id;};
 const notices=async(before?:unknown)=>{let q=admin.from('notifications').select('*').eq('user_id',user.id).order('id',{ascending:false}).limit(50);if(before!==undefined)q=q.lt('id',noticeId(before));return checked(await q);};
 if(b.action==='notifications')return {notifications:await notices(b.beforeNotificationId)};
 if(b.action==='read-notifications'){
  if(!Array.isArray(b.notificationIds)||!b.notificationIds.length||b.notificationIds.length>50)throw new HttpError('Choose 1–50 notifications.');
  const ids=b.notificationIds.map(noticeId);
  checked(await admin.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).in('id',ids).is('read_at',null));
  return {read:true};
 }
 if(b.action==='retry-notification'){
  if(!operator)throw new HttpError('Operator access with verified MFA required.',403);
  return {retried:checked(await admin.rpc('retry_notification',{p_actor:user.id,p_id:noticeId(b.notificationId),p_note:b.note,p_request:b.requestId}))};
 }
 if(b.action==='list'){
  let query=admin.from('support_cases').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
  if(!operator)query=query.or(`reporter_id.eq.${user.id},subject_id.eq.${user.id}`);
  if(b.before){if(!/^[0-9a-f-]{36}$/i.test(b.before.id)||!Number.isFinite(Date.parse(b.before.created_at)))throw new HttpError('Invalid page cursor.');const stamp=new Date(b.before.created_at).toISOString();query=query.or(`created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.${b.before.id})`);}
  return {operator,operatorEligible,cases:checked(await query),notifications:await notices(),deliveryStatus:operator?checked(await admin.rpc('notification_delivery_status')):null};
 }
 if(b.action==='details'){
  if(!operator)throw new HttpError('Operator access with verified MFA required.',403);
  const c=checked<any>(await admin.from('support_cases').select('*').eq('id',b.caseId).single());
  const audit=checked(await admin.rpc('case_operation_history',{p_case:c.id}));
  if(!c.rental_id)return {rental:null,photos:[],audit};
  const rental=checked<any>(await admin.from('rentals').select('id,status,physical_state,physical_returned_at,returned_at,review_note,damage_note,damage_claim_cents,deposit_cents,deposit_refunded_cents,rental_cents,rental_refunded_cents,owner_payout_cents,return_photo_path,baseline_photo_path,damage_photos').eq('id',c.rental_id).single());
  const photos=[];for(const [bucket,path] of [['tool-photos',rental.baseline_photo_path],['return-photos',rental.return_photo_path],...(rental.damage_photos||[]).map((p:string)=>['return-photos',p])]){if(path){const signed=checked<any>(await admin.storage.from(bucket).createSignedUrl(path,300));photos.push(signed.signedUrl);}}
  const receipts=checked(await admin.from('payment_receipts').select('charge_id,principal_cents,processing_fee_cents,actual_fee_cents,refunded_cents,disputed_cents,reversed_cents,dispute_active,available_at').eq('rental_id',c.rental_id).order('created_at',{ascending:false}).limit(50));
  return {rental,photos,audit,receipts};
 }
 if(b.action==='report'){
  if(!['payment','not_received','damage','safety','abuse','withdrawal','deletion'].includes(b.kind)||typeof b.description!=='string'||b.description.trim().length<10||b.description.length>3000)throw new HttpError('Choose a reason and describe the issue in 10–3000 characters.');
  let subject:string|null=null;
  if(b.rentalId){const r=checked<any>(await admin.from('rentals').select('owner_id,renter_id').eq('id',b.rentalId).single());if(![r.owner_id,r.renter_id].includes(user.id))throw new HttpError('Rental unavailable.',404);subject=r.owner_id===user.id?r.renter_id:r.owner_id;}
  else if(b.subjectId){subject=checked<any>(await admin.from('profiles').select('id').eq('id',b.subjectId).single()).id;}
  if(!/^[0-9a-f-]{36}$/i.test(b.requestId||''))throw new HttpError('A request ID is required.');
  const row=checked(await admin.from('support_cases').upsert({dedupe_key:'report:'+user.id+':'+b.requestId,rental_id:b.rentalId||null,reporter_id:user.id,subject_id:subject,kind:b.kind,description:b.description.trim()},{onConflict:'dedupe_key',ignoreDuplicates:true}).select('*').maybeSingle());return {case:row||checked(await admin.from('support_cases').select('*').eq('dedupe_key','report:'+user.id+':'+b.requestId).single())};
 }
 if(b.action==='operate'){
  if(!operator)throw new HttpError('Operator access with verified MFA required.',403);
  const amount=b.amountCents===undefined?0:b.amountCents;
  if(!Number.isSafeInteger(amount)||amount<0||amount>2147483647)throw new HttpError('Enter a valid, non-negative amount in whole cents.');
  return {case:checked(await admin.rpc('operate_case',{p_actor:user.id,p_case:b.caseId,p_action:b.operation,p_note:b.note,p_amount:amount,p_request:b.requestId}))};
 }
 throw new HttpError('Unknown support action.');
}));
