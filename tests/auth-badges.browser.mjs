// Opt-in browser journey with fake transport. No real accounts or emails are created.
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;const path=resolve('dist','.'+(name==='/'?'/index.html':name));const data=await readFile(path);res.setHeader('content-type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html'})[extname(path)]||'text/plain');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(5173,'127.0.0.1',r));
const launch={headless:true};if(process.env.CHROMIUM_PATH){launch.executablePath=process.env.CHROMIUM_PATH;const imported=createRequire(process.env.CHROMIUM_HELPER)('@sparticuz/chromium');launch.args=(imported.default||imported).args.filter(a=>a!=='--single-process');}
const browser=await chromium.launch(launch),errors=[];
const me='00000000-0000-4000-8000-000000000001',owner='00000000-0000-4000-8000-000000000002',tool='00000000-0000-4000-8000-000000000003';
const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:me,role:'authenticated',aal:'aal1',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.'+Buffer.from('signature').toString('base64url');
const identity={id:me,email:'tester@example.net',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'Test Neighbor'},aud:'authenticated',created_at:new Date().toISOString(),email_confirmed_at:new Date().toISOString()};
const profile={id:me,display_name:'Test Neighbor',neighborhood:'Oak Grove',city:'Chicago',state:'IL',bio:'',stripe_onboarding_complete:false};
const listings=[{id:'00000000-0000-4000-8000-000000000004',owner_id:me,title:'My ladder',category:'Home & DIY',description:'A ladder',condition:'Good',rate_cents:800,deposit_cents:2000,available:true,owner:{display_name:'Test Neighbor',neighborhood:'Oak Grove',city:'Chicago',stripe_onboarding_complete:false}},{id:tool,owner_id:owner,title:'Cordless drill',category:'Power tools',description:'A drill',condition:'Good',rate_cents:1200,deposit_cents:5000,available:true,owner:{display_name:'Helpful Owner',neighborhood:'Oak Grove',city:'Chicago',stripe_onboarding_complete:false}}];
try{
 const page=await browser.newPage({viewport:{width:375,height:812}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://ilfpugydxlzmmxjfrmrv.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),p=url.pathname,method=route.request().method();let data={};
  if(p.endsWith('/auth/v1/signup'))data={user:identity,session:null};
  else if(p.endsWith('/auth/v1/token'))data={access_token:jwt,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:identity};
  else if(p.endsWith('/auth/v1/user'))data=identity;
  else if(p.endsWith('/auth/v1/factors'))data={totp:[],phone:[]};
  else if(p.endsWith('/rest/v1/profiles'))data=profile;
  else if(p.endsWith('/rest/v1/tools')){if(method==='PATCH'){const id=url.searchParams.get('id')?.replace('eq.','');const item=listings.find(t=>t.id===id);Object.assign(item,route.request().postDataJSON());data={id:item.id};}else data=listings;}
  else if(p.endsWith('/rest/v1/rentals')||p.endsWith('/rest/v1/messages')||p.endsWith('/rest/v1/reviews')||p.endsWith('/rest/v1/credit_ledger'))data=[];
  else if(p.endsWith('/rest/v1/rpc/reputation_summary'))data=[{user_id:me,listed:1,borrowed:3,lent:1,review_count:0,rating:0},{user_id:owner,listed:3,borrowed:0,lent:10,review_count:10,rating:4.9}];
  else if(p.includes('/storage/v1/'))data=[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:5173/');
 await page.locator('[data-auth-tab=signup]').click();await page.locator('#signup [name=displayName]').fill('Test Neighbor');await page.locator('#signup [name=email]').fill('tester@example.net');await page.locator('#signup [name=password]').fill('sample-password-123');await page.locator('#signup button.primary').click();await page.locator('#auth-notice:not(.hidden)').waitFor();assert.match(await page.locator('#auth-notice').textContent(),/confirmation link/);console.log('PASS pending email confirmation is explicit');
 await page.locator('#signin [name=password]').fill('sample-password-123');await page.locator('#signin button.primary').click();await page.locator('.topbar').waitFor({timeout:10000}).catch(async e=>{console.log('DEBUG',await page.locator('#toast').textContent(),(await page.locator('main').innerText()).slice(0,500));throw e});console.log('PASS sign-in renders without a reload');
 await page.getByRole('button',{name:'Profile',exact:true}).click();await page.locator('#account-tab').waitFor();await page.locator('#badges-tab').click();await page.locator('#profile-badges:not(.hidden)').waitFor();assert(await page.locator('.earned-badge.earned').count()>=1);console.log('PASS badge tab and milestone progress');
 await page.getByRole('link',{name:'See what neighbors see'}).click();await page.getByRole('heading',{name:'Earned badges'}).waitFor();console.log('PASS neighbor-facing badges');
 await page.getByRole('link',{name:'Explore',exact:true}).click();await page.getByRole('heading',{name:'Big plans. Neighborly prices.'}).waitFor();await page.locator('.tool-card .badge-tag').waitFor();assert.match(await page.locator('.tool-card .badge-tag').textContent(),/Neighborhood favorite/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);console.log('PASS earned badge on mobile tool card');
 await page.getByRole('link',{name:'My garage',exact:true}).click();await page.locator('[data-edit]').click();await page.locator('#lend-form [name=title]').fill('Updated ladder');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.locator('.tool-card h3',{hasText:'Updated ladder'}).waitFor();assert.equal(listings[0].title,'Updated ladder');console.log('PASS owner edits without uploading another photo');
 await page.locator('[data-remove]').click();await page.locator('#confirm-remove').click();await page.getByRole('heading',{name:'Your garage is empty'}).waitFor();assert.equal(listings[0].available,false);assert(listings[0].archived_at);console.log('PASS removal hides current listing and pauses availability');
 await page.getByRole('link',{name:'View removed listings'}).click();await page.locator('[data-restore]').click();await page.getByRole('heading',{name:'No removed listings'}).waitFor();assert.equal(listings[0].archived_at,null);assert.equal(listings[0].available,false);console.log('PASS restore remains paused');
 assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors');
}finally{await browser.close();server.close()}
