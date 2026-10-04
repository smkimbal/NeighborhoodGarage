import {test} from 'node:test';import assert from 'node:assert/strict';
import {invokeFunction,badgesFor,featuredBadge,photoExtension} from '../src/services.js';
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
 const badges=badgesFor({listed:3,borrowed:10,lent:10,rating:4.8,reviewCount:10});assert(badges.filter(b=>['Open garage','Good neighbor','Tool explorer','Project regular','Helpful lender','Full tool shelf','Community lender','Trusted owner','Neighborhood regular','Garage mentor','Neighborhood favorite'].includes(b.name)).every(b=>b.earned));
 assert.equal(badgesFor({rating:5,reviewCount:2}).find(b=>b.name==='Trusted owner').earned,false);
 assert.equal(featuredBadge({listed:1}).name,'Open garage');
 assert.equal(featuredBadge({}),null);
});
test('Photo uploads reject executable formats and oversize content',()=>{
 assert.throws(()=>photoExtension({type:'image/svg+xml',size:30}));assert.throws(()=>photoExtension({type:'image/png',size:8388609}));assert.equal(photoExtension({type:'image/png',size:200}),'png');
});
