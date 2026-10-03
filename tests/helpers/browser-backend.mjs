// Fake provider transport; the real PostgreSQL migrations, RLS and Edge handlers
// decide every booking transition and credit movement in the browser journey.
import {database} from './local-database.mjs';
import {edgeHandler} from './edge-handler.mjs';
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const ident=s=>{if(!/^[a-z_]+$/.test(s))throw Error('Unexpected SQL identifier');return '"'+s+'"';};
const profileFields='id,display_name,neighborhood,city,state,bio,avatar_path,created_at,updated_at,stripe_onboarding_complete';
export async function browserBackend(){
 const db=await database(),users=new Map(),sessions=new Map(),requests=[];let stripeCalls=0,queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const sql=(text,params=[],user=null)=>serial(async()=>{
  await db.exec('begin');try{await db.exec('set local role '+(user?'authenticated':'service_role'));
   if(user)await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[user.id,JSON.stringify({sub:user.id,role:'authenticated',aal:'aal1'})]);
   const result=await db.query(text,params);await db.exec('commit');return result.rows;
  }catch(error){await db.exec('rollback');throw error;}
 });
 async function addUser(email,name){const user={id:crypto.randomUUID(),email,aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:name},created_at:new Date().toISOString(),email_confirmed_at:new Date().toISOString()};
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)',[user.id,email,JSON.stringify(user.user_metadata)]);users.set(email,user);return user;
 }
 const getUser=req=>{try{return [...users.values()].find(u=>u.id===JSON.parse(Buffer.from(req.headers.get('authorization').split('.')[1],'base64url')).sub);}catch{return null;}};
 const jwt=u=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:u.id,role:'authenticated',aal:'aal1',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
 const rpc=async(name,args={},user=null)=>{try{
  const keys=Object.keys(args),rows=await sql('select * from public.'+ident(name)+'('+keys.map((k,i)=>ident(k)+' => $'+(i+1)).join(',')+')',keys.map(k=>typeof args[k]==='object'&&args[k]!==null&&!Array.isArray(args[k])?JSON.stringify(args[k]):args[k]),user);
  return {data:['reputation_summary','rental_availability'].includes(name)?rows:name==='process_rental_deadlines'?rows[0]?.process_rental_deadlines:rows[0]||null};
 }catch(error){return {error};}};
 function from(table,user=null){let method='select',values,columns='*',single=false,order='',clauses=[],params=[];
  const param=v=>{params.push(v);return '$'+params.length;};
  const chain={select(c='*'){columns=c;return this;},eq(k,v){clauses.push(ident(k)+'='+param(v));return this;},is(k,v){if(v!==null)throw Error('Unexpected filter');clauses.push(ident(k)+' is null');return this;},in(k,v){clauses.push(ident(k)+' in ('+v.map(param).join(',')+')');return this;},or(value){clauses.push('('+value.split(',').map(s=>{const[k,operator,...v]=s.split('.');if(operator!=='eq')throw Error('Unexpected OR');return ident(k)+'='+param(v.join('.'));}).join(' or ')+')');return this;},order(k,{ascending=true}={}){order=' order by '+ident(k)+(ascending?' asc':' desc');return this;},update(v){method='update';values=v;return this;},insert(v){method='insert';values=v;return this;},single(){single=true;return this;},then(resolve,reject){return run().then(resolve,reject);}};
  async function run(){try{
   let query,returning=table==='profiles'&&user?profileFields:'*';
   if(method==='select'){
    const selected=columns.includes('(')||columns==='*'?returning:columns.split(',').map(ident).join(',');query='select '+selected+' from public.'+ident(table);
   }else{const keys=Object.keys(values),encoded=keys.map(k=>typeof values[k]==='object'&&values[k]!==null?JSON.stringify(values[k]):values[k]);
    if(method==='insert')query='insert into public.'+ident(table)+'('+keys.map(ident).join(',')+') values('+encoded.map(param).join(',')+')';
    else query='update public.'+ident(table)+' set '+keys.map((k,i)=>ident(k)+'='+param(encoded[i])).join(',');
   }
   if(clauses.length)query+=' where '+clauses.join(' and ');query+=method==='select'?order:' returning '+returning;
   let rows=await sql(query,params,user);
   if(columns.includes('('))rows=await Promise.all(rows.map(async row=>{
    const neighbor=async id=>(await sql('select display_name,neighborhood,city,stripe_onboarding_complete from public.profiles where id=$1',[id],user))[0];
    if(table==='tools')row.owner=await neighbor(row.owner_id);
    if(table==='rentals'){row.tool=(await sql('select id,title,tracking_code,photo_path,condition from public.tools where id=$1',[row.tool_id],user))[0];row.owner=await neighbor(row.owner_id);row.renter=await neighbor(row.renter_id);}
    if(table==='messages'){row.sender=await neighbor(row.sender_id);row.recipient=await neighbor(row.recipient_id);}
    if(table==='reviews')row.author=await neighbor(row.author_id);return row;
   }));
   return {data:single?rows[0]||null:rows};
  }catch(error){return {error};}}
  return chain;
 }
 const admin={rpc,from,storage:{from:()=>({download:async path=>({data:png})})}};
 const stripe={checkout:{sessions:{list:async()=>{stripeCalls++;return {data:[...sessions.values()],has_more:false};},retrieve:async id=>{stripeCalls++;return sessions.get(id);},create:async args=>{stripeCalls++;const id='cs_fixture_'+crypto.randomUUID(),s={id,status:'open',payment_status:'unpaid',livemode:false,metadata:args.metadata,client_reference_id:args.client_reference_id,amount_total:args.line_items[0].price_data.unit_amount,currency:'usd',payment_intent:'pi_'+id,success_url:args.success_url,cancel_url:args.cancel_url,url:'http://127.0.0.1:5174/__stripe/'+id};sessions.set(id,s);return s;},expire:async id=>{stripeCalls++;sessions.get(id).status='expired';return sessions.get(id);}}}};
 class HttpError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const runtime={authenticate:async req=>{const user=getUser(req);if(!user)throw new HttpError('Sign in',401);return {user,admin};},checked:r=>{if(r.error)throw r.error;return r.data;},checkedUrl:s=>s,endpoint:f=>async req=>{try{return Response.json(await f(req));}catch(error){return Response.json({error:error.message},{status:error.status||400});}},HttpError,stripeClient:()=>stripe};
 const handlers={};for(const name of ['rental-booking','create-checkout','rental-action'])handlers[name]=await edgeHandler('supabase/functions/'+name+'/index.ts',runtime);
 async function intercept(route){const req=route.request(),url=new URL(req.url()),p=url.pathname,method=req.method(),payload=req.postDataJSON?.bind(req),user=getUser(new Request(req.url(),{headers:req.headers()}));requests.push({p,method});let data={},status=200;
  try{
   if(p==='/auth/v1/signup'){const body=payload();const u=await addUser(body.email,body.data?.display_name||'');data={user:{...u,email_confirmed_at:undefined},session:null};}
   else if(p==='/auth/v1/token'){const u=users.get(payload()?.email);if(!u)throw Error('Invalid credentials');data={access_token:jwt(u),refresh_token:'fixture-'+u.id,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:u};}
   else if(p==='/auth/v1/user')data=user;
   else if(p.startsWith('/functions/v1/')){const handler=handlers[p.split('/').at(-1)];if(!handler)throw Error('Unexpected function: '+p);const response=await handler(new Request(req.url(),{method,headers:req.headers(),body:req.postData()}));data=await response.json();status=response.status;}
   else if(p.startsWith('/rest/v1/rpc/')){const r=await rpc(p.split('/').at(-1),payload(),user);if(r.error)throw r.error;data=r.data;}
   else if(p.startsWith('/rest/v1/')){
    const table=p.split('/').at(-1),q=from(table,user);q.select(url.searchParams.get('select')||'*');
    for(const[k,v]of url.searchParams)if(!['select','order'].includes(k)){if(v.startsWith('eq.'))q.eq(k,v.slice(3));}
    const ordering=url.searchParams.get('order');if(ordering){const[k,dir]=ordering.split('.');q.order(k,{ascending:dir!=='desc'});}
    if(method==='PATCH')q.update(payload());else if(method==='POST')q.insert(payload());
    if(req.headers().accept?.includes('vnd.pgrst.object'))q.single();const r=await q;if(r.error)throw r.error;data=r.data;
   }else if(p.startsWith('/storage/v1/object/sign/')&&method==='POST'){
    const [bucket,...parts]=decodeURIComponent(p.slice('/storage/v1/object/sign/'.length)).split('/'),path=parts.join('/');const rows=await sql('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,path],user);if(!rows.length)throw Error('Photo access denied');data={signedURL:'/object/sign/'+bucket+'/'+path+'?token=fixture'};
   }else if(p.startsWith('/storage/v1/object/')&&method==='POST'){
    const [bucket,...parts]=decodeURIComponent(p.slice('/storage/v1/object/'.length)).split('/'),path=parts.join('/');await sql('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,path],user);data={Key:bucket+'/'+path};
   }else if(p.startsWith('/storage/v1/')&&method==='GET'){await route.fulfill({status:200,contentType:'image/png',body:png});return;}
  }catch(error){data={message:error.message};status=400;}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 }
 return {db,sql,addUser,intercept,sessions,requests,stripeCalls:()=>stripeCalls,png};
}
