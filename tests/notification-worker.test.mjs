import {test} from 'node:test';import assert from 'node:assert/strict';import {edgeHandler} from './helpers/edge-handler.mjs';
class HttpError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const checked=r=>{if(r.error)throw r.error;return r.data;};
const endpoint=f=>async req=>{try{return Response.json(await f(req));}catch(error){return Response.json({error:error.message},{status:error.status||400});}};
test('sandbox delivery cannot send email even with copied outbound credentials',async()=>{
 const calls=[],jobs=[{id:1,user_id:'fixture',lease_token:'lease-1'}];
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='claim_notifications'?jobs:true};},auth:{admin:{getUserById:()=>{throw Error('No email lookup is allowed in sandbox capture');}}}};
 const handler=await edgeHandler('supabase/functions/notification-worker/index.ts',{HttpError,checked,endpoint,adminClient:()=>admin,env:k=>({SUPABASE_URL:'https://ilfpugydxlzmmxjfrmrv.supabase.co',NG_NOTIFICATION_DELIVERY_ENABLED:'true',NG_NOTIFICATION_DELIVERY_URL:'https://delivery.fixture.invalid/',NG_NOTIFICATION_DELIVERY_TOKEN:'fixture-token'})[k]});
 const response=await handler(new Request('https://fixture/functions/v1/notification-worker',{method:'POST',headers:{'x-rental-maintenance-token':'fixture-maintenance'}}));
 assert.deepEqual(await response.json(),{sent:0,captured:1,failed:0,sandbox:true,outboundConfigured:false});assert.equal(calls.at(-1).name,'capture_notification');assert.equal(calls.at(-1).args.p_lease,'lease-1');
});
test('unconfigured outbound delivery does not claim jobs and maintenance auth is mandatory',async()=>{
 for(const authorized of [true,false]){
  const calls=[];const handler=await edgeHandler('supabase/functions/notification-worker/index.ts',{HttpError,checked,endpoint,adminClient:()=>({rpc:async name=>{calls.push(name);return {data:authorized};}})});
  const response=await handler(new Request('https://fixture/functions/v1/notification-worker',{method:'POST'}));assert.equal(response.status,authorized?200:401);assert(!calls.includes('claim_notifications'));
 }
});
