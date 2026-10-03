import {authenticate,checked,endpoint,HttpError} from '../_shared/runtime.ts';
Deno.serve(endpoint(async req=>{
 const {user,admin}=await authenticate(req),body=await req.json();
 if(body.action==='availability'){
  const ids=body.toolIds;if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)))throw new HttpError('Invalid tool list.');
  const processed=checked(await admin.rpc('process_rental_deadlines'));return {processed,availability:checked(await admin.rpc('rental_availability',{p_ids:ids}))};
 }
 if(body.action==='request')return {rental:checked(await admin.rpc('request_rental',{p_user:user.id,p_tool:body.toolId,p_request:body.requestId,p_pickup_start:body.pickupStart,p_pickup_end:body.pickupEnd,p_return_start:body.returnStart,p_return_end:body.returnEnd}))};
 if(body.action==='request-extension')return {extension:checked(await admin.rpc('request_rental_extension',{p_user:user.id,p_rental:body.rentalId,p_request:body.requestId,p_start:body.returnStart,p_end:body.returnEnd}))};
 if(body.action==='resolve-handoff'){
  const tool=checked(await admin.from('tools').select('id,title,tracking_code,archived_at').eq('id',body.toolId).single());if(!tool)throw new HttpError('Tool not found.',404);
  const rentals=checked(await admin.from('rentals').select('*').eq('tool_id',tool.id).or(`owner_id.eq.${user.id},renter_id.eq.${user.id}`).in('status',['accepted','pending_payment','reserved','out','review','disputed','complete']).order('starts_at',{ascending:true}));return {tool,rentals:(rentals||[]).filter((r:any)=>r.status!=='complete'||['out','return_reported','returned'].includes(r.physical_state))};
 }
 throw new HttpError('Unknown booking action.');
}));
