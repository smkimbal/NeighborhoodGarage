import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkNewPassword} from '../src/password-security.js';
const password='fixture unique passphrase 29';
const hash=createHash('sha1').update(password).digest('hex').toUpperCase();
test('password screening sends only a padded hash prefix after submission',async()=>{
 let calls=0;await checkNewPassword(password,{request:async(url,options)=>{calls++;assert.equal(url,'https://api.pwnedpasswords.com/range/'+hash.slice(0,5));assert.equal(options.headers['Add-Padding'],'true');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert(options.signal);assert.equal(options.body,undefined);assert(!JSON.stringify([url,options]).includes(password));return new Response(hash.slice(5)+':0\r\n'+'1'.repeat(35)+':4\r\n');}});assert.equal(calls,1);
});
test('breached passwords are rejected and screening fails closed on errors or malformed responses',async()=>{
 await assert.rejects(()=>checkNewPassword(password,{request:async()=>new Response(hash.slice(5).toLowerCase()+':12\r\n')}),/known data breach/);
 for(const body of ['', '<html>Error</html>',hash.slice(5)+':bad','x'.repeat(200001)])await assert.rejects(()=>checkNewPassword(password,{request:async()=>new Response(body)}),/temporarily unavailable/);
 for(const status of [429,500])await assert.rejects(()=>checkNewPassword(password,{request:async()=>new Response('blocked',{status})}),/temporarily unavailable/);
 await assert.rejects(()=>checkNewPassword(password,{request:async()=>{throw Error('Network failed');}}),/temporarily unavailable/);
});
test('short and oversized passwords never cause a network request',async()=>{
 const request=async()=>{throw Error('Unexpected lookup');};
 await assert.rejects(()=>checkNewPassword('short',{request}),/12 characters/);
 await assert.rejects(()=>checkNewPassword('🔑'.repeat(40),{request}),/128 UTF-8 bytes/);
});
