// Real database/RLS/Edge support handler; Auth and delivery use isolated fixtures.
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {browserBackend} from './helpers/browser-backend.mjs';
const backend=await browserBackend(),output=process.env.NG_TEST_DIST||'dist-production',errors=[];
const headers=Object.fromEntries((await readFile(output+'/_headers','utf8')).split('\n').slice(1).filter(l=>/^  [A-Za-z-]+:/.test(l)).map(l=>{const at=l.indexOf(':');return [l.slice(0,at).trim(),l.slice(at+1).trim()];}));
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,path=resolve(output,'.'+(p==='/'?'/index.html':p)),data=await readFile(path);for(const[k,v]of Object.entries(headers))res.setHeader(k,v);res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(5175,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--disable-gpu']}:{})});
try{
 const operator=await backend.addUser('operator@fixture.invalid','Fixture Operator'),other=await backend.addUser('other@fixture.invalid','Other Neighbor');
 await backend.sql("update profiles set neighborhood='Fixture',city='Denver',state='CO' where id in($1,$2)",[operator.id,other.id]);
 await backend.sql("select set_operator_access($1,true,'Confirmed sandbox fixture identity.',gen_random_uuid(),'Fixture administrator')",[operator.id]);
 await backend.sql("insert into notifications(user_id,message) select $1,'Own notice '||n from generate_series(1,60)n",[operator.id]);
 const foreign=(await backend.sql("insert into notifications(user_id,message) values($1,'Private other notification') returning id",[other.id]))[0].id;
 await backend.sql("insert into support_cases(reporter_id,kind,description) values($1,'safety','Operator-only support case fixture.')",[other.id]);
 const page=await browser.newPage({viewport:{width:375,height:812}});page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket(/^wss:\/\/(ilfpugydxlzmmxjfrmrv|zbbespojxxoheavodtqs)\.supabase\.co\//,s=>s.close());
 await page.route(/^https:\/\/(ilfpugydxlzmmxjfrmrv|zbbespojxxoheavodtqs)\.supabase\.co\//,backend.intercept);
 await page.goto('http://127.0.0.1:5175/#/support');
 const signIn=async()=>{await page.locator('#signin [name=email]').fill(operator.email);await page.locator('#signin [name=password]').fill('fixture password');await page.locator('#signin button.primary').click();await page.locator('.topbar').waitFor();};
 await signIn();await page.getByRole('heading',{name:'Finish operator setup'}).waitFor();assert.equal(await page.locator('#notice-badge').textContent(),'60');assert.equal(await page.locator('#notices .notice').count(),50);assert.equal(await page.getByText('Operator-only support case fixture.',{exact:true}).count(),0);assert.equal(await page.getByText('Private other notification',{exact:true}).count(),0);assert.equal(await page.locator('.operator-setup a').getAttribute('href'),'#/profile?security=mfa');
 await page.getByRole('button',{name:'Load older notifications'}).click();await page.waitForFunction(()=>document.querySelectorAll('#notices .notice').length===60);
 await page.getByRole('button',{name:'Mark displayed notifications read'}).click();await page.waitForFunction(()=>document.querySelector('#notice-badge').hidden);assert.equal(await page.locator('#notices .unread').count(),0);
 await page.evaluate(async id=>{const key=Object.keys(localStorage).find(k=>k.endsWith('-auth-token')),session=JSON.parse(localStorage.getItem(key));await fetch(window.NG_CONFIG.supabaseUrl+'/functions/v1/support',{method:'POST',headers:{apikey:window.NG_CONFIG.supabaseKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'read-notifications',notificationIds:[String(id)]})});},foreign);
 assert.equal((await backend.sql('select read_at from notifications where id=$1',[foreign]))[0].read_at,null);
 console.log('PASS own unread count, notification pagination, read controls and cross-account isolation');
 // Auth fixture supplies an AAL2 session; this is not a real-device enrollment.
 operator.aal='aal2';await page.goto('http://127.0.0.1:5175/#/profile');await page.locator('#signout').click();await page.locator('#signin').waitFor();await page.goto('http://127.0.0.1:5175/#/support');await signIn();await page.getByRole('heading',{name:'Operator queue',exact:true}).waitFor();await page.getByText('Operator-only support case fixture.',{exact:true}).waitFor();
 const job=(await backend.sql('select * from claim_notifications()'))[0];await backend.sql('select capture_notification($1,$2)',[job.id,job.lease_token]);
 await page.reload();await page.getByRole('heading',{name:'Notification delivery',exact:true}).waitFor();await page.getByText(/1 sandbox previews/).waitFor();assert.equal(await page.locator('.operator-setup').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS operator eligibility at AAL1, private queue at AAL2 and generic sandbox delivery previews');
 await backend.sql("insert into private.account_restrictions(user_id,reason) values($1,'Fixture access restriction')",[operator.id]);await page.reload();await page.getByRole('heading',{name:'Your cases',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Operator queue',exact:true}).count(),0);assert.equal(await page.getByText('Operator-only support case fixture.',{exact:true}).count(),0);
 await page.locator('#support-report [name=description]').fill('Please review my account restriction and explain the next step.');await page.locator('#support-report button.primary').click();await page.getByText('Please review my account restriction and explain the next step.',{exact:true}).waitFor();assert.equal(await page.locator('#support-signout').count(),1);
 console.log('PASS a restricted account can appeal through its own Support queue and cannot retain operator access');
}finally{await browser.close();server.close();await backend.db.close();}
