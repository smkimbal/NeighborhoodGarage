import {test} from 'node:test';import assert from 'node:assert/strict';
import {invokeFunction,badgesFor,photoExtension} from '../src/services.js';
test('Edge HTTP errors expose the server diagnosis and correlation ID',async()=>{
 const client={functions:{invoke:async()=>({error:{message:'Edge Function returned a non-2xx status code',context:new Response(JSON.stringify({error:'Stripe key is missing',requestId:'test-reference'}),{status:503})}})}};
 await assert.rejects(invokeFunction(client,'connect-account',{}),/Stripe key is missing.*test-reference/);
});
test('Transport failures remain readable when there is no JSON response',async()=>{
 const client={functions:{invoke:async()=>({error:new Error('Network unavailable')})}};
 await assert.rejects(invokeFunction(client,'connect-account',{}),/Network unavailable/);
});
test('Reputation badges are earned only after meeting actual thresholds',()=>{
 assert(badgesFor({}).every(b=>!b.earned));
 const badges=badgesFor({listed:1,borrowed:10,lent:5,rating:4.6,reviewCount:3});assert(badges.every(b=>b.earned));
 assert.equal(badgesFor({rating:5,reviewCount:2}).find(b=>b.name==='Trusted owner').earned,false);
});
test('Photo uploads reject executable formats and oversize content',()=>{
 assert.throws(()=>photoExtension({type:'image/svg+xml',size:30}));assert.throws(()=>photoExtension({type:'image/png',size:8388609}));assert.equal(photoExtension({type:'image/png',size:200}),'png');
});
