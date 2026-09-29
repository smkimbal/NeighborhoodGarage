import {readFile} from 'node:fs/promises';import {createHmac} from 'node:crypto';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
const users=JSON.parse(await readFile(process.env.QA_USERS||'.qa/users.json','utf8'));const u=users.find(x=>x.role==='outsider');
const s=createClient('https://ilfpugydxlzmmxjfrmrv.supabase.co','sb_publishable_fJpL5SCxPiuXgbaxlznTCg_TaScENEx',{auth:{persistSession:false}});
function totp(secret){const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=+$/,''))bits+=abc.indexOf(c).toString(2).padStart(5,'0');const bytes=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',bytes).update(counter).digest(),o=hash.at(-1)&15;return ((hash.readUInt32BE(o)&0x7fffffff)%1000000).toString().padStart(6,'0');}
const check=x=>{assert.equal(x.error,null);return x.data;};
check(await s.auth.signInWithPassword({email:u.email,password:u.password}));
let enrollment;
try{
 const factors=check(await s.auth.mfa.listFactors());for(const f of factors.totp||[])if(f.status==='unverified')check(await s.auth.mfa.unenroll({factorId:f.id}));
 enrollment=check(await s.auth.mfa.enroll({factorType:'totp',friendlyName:'QA authenticator'}));
 let challenge=check(await s.auth.mfa.challenge({factorId:enrollment.id}));check(await s.auth.mfa.verify({factorId:enrollment.id,challengeId:challenge.id,code:totp(enrollment.totp.secret)}));
 check(await s.auth.signOut());check(await s.auth.signInWithPassword({email:u.email,password:u.password}));
 const denied=check(await s.from('profiles').select('id'));assert.equal(denied.length,0);
 const edge=await s.functions.invoke('connect-account',{body:{action:'status'}});assert(edge.error);const body=await edge.error.context.json();assert.equal(body.code,'mfa_required');
 const financial=await s.rpc('change_rental',{p_user:u.id,p_rental:crypto.randomUUID(),p_action:'approve'});assert(financial.error);
 console.log('PASS enrolled MFA enforced at AAL1 by database RLS and Edge Functions; finance RPC remains private');
 // A distinct challenge can use the current TOTP; if the provider rejects replay wait for the next step.
 let v;for(let attempt=0;attempt<2;attempt++){challenge=check(await s.auth.mfa.challenge({factorId:enrollment.id}));v=await s.auth.mfa.verify({factorId:enrollment.id,challengeId:challenge.id,code:totp(enrollment.totp.secret)});if(!v.error)break;await new Promise(r=>setTimeout(r,31000-Date.now()%30000));}check(v);
 const allowed=check(await s.from('profiles').select('id').eq('id',u.id));assert.equal(allowed.length,1);
 check(await s.auth.mfa.unenroll({factorId:enrollment.id}));console.log('PASS verified MFA challenge restores access and factor cleanup succeeds');
}finally{await s.auth.signOut();}
