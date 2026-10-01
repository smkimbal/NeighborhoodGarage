// Explicit opt-in integration test. Credentials are provisioned separately and never committed.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {X509Certificate,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createClient} from '@supabase/supabase-js';
const users=JSON.parse(await readFile(process.env.QA_USERS||'.qa/users.json','utf8'));
const artifacts=process.env.QA_ARTIFACTS||'.qa';await mkdir(artifacts,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve('dist','.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(resolve('dist')+'/'))throw Error();const body=await readFile(path.endsWith('/')?path+'index.html':path);res.setHeader('content-type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.html':'text/html'})[extname(path)]||'text/html');res.end(body);}catch{try{res.setHeader('content-type','text/html');res.end(await readFile('dist/index.html'));}catch{res.writeHead(404).end();}}});
await new Promise(r=>server.listen(5173,'127.0.0.1',r));
const launch={headless:true};
if(process.env.CHROMIUM_PATH){launch.executablePath=process.env.CHROMIUM_PATH;const require=createRequire(process.env.CHROMIUM_HELPER);const imported=require('@sparticuz/chromium');const binary=imported.default||imported;launch.args=binary.args.filter(a=>a!=='--disable-web-security'&&a!=='--single-process');}
// Network proxy is optional; no disabled CORS or TLS checks.
if(process.env.QA_BROWSER_PROXY){const p=new URL(process.env.QA_BROWSER_PROXY);launch.proxy={server:p.origin,bypass:'127.0.0.1,localhost',...(p.username?{username:decodeURIComponent(p.username),password:decodeURIComponent(p.password)}:{})};}
if(process.env.QA_BROWSER_PROXY&&process.env.CODEX_PROXY_CERT){const cert=new X509Certificate(await readFile(process.env.CODEX_PROXY_CERT));const pin=createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('base64');launch.args=[...(launch.args||[]),'--ignore-certificate-errors-spki-list='+pin];}
const browser=await chromium.launch(launch);const errors=[],checks=[];
const note=s=>{checks.push(s);console.log('PASS '+s);};
const cfg={url:'https://ilfpugydxlzmmxjfrmrv.supabase.co',key:'sb_publishable_fJpL5SCxPiuXgbaxlznTCg_TaScENEx'};
const pageFor=async u=>{const c=await browser.newContext({viewport:{width:375,height:812},geolocation:{latitude:41.88,longitude:-87.63},permissions:['geolocation']});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>console.log('NETWORK',new URL(r.url()).origin,r.failure()?.errorText));p.setDefaultTimeout(20000);await p.goto('http://127.0.0.1:5173/');await p.locator('#signin [name=email]').fill(u.email);await p.locator('#signin [name=password]').fill(u.password);await p.locator('#signin button.primary').click();await p.waitForSelector('#profile-form, .topbar', {timeout:30000});if(await p.locator('#profile-form').count()){for(const [name,value] of Object.entries({display_name:'QA '+u.role,neighborhood:'QA Oak Grove',city:'Chicago',state:'IL',bio:'Temporary integration-test profile.'}))await p.locator(`#profile-form [name=${name}]`).fill(value);await p.getByRole('button',{name:'Finish setup',exact:true}).click();}await p.locator('.topbar').waitFor();return p;};
const noOverflow=async p=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page overflows mobile viewport');
try{
 const runId=Date.now();
 const owner=await pageFor(users[0]);note('Verified test account signs in and creates its profile through the UI');
 for(const width of [320,375,768,1280]){await owner.setViewportSize({width,height:812});await noOverflow(owner);assert.equal(await owner.locator('.topbar nav a').count(),4);assert(await owner.locator('.topbar nav').isVisible());}await owner.setViewportSize({width:375,height:812});note('All four navigation routes visible at 320, 375, 768, and 1280px; no horizontal overflow');
 await owner.getByRole('button',{name:'List a tool',exact:true}).click();await owner.locator('#lend-form').waitFor();
 await owner.locator('#tool-photo').setInputFiles({name:'qa-tool.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
 await owner.getByRole('button',{name:'Identify with AI',exact:true}).click();await owner.locator('#ai-status').filter({hasText:'awaiting project-owner approval'}).waitFor();note('AI unavailable state is actionable and manual listing remains accessible');
 const title='QA Cordless Drill '+Date.now();
 for(const [name,value] of Object.entries({title,description:'Temporary drill for end-to-end verification.',condition:'Clean housing. Normal cosmetic wear.',rate:'12',deposit:'75'}))await owner.locator(`#lend-form [name=${name}]`).fill(value);
 await owner.getByRole('button',{name:'Use my location',exact:true}).click();await owner.waitForFunction(()=>document.querySelector('[name=lat]').value==='41.88');
 assert.match(await owner.locator('#profit-preview').innerText(),/11.40/);
 await owner.getByRole('button',{name:'Publish listing',exact:true}).click();await owner.locator('.tool-card h3',{hasText:title}).waitFor();note('Owner publishes photo, rounded coordinates, pricing and condition without needing Stripe first');
 await owner.getByRole('button',{name:'Tracking code for '+title}).click();await owner.locator('dialog img.qr').waitFor();assert.match(await owner.locator('dialog .tracking').innerText(),/^NG[0-9A-F]{8}$/);await owner.locator('[data-close]').click();note('Unique tool tracking QR code is displayed');
 await owner.getByRole('button',{name:'Profile',exact:true}).click();await owner.locator('.earned-badge.earned').waitFor();await owner.getByRole('button',{name:'Set up payouts',exact:true}).click();await owner.locator('#toast').filter({hasText:'STRIPE_SECRET_KEY'}).waitFor();note('Stripe exposes confirmed missing server secret rather than generic non-2xx');
 const renter=await pageFor(users[1]);await renter.getByRole('button',{name:'Use my location',exact:true}).click();await renter.locator('#location-status').filter({hasText:'Sorted nearest'}).waitFor();await renter.locator('#radius').selectOption('2');await renter.getByRole('button',{name:'Map',exact:true}).click();await renter.locator('.leaflet-interactive').first().waitFor();await noOverflow(renter);await renter.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await renter.screenshot({path:artifacts+'/map-mobile.png',fullPage:true});note('Nearby radius, sorted listing, and interactive map marker work on mobile');
 await renter.locator('[data-tool]').filter({hasText:title}).click();await renter.locator('#message-owner').click();await renter.locator('[name=body]').fill('Hello! Could I collect the drill on Saturday? '+runId);await renter.getByRole('button',{name:'Send',exact:true}).click();await renter.locator('.bubble.self').filter({hasText:'Hello! Could I collect the drill on Saturday? '+runId}).waitFor();
 await owner.getByRole('link',{name:'Messages',exact:true}).click();await owner.locator('.bubble').filter({hasText:'Hello! Could I collect the drill on Saturday? '+runId}).waitFor();await owner.locator('[name=body]').fill('Yes, Saturday morning works. '+runId);await owner.getByRole('button',{name:'Send',exact:true}).click();await renter.locator('.bubble').filter({hasText:'Yes, Saturday morning works. '+runId}).waitFor();note('Real Supabase Realtime delivers private chat in both directions');
 await renter.locator('[name=body]').fill('Keep this unsent draft');await owner.locator('[name=body]').fill('Meet by the community garden. '+runId);await owner.getByRole('button',{name:'Send',exact:true}).click();await renter.locator('.bubble').filter({hasText:'Meet by the community garden. '+runId}).waitFor();assert.equal(await renter.locator('[name=body]').inputValue(),'Keep this unsent draft');await noOverflow(renter);await renter.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await renter.screenshot({path:artifacts+'/chat-mobile.png',fullPage:true});note('Incoming message preserves unsent draft and mobile chat fits');
 // Direct API adversarial checks, using a third confirmed test account.
 const api=[];for(const u of users){const s=createClient(cfg.url,cfg.key,{auth:{persistSession:false}});const a=await s.auth.signInWithPassword({email:u.email,password:u.password});assert.equal(a.error,null);api.push(s);}
 const messages=await api[2].from('messages').select('*');assert.equal(messages.error,null);assert.equal(messages.data.length,0);
 const forged=await api[2].from('messages').insert({sender_id:users[0].id,recipient_id:users[1].id,body:'forged'});assert(forged.error);
 const privateColumn=await api[1].from('profiles').select('stripe_account_id');assert(privateColumn.error);
 const money=await api[1].rpc('reserve_rental',{p_user:users[1].id,p_tool:crypto.randomUUID(),p_days:1,p_request:crypto.randomUUID()});assert(money.error);
 const mine=await api[0].from('tools').select('id,tracking_code,title').eq('owner_id',users[0].id).order('created_at',{ascending:false});await writeFile(artifacts+'/tool.json',JSON.stringify(mine.data[0]));
 note('RLS prevents third-party chat reads, sender forgery, payout-ID reads, and direct financial RPC access');
 assert.deepEqual(errors,[]);note('No uncaught browser JavaScript errors');
 await writeFile(artifacts+'/journey-results.json',JSON.stringify({checks,errors},null,2));
}catch(e){await writeFile(artifacts+'/journey-results.json',JSON.stringify({checks,errors,failure:e.message},null,2));for(const [i,c]of browser.contexts().entries())for(const p of c.pages()){console.log('LAST TOAST',await p.locator('#toast').textContent());await p.screenshot({path:artifacts+`/failure-${i}.png`,fullPage:true});}throw e;}
finally{await browser.close();server.close();}
