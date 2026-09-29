import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNeighborhoodGarageServer} from '../backend/server.mjs';
import {openDb} from '../backend/db.mjs';
import {totp} from '../backend/security.mjs';

process.env.NODE_ENV='test';
process.env.NG_STARTING_CREDITS_CENTS='12000';
process.env.NG_ALLOW_SIMULATED_PROVIDERS='true';

async function request(base,path,{method='GET',body,cookie}={}){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-NG-Request':'web',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 let json={};try{json=await r.json();}catch{}
 const set=r.headers.get('set-cookie');return {status:r.status,json,cookie:set?set.split(';')[0]:cookie};
}
async function onboard(base,{email,name}){
 let r=await request(base,'/auth/signup',{method:'POST',body:{channel:'email',identifier:email,password:'correct horse battery staple'}});assert.equal(r.status,201);assert.match(r.json.devCode,/^\d{6}$/);
 r=await request(base,'/auth/verify',{method:'POST',body:{accountId:r.json.accountId,code:r.json.devCode}});assert.equal(r.status,200);let cookie=r.cookie;assert(cookie);
 r=await request(base,'/auth/2fa/setup',{method:'POST',cookie,body:{}});assert.equal(r.status,200);const secret=r.json.secret;
 r=await request(base,'/auth/2fa/enable',{method:'POST',cookie,body:{code:totp(secret)}});assert.equal(r.status,200);
 r=await request(base,'/profile',{method:'PUT',cookie,body:{displayName:name,neighborhood:'Test Block',city:'Chicago',state:'IL',bio:'Testing secure sharing.'}});assert.equal(r.status,200);
 return {cookie,secret};
}

test('live API enforces verified + MFA onboarding and secure rental lifecycle',async t=>{
 const db=openDb(':memory:'),server=createNeighborhoodGarageServer({db});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.close();db.close();});const base=`http://127.0.0.1:${server.address().port}`;
 let anonymous=await request(base,'/state');assert.equal(anonymous.status,401);
 const owner=await onboard(base,{email:'owner@example.com',name:'Taylor Owner'});
 const renter=await onboard(base,{email:'renter@example.com',name:'Riley Renter'});
 let r=await request(base,'/tools',{method:'POST',cookie:owner.cookie,body:{title:'Impact driver kit',category:'Power tools',description:'Driver, two batteries, charger.',condition:'Light cosmetic wear.',rate:10,deposit:50,photo:'data:image/png;base64,iVBORw0KGgo='}});assert.equal(r.status,201);const toolId=r.json.id;
 r=await request(base,'/rentals',{method:'POST',cookie:renter.cookie,body:{toolId,days:1,idempotencyKey:'11111111-1111-4111-8111-111111111111'}});assert.equal(r.status,201);assert.equal(r.json.status,'reserved');assert.equal(r.json.due,0);const rentalId=r.json.id;
 r=await request(base,`/rentals/${rentalId}/pickup`,{method:'POST',cookie:renter.cookie,body:{code:toolId}});assert.equal(r.status,200);assert.equal(r.json.status,'out');
 r=await request(base,`/rentals/${rentalId}/return`,{method:'POST',cookie:renter.cookie,body:{code:toolId,method:'scan',photo:'data:image/png;base64,iVBORw0KGgo='}});assert.equal(r.status,200);assert.equal(r.json.status,'review');
 r=await request(base,'/state',{cookie:owner.cookie});assert.equal(r.status,200);assert(r.json.rentals.some(x=>x.id===rentalId&&x.role==='owner'&&x.status==='review'));
 r=await request(base,`/rentals/${rentalId}/approve`,{method:'POST',cookie:owner.cookie,body:{}});assert.equal(r.status,200);assert.equal(r.json.status,'complete');
 r=await request(base,`/rentals/${rentalId}/reviews`,{method:'POST',cookie:renter.cookie,body:{rating:5,text:'Great neighbor and tool.'}});assert.equal(r.status,201);
 r=await request(base,'/messages',{method:'POST',cookie:renter.cookie,body:{peer:'Taylor Owner',text:'Thanks — return went smoothly.'}});assert.equal(r.status,201);
 const raw=db.prepare('SELECT ciphertext FROM messages ORDER BY created_at DESC LIMIT 1').get().ciphertext;assert(!raw.includes('return went smoothly'));
 r=await request(base,'/state',{cookie:renter.cookie});assert.equal(r.status,200);assert.equal(r.json.credits,110);assert(r.json.messages.some(m=>m.text==='Thanks — return went smoothly.'));
});

test('login requires password then TOTP challenge',async t=>{
 const db=openDb(':memory:'),server=createNeighborhoodGarageServer({db});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.close();db.close();});const base=`http://127.0.0.1:${server.address().port}`;
 const user=await onboard(base,{email:'secure@example.com',name:'Secure User'});
 let r=await request(base,'/auth/login',{method:'POST',body:{identifier:'secure@example.com',password:'wrong password'}});assert.equal(r.status,401);
 r=await request(base,'/auth/login',{method:'POST',body:{identifier:'secure@example.com',password:'correct horse battery staple'}});assert.equal(r.status,200);assert.equal(r.json.mfaRequired,true);
 r=await request(base,'/auth/login/2fa',{method:'POST',body:{challengeId:r.json.challengeId,code:totp(user.secret)}});assert.equal(r.status,200);assert(r.cookie);
 r=await request(base,'/state',{cookie:r.cookie});assert.equal(r.status,200);assert.equal(r.json.profile.displayName,'Secure User');
});
