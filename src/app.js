import { supabase } from './supabase.js';
import { money,quote,esc,distanceMiles } from './core.js';
import {invokeFunction,badgesFor,featuredBadge,photoExtension} from './services.js';
import L from 'leaflet';
import QRCode from 'qrcode';
import {classifyTool,removePhotoBackground} from './local-vision.js';
import {applySuggestionToDraft} from './tool-identification.js';
import 'leaflet/dist/leaflet.css';
import './style.css';
const invoke=(name,body)=>invokeFunction(supabase,name,body);
let nearbyLocation=null,activeMap=null,authNotice="",pendingEmail="";
const reputationById=new Map();
const chatDrafts=new Map();
let foregroundRequests=0,refreshSequence=0,cameraStream=null,marketplaceTimer=null;
function stopCamera(){cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;}



const $=s=>document.querySelector(s);
const app=$('#app');
const modal=$('#modal');
const toastEl=$('#toast');
let session=null,user=null,profile=null,tools=[],rentals=[],messages=[],reviews=[],credits=0,route='/',realtimeChannel=null,passwordRecovery=false;
const categories=['Power tools','Outdoor','Home & DIY','Garden','Automotive','Other'];

function toast(msg){toastEl.textContent=msg;toastEl.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>toastEl.hidden=true,4200)}
function nav(path){location.hash=path.startsWith('#')?path:'#'+path}
modal.addEventListener('close',stopCamera);
function closeModal(){stopCamera();if(modal.open)modal.close();modal.innerHTML=''}
function showModal(html,className=''){modal.className=className;modal.innerHTML=html;modal.showModal();const c=modal.querySelector('[data-close]');if(c)c.onclick=closeModal}
function setBusy(btn,on=true){if(btn){btn.disabled=on;btn.dataset.oldText??=btn.textContent;if(on)btn.textContent='Working…';else btn.textContent=btn.dataset.oldText}}
function errorText(e){return e?.message||String(e||'Something went wrong.')}
function initials(name='Neighbor'){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function tracking(tool){return tool?.tracking_code||('NG'+String(tool?.id||'').replaceAll('-','').slice(0,8).toUpperCase())}
function authRedirectUrl(){return window.NG_CONFIG?.authRedirectUrl||location.href.split('#')[0]}
function pendingMfaKey(){return user?.id?`ng-pending-totp:${user.id}`:''}
function getPendingMfaId(){try{return pendingMfaKey()?localStorage.getItem(pendingMfaKey()):null}catch{return null}}
function setPendingMfaId(id){try{if(pendingMfaKey())localStorage.setItem(pendingMfaKey(),id)}catch{}}
function clearPendingMfaId(){try{if(pendingMfaKey())localStorage.removeItem(pendingMfaKey())}catch{}}

async function bootstrap(){
  const callbackError=new URLSearchParams(location.hash.slice(1)).get('error_description')||new URLSearchParams(location.search).get('error_description');
  if(callbackError){authNotice=`Confirmation link could not be used: ${callbackError}. Sign in or request a new link.`;history.replaceState(null,'',location.pathname+'#/');}
  const {data}=await supabase.auth.getSession();
  session=data.session;user=session?.user||null;
  supabase.auth.onAuthStateChange((event,s)=>{
    const previous=user?.id;
    session=s;user=s?.user||null;
    if(previous===user?.id&&['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'].includes(event))return;
    if(event==='PASSWORD_RECOVERY')passwordRecovery=true;
    if(event==='SIGNED_OUT')passwordRecovery=false;
    setTimeout(()=>refresh(),0);
  });
  window.addEventListener('hashchange',()=>{route=(location.hash||'#/').slice(1)||'/';render();window.scrollTo(0,0)});
  route=(location.hash||'#/').slice(1)||'/';
  await refresh();
}

async function refresh({quiet=false}={}){
  if(quiet&&(modal.open||foregroundRequests))return;
  if(!quiet)foregroundRequests++;
  const refreshId=++refreshSequence,accountId=user?.id;
  const isCurrent=()=>refreshId===refreshSequence&&user?.id===accountId;
  if(!user){closeModal();chatDrafts.clear();nearbyLocation=null;profile=null;tools=[];rentals=[];messages=[];reviews=[];credits=0;reputationById.clear();unsubscribeRealtime();render();if(!quiet)foregroundRequests--;return;}
  try{
    const factors=await supabase.auth.mfa.listFactors();
    if(factors.error)throw factors.error;
    if(!isCurrent())return;
    const verifiedFactors=(factors.data?.totp||[]).filter(x=>x.status==='verified');
    const aal=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal.error) throw aal.error;
    if(!isCurrent())return;
    if(passwordRecovery){
      if(verifiedFactors.length&&aal.data?.currentLevel!=='aal2'){renderMfaChallenge();return;}
      renderPasswordRecovery();return;
    }
    if(verifiedFactors.length&&aal.data?.currentLevel!=='aal2'){renderMfaChallenge();return;}
    const [p,t,r,m,v,c]=await Promise.all([
      supabase.from('profiles').select('id,display_name,neighborhood,city,state,bio,avatar_path,created_at,updated_at,stripe_onboarding_complete').eq('id',accountId).single(),
      supabase.from('tools').select('*, owner:profiles!tools_owner_id_fkey(display_name,neighborhood,city,stripe_onboarding_complete)').order('created_at',{ascending:false}),
      supabase.from('rentals').select('*, tool:tools(id,title,tracking_code,photo_path,condition), renter:profiles!rentals_renter_id_fkey(display_name), owner:profiles!rentals_owner_id_fkey(display_name)').order('created_at',{ascending:false}),
      supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(display_name), recipient:profiles!messages_recipient_id_fkey(display_name)').order('created_at',{ascending:true}),
      supabase.from('reviews').select('*,author:profiles!reviews_author_id_fkey(display_name)').order('created_at',{ascending:false}),
      supabase.from('credit_ledger').select('amount_cents')
    ]);
    for(const x of [p,t,r,m,v,c]) if(x.error) throw x.error;
    if(!isCurrent())return;
    const nextTools=t.data||[],nextRentals=r.data||[],nextMessages=m.data||[];
    await hydratePhotos(nextTools,nextRentals);
    if(!isCurrent())return;
    const nextReputation=await hydrateReputation(accountId,nextTools,nextMessages);
    if(!isCurrent())return;
    profile=p.data;tools=nextTools;rentals=nextRentals;messages=nextMessages;reviews=v.data||[];credits=(c.data||[]).reduce((s,x)=>s+Number(x.amount_cents||0),0);
    reputationById.clear();for(const [id,metrics] of nextReputation)reputationById.set(id,metrics);
    subscribeRealtime();
    if(!quiet||['/garage','/rentals'].includes(route.split('?')[0]))render();
  }catch(e){if(!isCurrent()||quiet)return;app.innerHTML=`<main class="shell"><div class="alert error"><h2>Could not load your account</h2><p>${esc(errorText(e))}</p><button id="retry-account">Try again</button> <button id="signout-error">Sign out</button></div></main>`;$('#retry-account').onclick=()=>refresh();$('#signout-error').onclick=()=>supabase.auth.signOut();const retryDelete=document.createElement('button');retryDelete.textContent='Finish account deletion';retryDelete.onclick=deleteAccountDialog;app.querySelector('.alert').append(retryDelete)}finally{if(!quiet)foregroundRequests--;}
}

async function hydrateReputation(accountId,loadedTools,loadedMessages){
  const result=new Map();
  const ids=[...new Set([accountId,...loadedTools.map(t=>t.owner_id),...loadedMessages.flatMap(m=>[m.sender_id,m.recipient_id])])];
  for(let i=0;i<ids.length;i+=50){
    const {data,error}=await supabase.rpc('reputation_summary',{p_ids:ids.slice(i,i+50)});
    if(error){console.warn('Reputation unavailable',error.code);return result;}
    for(const row of data||[])result.set(row.user_id,{listed:Number(row.listed),borrowed:Number(row.borrowed),lent:Number(row.lent),reviewCount:Number(row.review_count),rating:Number(row.rating)});
  }
  return result;
}
function metricsFor(id){return reputationById.get(id)||{listed:0,borrowed:0,lent:0,reviewCount:0,rating:0};}
function badgeTag(id){const badge=featuredBadge(metricsFor(id));return badge?`<span class="badge-tag" title="Earned community badge">${badge.icon} ${esc(badge.name)}</span>`:'';}

async function hydratePhotos(loadedTools,loadedRentals){
  await Promise.all(loadedTools.map(async t=>{
    if(!t.photo_path){t.photo_url='';return}
    const {data}=await supabase.storage.from('tool-photos').createSignedUrl(t.photo_path,3600);
    t.photo_url=data?.signedUrl||'';
  }));
  await Promise.all(loadedRentals.map(async r=>{
    if(r.baseline_photo_path){const result=await supabase.storage.from('tool-photos').createSignedUrl(r.baseline_photo_path,1800);r.baseline_photo_url=result.data?.signedUrl||'';}
    if(!r.return_photo_path)return;
    const {data}=await supabase.storage.from('return-photos').createSignedUrl(r.return_photo_path,1800);
    r.return_photo_url=data?.signedUrl||'';
  }));
}

function subscribeRealtime(){
  if(realtimeChannel)return;
  const accountId=user.id;
  realtimeChannel=supabase.channel('ng-marketplace').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async()=>{const result=await supabase.from('messages').select('*,sender:profiles!messages_sender_id_fkey(display_name),recipient:profiles!messages_recipient_id_fkey(display_name)').order('created_at',{ascending:true});if(!result.error&&user?.id===accountId){messages=result.data||[];if(route.startsWith('/messages')&&!modal.open){renderMessages($('#content'));}}});
  for(const table of ['rentals','tools','reviews'])realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table},payload=>{if(table==='rentals'&&payload.new?.owner_id===user?.id&&payload.new?.status==='review')toast('A tool was returned. Open My garage to review its condition.');clearTimeout(marketplaceTimer);marketplaceTimer=setTimeout(()=>refresh({quiet:true}),350);});
  realtimeChannel.subscribe();
}
function unsubscribeRealtime(){clearTimeout(marketplaceTimer);if(realtimeChannel){supabase.removeChannel(realtimeChannel);realtimeChannel=null}}

function render(){
  if(activeMap){activeMap.remove();activeMap=null;}
  if(!user)return renderAuth();
  if(!profile||!profile.display_name||!profile.neighborhood||!profile.city||!profile.state)return renderOnboarding();
  const path=route.split('?')[0];
  app.innerHTML=layout();
  const content=$('#content');
  if(path==='/')renderExplore(content);
  else if(path.startsWith('/tool/'))renderTool(content,path.split('/')[2]);
  else if(path==='/lend')renderLend(content);
  else if(path.startsWith('/edit/')){const t=tools.find(x=>x.id===path.split('/')[2]&&x.owner_id===user.id&&!x.archived_at);if(!t||toolInUse(t.id)){content.innerHTML='<div class="empty"><h2>Listing cannot be edited</h2><p>Finish any active rental first.</p><a href="#/garage">Back to My garage</a></div>';}else renderLend(content,t);}
  else if(path==='/rentals')renderRentals(content);
  else if(path==='/garage')renderGarage(content);
  else if(path==='/messages')renderMessages(content);
  else if(path==='/profile')renderProfile(content);
  else if(path.startsWith('/neighbor/'))renderNeighbor(content,path.split('/')[2]);
  else content.innerHTML='<div class="empty"><h2>Page not found</h2><a class="button" href="#/">Back home</a></div>';
  bindGlobal();
  const params=new URLSearchParams(route.split('?')[1]||'');
  if(['return','refresh'].includes(params.get('stripe'))){const action=params.get('stripe');route='/profile';history.replaceState(null,'',location.href.split('#')[0]+'#/profile');setTimeout(()=>action==='return'?refreshStripeStatus():startStripeOnboarding(),0);}
  if(params.get('payment')==='cancel'&&params.get('rental')){
    const rentalId=params.get('rental'),cleanPath=route.split('?')[0];
    route=cleanPath;history.replaceState(null,'',location.href.split('#')[0]+'#'+cleanPath);
    setTimeout(()=>cancelPendingRental(rentalId),0);
  }
}

function layout(){
  return `<header class="topbar"><a class="brand" href="#/"><img src="./favicon.svg" alt=""><span>Neighborhood<br><b>Garage</b></span></a><nav>${[['/','Explore'],['/rentals','Rentals'],['/garage','My garage'],['/messages','Messages']].map(([p,l])=>`<a href="#${p}" class="${route.split('?')[0]===p?'active':''}">${l}</a>`).join('')}</nav><div class="top-actions"><button class="ghost" data-go="/lend">List a tool</button><button class="avatar" data-go="/profile" aria-label="Profile">${esc(initials(profile?.display_name))}</button></div></header><main id="content" class="shell"></main><footer>Neighborhood Garage · Share more. Buy less.</footer>`;
}
function bindGlobal(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go))}

function renderAuth(){
  app.innerHTML=`<main class="auth-page"><section class="auth-hero"><div class="eyebrow">Neighbors helping neighbors</div><h1>The tool you need may already be next door.</h1><p>Borrow useful tools nearby, lend what you own, and keep deposits moving as Tool Share Credits.</p><div class="trust-row"><span>Secure accounts</span><span>Private uploads</span><span>Protected checkout</span></div></section><section class="auth-card"><div class="brand auth-brand"><img src="./favicon.svg" alt=""><span>Neighborhood <b>Garage</b></span></div><div class="tabs"><button class="active" data-auth-tab="signin">Sign in</button><button data-auth-tab="signup">Create account</button></div><p id="auth-notice" class="panel-lite ${authNotice?'':'hidden'}" role="status">${esc(authNotice)}</p><button id="resend-confirmation" class="linkish ${pendingEmail?'':'hidden'}" type="button">Resend confirmation email</button><form id="signin" class="stack"><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required></label><button class="primary">Sign in</button><button type="button" class="linkish" id="reset-password">Forgot password?</button></form><form id="signup" class="stack hidden"><label>Your name<input name="displayName" maxlength="60" required></label><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Password<input type="password" name="password" autocomplete="new-password" minlength="12" required></label><p class="fine">Use at least 12 characters. You’ll verify your email before using the marketplace.</p><button class="primary">Create account</button></form></section></main>`;
  const tabs=[...document.querySelectorAll('[data-auth-tab]')];
  tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.toggle('active',x===b));$('#signin').classList.toggle('hidden',b.dataset.authTab!=='signin');$('#signup').classList.toggle('hidden',b.dataset.authTab!=='signup')});
  $('#signin').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target);const {data,error}=await supabase.auth.signInWithPassword({email:String(f.get('email')).trim(),password:f.get('password')});if(error)throw error;if(!data.session)throw new Error('Sign-in did not create a session. Please try again.');authNotice='';pendingEmail='';session=data.session;user=data.user;await refresh();}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#signup').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target),email=String(f.get('email')).trim();const {data,error}=await supabase.auth.signUp({email,password:f.get('password'),options:{data:{display_name:String(f.get('displayName')).trim()},emailRedirectTo:authRedirectUrl()}});if(error)throw error;if(data.session){authNotice='';pendingEmail='';session=data.session;user=data.user;await refresh();return;}pendingEmail=email;authNotice=`Check ${email} for the confirmation link. If this address already has an account, sign in or reset its password.`;$('#auth-notice').textContent=authNotice;$('#auth-notice').classList.remove('hidden');$('#resend-confirmation').classList.remove('hidden');tabs[0].click();$('#signin').elements.email.value=email;}catch(err){const current=await supabase.auth.getSession();if(current.data?.session){session=current.data.session;user=session.user;authNotice='';await refresh();}else toast(errorText(err))}finally{setBusy(b,false)}};
  $('#resend-confirmation').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{const {error}=await supabase.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:authRedirectUrl()}});if(error)throw error;toast('Confirmation email requested. Check your inbox and spam folder.')}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#reset-password').onclick=async()=>{const email=prompt('Enter your account email');if(!email)return;const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authRedirectUrl()});toast(error?error.message:'Password reset email sent.')};
}

function renderOnboarding(){
  app.innerHTML=`<main class="onboard"><section class="onboard-card"><div class="eyebrow">One quick step</div><h1>Build your neighborhood profile.</h1><p class="muted">Your exact address is never shown in the public catalog. Use a neighborhood or nearby area.</p><form id="profile-form" class="stack"><label>Display name<input name="display_name" maxlength="60" value="${esc(profile?.display_name||user.user_metadata?.display_name||'')}" required></label><label>Neighborhood<input name="neighborhood" maxlength="80" placeholder="e.g. Oak Grove" required></label><div class="form-grid"><label>City<input name="city" maxlength="80" required></label><label>State<input name="state" maxlength="40" required></label></div><label>Short bio<textarea name="bio" maxlength="500" placeholder="Weekend DIYer, happy to share tools and tips."></textarea></label><button class="primary">Finish setup</button></form><button id="signout-onboard" class="linkish">Sign out</button></section></main>`;
  $('#profile-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=Object.fromEntries(new FormData(e.target));const {data,error}=await supabase.from('profiles').update(f).eq('id',user.id).select('id').single();if(error)throw error;if(!data)throw new Error('Your profile could not be saved. Try again.');await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#signout-onboard').onclick=()=>supabase.auth.signOut();
}

function toolCard(t){
  return `<article class="tool-card"><button data-tool="${t.id}" class="card-hit"><div class="tool-image">${t.photo_url?`<img src="${esc(t.photo_url)}" alt="${esc(t.title)}">`:'<span>🛠️</span>'}<div class="badge">${t.available?'Available':'Reserved'}</div></div><div class="card-copy"><div class="meta">${esc(t.category)} · ${t.distance!=null?t.distance.toFixed(1)+' mi away':esc(t.owner?.neighborhood||'Neighborhood pickup')}</div><h3>${esc(t.title)}</h3><div class="row"><strong>${money(t.rate_cents)} <small>/ day</small></strong><span>${esc(t.owner?.display_name||'Neighbor')}</span></div>${badgeTag(t.owner_id)}</div></button></article>`;
}
function renderExplore(root){
  root.innerHTML=`<section class="hero"><div><div class="eyebrow">Your neighborhood tool shelf</div><h1>Big plans. Neighborly prices.</h1><p>Find what you need nearby instead of buying it for one project.</p></div><button class="primary" data-go="/lend">List something you own</button></section><section class="filterbar"><label>Find a tool<input id="search" placeholder="Drills, ladders, garden tools…"></label><label>Category<select id="category"><option value="">All categories</option>${categories.map(c=>`<option>${c}</option>`).join('')}</select></label></section><section class="discovery-bar"><button id="locate">Use my location</button><label>Distance<select id="radius"><option value="">Any distance</option><option value="2">Within 2 miles</option><option value="5">Within 5 miles</option><option value="10">Within 10 miles</option><option value="25">Within 25 miles</option></select></label><div class="tabs view-tabs"><button id="list-view" class="active" aria-pressed="true">List</button><button id="map-view" aria-pressed="false">Map</button></div></section><p id="location-status" class="fine">${nearbyLocation?'Distances are approximate.':'Use your location to sort nearby tools. You can also browse the map without sharing your location.'}</p><div id="neighborhood-map" class="neighborhood-map hidden" aria-label="Map of approximate tool locations"></div><p id="map-status" class="fine hidden"></p><div id="catalog" class="grid"></div>`;
  let mapVisible=false;
  const draw=()=>{
    const q=$('#search').value.toLowerCase(),cat=$('#category').value,radius=Number($('#radius').value)||Infinity;
    const visible=tools.filter(t=>t.owner_id!==user.id&&t.available&&(!cat||t.category===cat)&&(`${t.title} ${t.description} ${t.category} ${t.owner?.neighborhood||''}`).toLowerCase().includes(q)).map(t=>({...t,distance:nearbyLocation&&t.approximate_lat!=null?distanceMiles(nearbyLocation,{lat:t.approximate_lat,lng:t.approximate_lng}):null})).filter(t=>!nearbyLocation||radius===Infinity||(t.distance!=null&&t.distance<=radius)).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity));
    $('#catalog').innerHTML=visible.length?visible.map(toolCard).join(''):`<div class="empty span-all"><h2>No tools found</h2><p>Try a wider radius or be the first to list a tool nearby.</p></div>`;
    document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>nav('/tool/'+b.dataset.tool));
    if(mapVisible){
      if(activeMap){activeMap.remove();activeMap=null;}
      const located=visible.filter(t=>t.approximate_lat!=null&&t.approximate_lng!=null);
      activeMap=L.map('neighborhood-map',{scrollWheelZoom:false}).setView(nearbyLocation?[nearbyLocation.lat,nearbyLocation.lng]:located.length?[located[0].approximate_lat,located[0].approximate_lng]:[39.8,-98.6],nearbyLocation||located.length?12:4);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{const status=$('#map-status');if(status)status.textContent='Map tiles could not load. Tool locations and the list remain available.';}).addTo(activeMap);
      located.forEach(t=>{
        const icon={'Power tools':'🔧','Outdoor':'🪚','Home & DIY':'🛠️','Garden':'🌱','Automotive':'🔩'}[t.category]||'🧰';
        L.marker([t.approximate_lat,t.approximate_lng],{title:t.title,alt:t.title,icon:L.divIcon({className:'tool-map-marker',html:`<span aria-hidden="true">${icon}</span>`,iconSize:[32,32],iconAnchor:[16,16],popupAnchor:[0,-18]})}).addTo(activeMap).bindPopup(`<div class="tool-map-popup"><b>${esc(t.title)}</b><div>${esc(t.category)} · ${money(t.rate_cents)} / day</div><p>${esc(t.description.slice(0,100))}${t.description.length>100?'…':''}</p><small>${esc(t.owner?.display_name||'Neighbor')} · ${t.distance!=null?t.distance.toFixed(1)+' mi away':'Approximate location'}</small><a href="#/tool/${t.id}">View tool & reserve →</a></div>`);
      });
      if(nearbyLocation)L.circleMarker([nearbyLocation.lat,nearbyLocation.lng],{radius:5,color:'#ffffff',weight:2,fillColor:'#287bea',fillOpacity:1,className:'my-location-dot'}).addTo(activeMap).bindPopup('You are here (only visible to you)');
      if(!nearbyLocation&&located.length>1)activeMap.fitBounds(located.map(t=>[t.approximate_lat,t.approximate_lng]),{padding:[35,35],maxZoom:13});
      $('#map-status').textContent=`${nearbyLocation?'Your position is the blue marker. ':''}${located.length} tools on the map. ${visible.length-located.length} without a shared location. Tool pins show approximate neighborhoods, never pickup addresses.`;
    }
  };
  $('#search').oninput=draw;$('#category').onchange=draw;
  $('#radius').onchange=()=>{if(!nearbyLocation&&$('#radius').value){toast('Use your location first to filter by distance.');$('#radius').value='';}draw();};
  $('#locate').onclick=async e=>{const b=e.currentTarget,accountId=user.id,status=$('#location-status');setBusy(b);try{const found=await getLocation();if(user?.id!==accountId||!b.isConnected)return;nearbyLocation=found;status.textContent='Location found. Open Map to see your blue marker; nearby tools are sorted first. Your exact position stays in this browser session.';draw();}catch(err){if(user?.id===accountId&&b.isConnected){toast(errorText(err));status.textContent=errorText(err);}}finally{setBusy(b,false);}};
  const view=on=>{mapVisible=on;$('#neighborhood-map').classList.toggle('hidden',!on);$('#map-status').classList.toggle('hidden',!on);for(const id of ['list-view','map-view']){$('#'+id).classList.toggle('active',(id==='map-view')===on);$('#'+id).setAttribute('aria-pressed',String((id==='map-view')===on));}draw();};
  $('#map-view').onclick=()=>view(true);$('#list-view').onclick=()=>view(false);draw();
}
function locationError(err){
 if(err?.code===1)return new Error('Location permission is blocked. Allow location for this site in your browser and phone settings, then try again.');
 if(err?.code===2)return new Error('Your device could not find a position. Turn on Location Services and try outdoors or enter approximate listing coordinates.');
 return new Error('Location timed out. Turn on Location Services and try again, or enter approximate listing coordinates.');
}
async function getLocation(){
 if(!window.isSecureContext)throw new Error('Location requires HTTPS. Open the deployed secure site on your phone.');
 if(!navigator.geolocation)throw new Error('This browser does not support location. Enter approximate listing coordinates instead.');
 const position=options=>new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,options));
 let result;
 try{result=await position({enableHighAccuracy:true,timeout:20000,maximumAge:0});}
 catch(err){if(err.code===1)throw locationError(err);try{result=await position({enableHighAccuracy:false,timeout:15000,maximumAge:60000});}catch(fallback){throw locationError(fallback);}}
 return {lat:result.coords.latitude,lng:result.coords.longitude};
}
function checkoutRequestId(id,days){const key=`ng-checkout:${user.id}:${id}:${days}`;let value=sessionStorage.getItem(key);const existing=rentals.find(r=>r.checkout_request_id===value);if(!value||existing&&existing.status!=='pending_payment'){value=crypto.randomUUID();sessionStorage.setItem(key,value);}return value;}
function reviewCards(items){return items.length?items.map(v=>`<article class="review-card"><strong aria-label="${v.rating} out of 5 stars">${'★'.repeat(v.rating)}${'☆'.repeat(5-v.rating)}</strong><p>${esc(v.body||'A neighbor left a rating.')}</p><small>${esc(v.author?.display_name||'Verified renter')} · ${new Date(v.created_at).toLocaleDateString()}</small></article>`).join(''):'<p class="muted">No reviews yet. Reviews come from completed rentals.</p>';}

function renderTool(root,id){
  const t=tools.find(x=>x.id===id);if(!t){root.innerHTML='<div class="empty"><h2>Tool not found</h2></div>';return}
  const q=quote(t.rate_cents,t.deposit_cents,1,credits);
  root.innerHTML=`<a class="back" href="#/">← Explore</a><section class="detail-grid"><div><div class="detail-image">${t.photo_url?`<img src="${esc(t.photo_url)}" alt="${esc(t.title)}">`:'<span>🛠️</span>'}</div><div class="panel"><div class="eyebrow">${esc(t.category)}</div><h1>${esc(t.title)}</h1><p>${esc(t.description)}</p><div class="owner-line"><span class="mini-avatar">${esc(initials(t.owner?.display_name))}</span><a href="#/neighbor/${t.owner_id}"><b>${esc(t.owner?.display_name||'Neighbor')}</b></a>${badgeTag(t.owner_id)}</div><hr><h3>Listed condition</h3><p>${esc(t.condition)}</p><h3>Neighbor reviews</h3>${reviewCards(reviews.filter(v=>v.tool_id===t.id))}</div></div><aside class="panel sticky"><h2>${money(t.rate_cents)} <small>/ day</small></h2><label>Rental length<select id="days">${Array.from({length:14},(_,i)=>`<option value="${i+1}">${i+1} day${i?'s':''}</option>`).join('')}</select></label><div id="quote"></div><button id="reserve" class="primary wide" ${!t.available?'disabled':''}>${t.available?'Reserve & checkout':'Unavailable'}</button><button class="wide" id="message-owner">Message owner</button><div class="deposit-note"><b>How your deposit works</b><p>The deposit covers potential damage while the tool is on loan. Normal wear is expected. After return photos and owner approval, your deposit becomes Tool Share Credits immediately for your next rental. It is not an automatic card refund.</p><p>Payments use Stripe sandbox during testing. Insurance coverage is not activated in this prototype.</p></div></aside></section>`;
  const draw=()=>{const x=quote(t.rate_cents,t.deposit_cents,Number($('#days').value),credits);$('#quote').innerHTML=`<div class="summary"><div><span>Rental</span><b>${money(x.rental)}</b></div><div><span>Deposit</span><b>${money(x.deposit)}</b></div><div><span>Credits</span><b>−${money(x.creditsUsed)}</b></div><div class="total"><span>Due now</span><b>${money(x.due)}</b></div></div>`};draw();$('#days').onchange=draw;
  $('#reserve').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{const base=location.href.split('#')[0];const data=await invoke('create-checkout',{toolId:t.id,days:Number($('#days').value),requestId:checkoutRequestId(t.id,Number($('#days').value)),successUrl:base+'#/rentals?payment=success',cancelUrl:base+'#/tool/'+t.id});if(data.checkoutUrl)location.assign(data.checkoutUrl);else{toast('Reserved using Tool Share Credits.');nav('/rentals');await refresh()}}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#message-owner').onclick=()=>nav('/messages?peer='+t.owner_id);
}

function renderLend(root,editing=null){
 root.innerHTML=`<a class="back" href="#/garage">← My garage</a><section class="page-head"><div><div class="eyebrow">Put idle tools to work</div><h1>${editing?'Edit listing':'List a tool'}</h1><p>${editing?'Update details below. A replacement photo is optional.':'Start with a clear photo.'} Get on-device photo suggestions before publishing.</p></div></section><form id="lend-form" class="form-card">${!profile.stripe_onboarding_complete?'<div class="panel-lite">You can publish now. Rental earnings stay in Tool Share Credits. <a href="#/profile">Connect Stripe</a> when you want to withdraw.</div>':''}<label>Original tool photo<input id="tool-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" ${editing?'':'required'}></label><img id="photo-preview" class="upload-preview hidden" alt="Your tool photo"><div class="actions"><button type="button" id="identify-tool">Identify on this device</button><button type="button" id="clean-photo">Remove background</button><button type="button" id="original-photo" class="hidden">Use original</button></div><label>Label or barcode close-up (optional)<input id="label-photo" name="labelPhoto" type="file" accept="image/jpeg,image/png,image/webp"><span class="fine">Use a clear close-up of the brand and model label. This photo is used only for the local scan.</span></label><p id="ai-status" class="fine" role="status">Free recognition runs on your device and suggests a title, description and readable brand/model details. The first scan downloads models. Review each suggestion before publishing.</p><section id="scan-suggestion" class="panel-lite hidden" aria-label="Photo scan results"></section><div class="form-grid"><label>Tool title<input name="title" maxlength="100" minlength="2" required></label><label>Category<select name="category">${categories.map(c=>`<option>${c}</option>`).join('')}</select></label></div><label>Description<textarea name="description" maxlength="2000" required></textarea></label><label>Current condition<textarea name="condition" maxlength="1000" required></textarea></label><div class="form-grid"><label>Daily price ($)<input name="rate" type="number" min="1" max="1000" step="0.01" required></label><label>Deposit ($)<input name="deposit" type="number" min="0" max="10000" step="0.01" required></label></div><p id="profit-preview" class="panel-lite">Your earnings: daily price minus a 5% platform fee. Deposits are refundable and are not earnings.</p><fieldset><legend>Approximate tool location</legend><p class="fine">Coordinates are rounded to about a neighborhood. Share the pickup address privately in chat.</p><button type="button" id="listing-location">Use my location</button><div class="form-grid"><label>Latitude<input name="lat" type="number" step="any" min="-90" max="90" placeholder="Optional"></label><label>Longitude<input name="lng" type="number" step="any" min="-180" max="180" placeholder="Optional"></label></div></fieldset><button class="primary">${editing?'Save changes':'Publish listing'}</button></form>`;
 const form=$('#lend-form'),aiStatus=form.querySelector('#ai-status'),scanResult=form.querySelector('#scan-suggestion');let uploadedPath=null,uploadedFile=null,previewUrl=null,cleanedPath=null,previousSuggestion={},categoryTouched=false,scanSequence=0;
 form.elements.category.addEventListener('change',()=>{categoryTouched=true;});
 if(editing){for(const k of ['title','category','description','condition'])form.elements[k].value=editing[k]||'';form.elements.rate.value=(editing.rate_cents/100).toFixed(2);form.elements.deposit.value=(editing.deposit_cents/100).toFixed(2);form.elements.lat.value=editing.approximate_lat??'';form.elements.lng.value=editing.approximate_lng??'';if(editing.photo_url){$('#photo-preview').src=editing.photo_url;$('#photo-preview').classList.remove('hidden');}}
 const upload=async()=>{const file=form.elements.photo.files[0];if(!file&&editing)return editing.baseline_photo_path||editing.photo_path;const ext=photoExtension(file);if(uploadedPath&&file===uploadedFile)return uploadedPath;const path=`${user.id}/${crypto.randomUUID()}.${ext}`;const result=await supabase.storage.from('tool-photos').upload(path,file,{upsert:false});if(result.error)throw result.error;uploadedFile=file;uploadedPath=path;return path;};
 $('#tool-photo').onchange=()=>{scanSequence++;scanResult.classList.add('hidden');cleanedPath=null;$('#original-photo').classList.add('hidden');const file=form.elements.photo.files[0];try{photoExtension(file);if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);$('#photo-preview').src=previewUrl;$('#photo-preview').classList.remove('hidden');$('#ai-status').textContent='Photo ready. Identify it with AI or enter details below.';}catch(err){toast(errorText(err));}};
 $('#identify-tool').onclick=async e=>{
  const b=e.currentTarget,sequence=++scanSequence;setBusy(b);
  try{
   let file=form.elements.photo.files[0];const labelFile=form.elements.labelPhoto.files[0];
   if(!file&&editing?.photo_url){const response=await fetch(editing.photo_url);if(!response.ok)throw new Error('Could not open the saved tool photo. Choose a replacement photo to scan.');file=await response.blob();}
   photoExtension(file);if(labelFile)photoExtension(labelFile);
   const v=await classifyTool(file,{labelFile:labelFile||file,onProgress:message=>{if(form.isConnected&&sequence===scanSequence)aiStatus.textContent=message;}});
   if(!form.isConnected||sequence!==scanSequence)return;
   const current=Object.fromEntries(['title','description','category'].map(key=>[key,form.elements[key].value]));
   const draft=applySuggestionToDraft(current,v,{previous:previousSuggestion,categoryTouched});
   for(const key of ['title','description','category'])form.elements[key].value=draft[key];
   previousSuggestion=v;aiStatus.textContent=v.notice;
   scanResult.innerHTML=`<b>Photo suggestions — review before publishing</b>${v.title?`<p>${esc(v.title)}</p>`:''}${v.description?`<p class="listing-description">${esc(v.description)}</p>`:''}${v.brand?`<p>Brand read: <b>${esc(v.brand)}</b></p>`:''}${v.model?`<p>Model / part number: <b>${esc(v.model)}</b></p>`:''}${v.barcodes?.length?`<p class="tracking">Barcode: ${v.barcodes.map(esc).join(', ')}</p>`:''}<p class="fine">Your existing edits are preserved. Brand and model details are included in the suggested title and description.</p><div class="actions">${v.title&&v.title!==form.elements.title.value?'<button type="button" id="use-scan-title">Use suggested title</button>':''}${v.description&&v.description!==form.elements.description.value?'<button type="button" id="use-scan-description">Use suggested description</button>':''}</div>`;
   scanResult.classList.remove('hidden');
   for(const [selector,key] of [['#use-scan-title','title'],['#use-scan-description','description']]){const accept=scanResult.querySelector(selector);if(accept)accept.onclick=()=>{form.elements[key].value=v[key];accept.remove();};}
  }catch(err){if(form.isConnected&&sequence===scanSequence)aiStatus.textContent=errorText(err);}
  finally{setBusy(b,false);}
 };
 $('#label-photo').onchange=()=>{scanSequence++;scanResult.classList.add('hidden');aiStatus.textContent='Label photo ready. Tap Identify on this device to read it with the tool photo.';};
 $('#clean-photo').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{const file=form.elements.photo.files[0];photoExtension(file);$('#ai-status').textContent='Removing background on this device…';const blob=await removePhotoBackground(file);const path=`${user.id}/${crypto.randomUUID()}.png`;const result=await supabase.storage.from('tool-photos').upload(path,blob,{contentType:'image/png',upsert:false});if(result.error)throw result.error;cleanedPath=path;$('#photo-preview').src=URL.createObjectURL(blob);$('#photo-preview').classList.remove('hidden');$('#original-photo').classList.remove('hidden');$('#ai-status').textContent='Background removed on your device. Original photo will remain as condition evidence.';}catch(err){$('#ai-status').textContent=errorText(err);}finally{setBusy(b,false);}};
 $('#original-photo').onclick=()=>{cleanedPath=null;$('#photo-preview').src=previewUrl;$('#original-photo').classList.add('hidden');$('#ai-status').textContent='Using the original photo.';};
 form.elements.rate.oninput=()=>{const q=quote(Math.round(Number(form.elements.rate.value)*100),0,1);$('#profit-preview').textContent=`Estimated earnings per rental day: ${money(q.owner)} after the ${money(q.fee)} platform fee (5%). Deposits are refundable, not earnings.`;};
 $('#listing-location').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{const loc=await getLocation();form.elements.lat.value=loc.lat.toFixed(2);form.elements.lng.value=loc.lng.toFixed(2);}catch(err){toast(errorText(err));}finally{setBusy(b,false);}};
 form.onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(form),path=await upload();const lat=f.get('lat'),lng=f.get('lng');if(Boolean(lat)!==Boolean(lng))throw new Error('Enter both coordinates or leave both blank.');const payload={owner_id:user.id,title:f.get('title'),category:f.get('category'),description:f.get('description'),condition:f.get('condition'),rate_cents:Math.round(Number(f.get('rate'))*100),deposit_cents:Math.round(Number(f.get('deposit'))*100),photo_path:cleanedPath||(!form.elements.photo.files[0]&&editing?editing.photo_path:path),baseline_photo_path:path,approximate_lat:lat?Number(Number(lat).toFixed(2)):null,approximate_lng:lng?Number(Number(lng).toFixed(2)):null,available:editing?editing.available:true};const result=editing?await supabase.from('tools').update(payload).eq('id',editing.id).eq('owner_id',user.id).select('id').single():await supabase.from('tools').insert(payload).select('id').single();if(result.error)throw result.error;toast(editing?'Listing updated.':'Your tool is published.');nav('/garage');await refresh();}catch(err){toast(errorText(err));}finally{setBusy(b,false);}};
}

function statusLabel(s){return ({pending_payment:'Payment pending',reserved:'Ready for pickup',out:'Borrowed',review:'Awaiting owner review',complete:'Complete',disputed:'Under review',payment_failed:'Payment incomplete',cancelled:'Cancelled'})[s]||s}
function renderRentals(root){
  const mine=rentals.filter(r=>r.renter_id===user.id);
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Borrowed by you</div><h1>My rentals</h1></div></section><div class="stack-list">${mine.length?mine.map(r=>`<article class="rental-card"><div><span class="status">${esc(statusLabel(r.status))}</span><h3>${esc(r.tool?.title||'Tool')}</h3><p>${r.days} day${r.days===1?'':'s'} · ${money(r.rental_cents)} rental · ${money(r.deposit_cents)} deposit</p><p class="tracking">Tracking: <b>${esc(tracking(r.tool))}</b></p></div><div class="actions">${r.status==='pending_payment'?`<button class="primary" data-resume="${r.id}">Resume checkout</button><button data-sync-payment="${r.id}">Check payment status</button><button data-cancel-rental="${r.id}">Cancel checkout</button>`:''}${r.status==='reserved'?`<button class="primary" data-pickup="${r.id}">Confirm pickup</button>`:''}${r.status==='out'?`<button class="primary" data-return="${r.id}">Return tool</button>`:''}${r.status==='complete'&&!reviews.some(v=>v.rental_id===r.id)?`<button data-review="${r.id}">Leave review</button>`:''}</div></article>`).join(''):`<div class="empty"><h2>No rentals yet</h2><p>Browse the neighborhood and reserve your first tool.</p><button class="primary" data-go="/">Explore tools</button></div>`}</div>`;
  document.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>resumeCheckout(b.dataset.resume,b));
  document.querySelectorAll('[data-sync-payment]').forEach(b=>b.onclick=()=>rentalAction(b.dataset.syncPayment,'sync-payment',{}).catch(e=>toast(errorText(e))));
  document.querySelectorAll('[data-cancel-rental]').forEach(b=>b.onclick=()=>cancelPendingRental(b.dataset.cancelRental));
  document.querySelectorAll('[data-pickup]').forEach(b=>b.onclick=()=>pickupDialog(b.dataset.pickup));
  document.querySelectorAll('[data-return]').forEach(b=>b.onclick=()=>returnDialog(b.dataset.return));
  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewDialog(b.dataset.review));
}

function toolInUse(id){return rentals.some(r=>r.tool_id===id&&['pending_payment','reserved','out','review','disputed'].includes(r.status));}
function renderGarage(root){
  const showRemoved=new URLSearchParams(route.split('?')[1]||'').get('removed')==='1';
  const owned=tools.filter(t=>t.owner_id===user.id&&Boolean(t.archived_at)===showRemoved),pending=rentals.filter(r=>r.owner_id===user.id&&r.status==='review');
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Tools you share</div><h1>My garage</h1></div><button class="primary" data-go="/lend">List a tool</button></section>${rentals.some(r=>r.owner_id===user.id&&r.payout_status==='pending')?`<section class="panel"><h2>Pending payouts</h2>${rentals.filter(r=>r.owner_id===user.id&&r.payout_status==='pending').map(r=>`<div class="row"><span>${esc(r.tool?.title)} · ${money(r.owner_payout_cents)}</span><button data-payout="${r.id}">Retry payout</button></div>`).join('')}</section>`:''}${pending.length?`<section><h2>Returns to review</h2><div class="stack-list">${pending.map(r=>`<article class="return-card"><div><span class="status">Owner review</span><h3>${esc(r.tool?.title||'Tool')}</h3><p>${esc(r.assessment?.note||'Review the return photo and condition before approving.')}</p><p class="fine">${esc(r.assessment?.source==='ai'?'AI-assisted assessment — owner approval required':'Manual owner review')} · ${esc(r.assessment?.assessment||'Comparison pending')}</p><p>Renter note: ${esc(r.assessment?.renterNote||'None')}</p>${r.baseline_photo_url?`<figure><img src="${esc(r.baseline_photo_url)}" alt="Original tool condition"><figcaption>Original condition</figcaption></figure>`:''}${r.return_photo_url?`<img src="${esc(r.return_photo_url)}" alt="Return condition">`:''}</div><div class="actions"><button class="primary" data-approve="${r.id}">Approve + return ${money(r.deposit_cents)} credits</button><button data-dispute="${r.id}">Hold for review</button></div></article>`).join('')}</div></section>`:''}<section><h2>${showRemoved?'Removed listings':'Your listings'}</h2><p><a href="#/garage${showRemoved?'':'?removed=1'}">${showRemoved?'Back to current listings':'View removed listings'}</a></p><div class="grid">${owned.length?owned.map(t=>`<article class="tool-card garage-card"><button type="button" class="card-hit garage-preview" data-listing-preview="${t.id}" aria-label="View listing details for ${esc(t.title)}"><div class="tool-image">${t.photo_url?`<img src="${esc(t.photo_url)}" alt="${esc(t.title)}">`:'<span>🛠️</span>'}<div class="badge">${t.archived_at?'Removed':toolInUse(t.id)?'In a rental':t.available?'Available':'Paused'}</div></div><div class="card-copy"><div class="meta">${esc(t.category)}</div><h3>${esc(t.title)}</h3><span class="fine">View photo and listing details →</span></div></button><div class="card-copy garage-actions"><p class="fine">You earn ${money(quote(t.rate_cents,0,1).owner)} / day after the 5% fee.</p><div class="row"><strong>${money(t.rate_cents)} / day</strong><button data-qr="${t.id}" aria-label="Tracking code for ${esc(t.title)}">QR code</button>${t.archived_at?`<button data-restore="${t.id}">Restore as paused</button>`:`<button data-toggle="${t.id}" data-value="${t.available?'0':'1'}" ${toolInUse(t.id)?'disabled':''}>${t.available?'Pause':'Activate'}</button><button data-edit="${t.id}" ${toolInUse(t.id)?'disabled':''}>Edit</button><button data-remove="${t.id}" ${toolInUse(t.id)?'disabled':''}>Remove</button>${toolInUse(t.id)?'<p class="fine">Changes unlock after the active rental is resolved.</p>':''}`}</div></div></article>`).join(''):`<div class="empty span-all"><h2>${showRemoved?'No removed listings':'Your garage is empty'}</h2><p>${showRemoved?'Removed tools will appear here.':'List a tool to start sharing.'}</p></div>`}</div></section>`;
  root.querySelectorAll('[data-listing-preview]').forEach(b=>b.onclick=()=>showListingDetails(tools.find(t=>t.id===b.dataset.listingPreview)));
  root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>nav('/edit/'+b.dataset.edit));
  root.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeListing(b.dataset.remove));
  root.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>setListingArchive(b.dataset.restore,false,b));
  document.querySelectorAll('[data-approve],[data-dispute]').forEach(b=>b.onclick=()=>rentalAction(b.dataset.approve||b.dataset.dispute,b.dataset.approve?'approve':'dispute',{}).catch(e=>toast(errorText(e))));
  document.querySelectorAll('[data-payout]').forEach(b=>b.onclick=()=>rentalAction(b.dataset.payout,'retry-payout',{}).catch(e=>toast(errorText(e))));
  document.querySelectorAll('[data-qr]').forEach(b=>b.onclick=()=>showTracking(tools.find(t=>t.id===b.dataset.qr)));
  document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const active=rentals.some(r=>r.tool_id===b.dataset.toggle&&['pending_payment','reserved','out','review','disputed'].includes(r.status));if(active){toast('This tool is currently in a rental and cannot be reactivated yet.');return}const {error}=await supabase.from('tools').update({available:b.dataset.value==='1'}).eq('id',b.dataset.toggle);if(error)toast(error.message);else await refresh()});
}

function showListingDetails(tool){
 if(!tool)return;
 const canEdit=tool.owner_id===user.id&&!tool.archived_at&&!toolInUse(tool.id);
 showModal(`<div class="dialog-head"><div><div class="eyebrow">${esc(tool.category)}</div><h2>${esc(tool.title)}</h2></div><button data-close aria-label="Close listing details">✕</button></div>${tool.photo_url?`<div id="listing-photo-viewport" class="photo-viewport"><img src="${esc(tool.photo_url)}" alt="${esc(tool.title)} — full tool photo"></div><button type="button" id="listing-photo-zoom" aria-pressed="false">Zoom in</button>`:'<p class="muted">No photo is available for this listing.</p>'}<div class="row listing-price"><strong>${money(tool.rate_cents)} / day</strong><span>Deposit: ${money(tool.deposit_cents)}</span><span class="status">${tool.archived_at?'Removed':toolInUse(tool.id)?'In a rental':tool.available?'Available':'Paused'}</span></div><h3>Description</h3><p class="listing-description">${esc(tool.description||'No description added.')}</p><h3>Listed condition</h3><p class="listing-description">${esc(tool.condition||'No condition added.')}</p>${canEdit?'<button type="button" class="primary" id="listing-preview-edit">Edit listing</button>':''}`, 'listing-dialog');
 const zoom=modal.querySelector('#listing-photo-zoom'),viewport=modal.querySelector('#listing-photo-viewport');
 if(zoom)zoom.onclick=()=>{const expanded=viewport.classList.toggle('zoomed');zoom.setAttribute('aria-pressed',String(expanded));zoom.textContent=expanded?'Fit photo':'Zoom in';requestAnimationFrame(()=>{viewport.scrollLeft=expanded?(viewport.scrollWidth-viewport.clientWidth)/2:0;viewport.scrollTop=0;});};
 const edit=modal.querySelector('#listing-preview-edit');if(edit)edit.onclick=()=>{closeModal();nav('/edit/'+tool.id);};
}

function removeListing(id){
 const t=tools.find(t=>t.id===id&&t.owner_id===user.id);if(!t)return;
 if(toolInUse(id)){toast('Finish the active rental before removing this tool.');return;}
 showModal(`<div class="dialog-head"><h2>Remove ${esc(t.title)}?</h2><button data-close aria-label="Cancel">✕</button></div><p>This removes the tool from your current garage and neighborhood search. Past rentals, reviews, and photos are preserved. You can restore it from Removed listings.</p><button id="confirm-remove" class="primary">Remove listing</button>`);
 $('#confirm-remove').onclick=e=>setListingArchive(id,true,e.currentTarget);
}
async function setListingArchive(id,removed,button){
 setBusy(button);try{if(toolInUse(id))throw new Error('Finish the active rental before changing this tool.');const {error}=await supabase.from('tools').update({archived_at:removed?new Date().toISOString():null,available:false}).eq('id',id).eq('owner_id',user.id).select('id').single();if(error)throw error;closeModal();toast(removed?'Listing removed.':'Listing restored as paused. Activate it when ready.');await refresh();}catch(err){toast(errorText(err));}finally{setBusy(button,false);}
}

function renderMessages(root){
  const hadFocus=document.activeElement?.name==='body';
  const cursor=hadFocus?document.activeElement.selectionStart:null;
  const params=new URLSearchParams(route.split('?')[1]||''),requested=params.get('peer');
  const people=new Map();tools.forEach(t=>{if(t.owner_id!==user.id)people.set(t.owner_id,t.owner?.display_name||'Neighbor')});rentals.forEach(r=>{if(r.owner_id!==user.id)people.set(r.owner_id,r.owner?.display_name||'Neighbor');if(r.renter_id!==user.id)people.set(r.renter_id,r.renter?.display_name||'Neighbor')});messages.forEach(m=>{const other=m.sender_id===user.id?m.recipient_id:m.sender_id;people.set(other,m.sender_id===other?m.sender?.display_name:m.recipient?.display_name)});
  const peerId=requested&&people.has(requested)?requested:[...people.keys()][0];
  const thread=peerId?messages.filter(m=>(m.sender_id===user.id&&m.recipient_id===peerId)||(m.sender_id===peerId&&m.recipient_id===user.id)):[];
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Secure neighbor chat</div><h1>Messages</h1></div></section><div class="chat-layout"><aside class="people">${[...people].map(([id,name])=>`<button data-peer="${id}" class="${id===peerId?'active':''}"><span class="mini-avatar">${esc(initials(name))}</span>${esc(name)}</button>`).join('')||'<p class="muted">Reserve a tool or message an owner to start a conversation.</p>'}</aside><section class="chat-panel">${peerId?`<h2 class="chat-heading">${esc(people.get(peerId))}</h2><div class="messages" role="log" aria-label="Conversation">${thread.map(m=>`<div class="bubble ${m.sender_id===user.id?'self':''}">${esc(m.body)}<small>${new Date(m.created_at).toLocaleString()}</small></div>`).join('')||'<div class="empty"><p>Say hello and coordinate pickup.</p></div>'}</div><form id="chat-form"><input name="body" aria-label="Message" maxlength="2000" value="${esc(chatDrafts.get(peerId)||'')}" placeholder="Write a message…" required><button class="primary">Send</button></form>`:'<div class="empty"><h2>No conversation selected</h2></div>'}</section></div>`;
  document.querySelectorAll('[data-peer]').forEach(b=>b.onclick=()=>nav('/messages?peer='+b.dataset.peer));
  if($('#chat-form')){$('#chat-form').elements.body.oninput=e=>chatDrafts.set(peerId,e.target.value);if(hadFocus){$('#chat-form').elements.body.focus();$('#chat-form').elements.body.setSelectionRange(cursor,cursor);}$('.messages').scrollTop=$('.messages').scrollHeight;}
  if($('#chat-form'))$('#chat-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const text=new FormData(e.target).get('body').trim();if(!text)throw new Error('Write a message first.');const {error}=await supabase.from('messages').insert({sender_id:user.id,recipient_id:peerId,body:text});if(error)throw error;chatDrafts.delete(peerId);e.target.reset();await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
}

function renderProfile(root){
  const received=reviews.filter(v=>v.subject_id===user.id),rating=received.length?received.reduce((a,v)=>a+v.rating,0)/received.length:0;
  const badges=badgesFor({listed:tools.filter(t=>t.owner_id===user.id).length,borrowed:rentals.filter(r=>r.renter_id===user.id&&r.status==='complete').length,lent:rentals.filter(r=>r.owner_id===user.id&&r.status==='complete').length,rating,reviewCount:received.length});
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Account & reputation</div><h1>${esc(profile.display_name)}</h1><p>${esc(profile.neighborhood)}, ${esc(profile.city)}, ${esc(profile.state)}</p></div><button id="signout">Sign out</button></section><div class="stats"><div class="stat"><span>Tool Share Credits</span><strong>${money(credits)}</strong></div><div class="stat"><span>Completed rentals</span><strong>${rentals.filter(r=>r.renter_id===user.id&&r.status==='complete').length}</strong></div><div class="stat"><span>Tools listed</span><strong>${tools.filter(t=>t.owner_id===user.id).length}</strong></div></div><div class="tabs profile-tabs" role="tablist" aria-label="Profile sections"><button id="account-tab" role="tab" aria-controls="profile-account">Account</button><button id="badges-tab" role="tab" aria-controls="profile-badges">Badges (${badges.filter(b=>b.earned).length})</button></div><section id="profile-badges" class="panel reputation hidden"><h2>Your neighborhood badges</h2><p>Earned badges appear beside your name on tool listings and your neighbor page. Community recognition has no monetary value.</p><p><a href="#/neighbor/${user.id}">See what neighbors see →</a></p><div class="badge-grid">${badges.map(b=>`<article class="earned-badge ${b.earned?'earned':'locked'}"><span>${b.icon}</span><h3>${b.name}</h3><b>${b.earned?'Earned':'In progress'}</b><p>${esc(b.description)}</p><small>${esc(b.progress)}</small></article>`).join('')}</div><h3>Reviews from your renters</h3>${reviewCards(received)}</section><section id="profile-account"><div class="two-col"><form id="edit-profile" class="form-card"><h2>Profile</h2><label>Display name<input name="display_name" value="${esc(profile.display_name)}" required></label><label>Neighborhood<input name="neighborhood" value="${esc(profile.neighborhood)}" required></label><div class="form-grid"><label>City<input name="city" value="${esc(profile.city)}" required></label><label>State<input name="state" value="${esc(profile.state)}" required></label></div><label>Bio<textarea name="bio" maxlength="500">${esc(profile.bio||'')}</textarea></label><button class="primary">Save profile</button></form><section class="form-card"><h2>Security</h2><p>Your account uses verified email. Authenticator-app two-factor authentication is optional during sandbox testing; once enabled, it is required for that account at sign-in.</p><div id="mfa-box"><button id="manage-mfa">Manage two-factor authentication</button><button id="change-password">Change password</button></div><h3>Tool Share Credits</h3><p>Approved deposits and owner earnings stay in the app. Spending credits creates no Stripe charge. The 5% platform fee on rental earnings still applies. Stripe processing or payout fees may apply when money enters or leaves; no extra Stripe fee is added to internal spending.</p><button id="wallet-withdraw">Withdraw credits / view transfers</button><h3>Withdrawal setup</h3><div id="payout-box">${profile.stripe_onboarding_complete?'<span class="status">Payouts enabled</span><button id="stripe-dashboard">Open Stripe Express</button>':'<p class="muted">You can list tools now. Rental earnings stay in Tool Share Credits. Connect Stripe when you want to withdraw. Stripe is currently in sandbox mode.</p><button class="primary" id="start-payouts">Set up payouts</button>'}</div><h3>Signed in as</h3><p class="muted">${esc(user.email||'')}</p><hr><h3>Delete account</h3><p class="fine">Permanently remove your profile, listings, photos and conversations. Active rentals and pending payouts must be resolved first.</p><button id="delete-account" class="danger">Permanently delete account</button></section></div></section>`;
  const badgeView=new URLSearchParams(route.split('?')[1]||'').get('tab')==='badges';
  $('#profile-account').classList.toggle('hidden',badgeView);$('#profile-badges').classList.toggle('hidden',!badgeView);
  for(const [id,selected] of [['account-tab',!badgeView],['badges-tab',badgeView]]){$('#'+id).classList.toggle('active',selected);$('#'+id).setAttribute('aria-selected',String(selected));}
  $('#account-tab').onclick=()=>nav('/profile?tab=account');$('#badges-tab').onclick=()=>nav('/profile?tab=badges');
  $('#signout').onclick=()=>supabase.auth.signOut();
  $('#delete-account').onclick=deleteAccountDialog;
  $('#wallet-withdraw').onclick=withdrawCreditsDialog;
  $('#edit-profile').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);const values=Object.fromEntries(new FormData(e.target));const {error}=await supabase.from('profiles').update(values).eq('id',user.id);setBusy(b,false);if(error)toast(error.message);else{toast('Profile updated.');await refresh()}};
  $('#manage-mfa').onclick=manageMfa;if($('#start-payouts'))$('#start-payouts').onclick=startStripeOnboarding;if($('#stripe-dashboard'))$('#stripe-dashboard').onclick=openStripeDashboard;$('#change-password').onclick=async()=>{const password=prompt('Enter a new password (12+ characters)');if(!password)return;if(password.length<12){toast('Use at least 12 characters.');return}const {error}=await supabase.auth.updateUser({password});toast(error?error.message:'Password updated.');};
}

function deleteAccountDialog(){
 showModal(`<div class="dialog-head"><h2>Permanently delete your account?</h2><button data-close aria-label="Cancel">✕</button></div><p>This cannot be undone. Your login, profile, listings, uploaded photos, conversations and authored reviews will be removed. Settled payment records and the other participant’s rental receipts remain. Stripe retains its own payment records.</p><p><b>Any unused Tool Share Credits will be lost.</b> Active rentals, disputes and pending payouts must be resolved first. If deletion is interrupted, your account stays locked until you retry.</p><form id="delete-account-form" class="stack"><label>Confirm your password<input type="password" name="password" autocomplete="current-password" required></label><label>Type DELETE to confirm<input name="confirmation" pattern="DELETE" autocomplete="off" required></label><button class="danger">Delete permanently</button></form><p id="delete-account-status" role="status"></p>`);
 $('#delete-account-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter,status=$('#delete-account-status');setBusy(b);try{const data=Object.fromEntries(new FormData(e.target));await invoke('delete-account',data);await supabase.auth.signOut({scope:'local'});session=null;user=null;authNotice='Your account has been permanently deleted.';closeModal();await refresh();}catch(err){status.textContent=errorText(err);}finally{setBusy(b,false);}};
}

function renderNeighbor(root,id){
 const neighbor=tools.find(t=>t.owner_id===id)?.owner;
 const name=id===user.id?profile.display_name:neighbor?.display_name;
 if(!name){root.innerHTML='<div class="empty"><h2>Neighbor profile unavailable</h2><a href="#/">Explore tools</a></div>';return;}
 const badges=badgesFor(metricsFor(id)).filter(b=>b.earned);
 const received=reviews.filter(v=>v.subject_id===id);
 root.innerHTML=`<a class="back" href="#/">← Explore</a><section class="page-head"><div><div class="eyebrow">Neighborhood profile</div><h1>${esc(name)}</h1><p>${esc(neighbor?.neighborhood||(id===user.id?profile?.neighborhood:'')||'Neighborhood')}</p></div></section><section class="panel"><h2>Earned badges</h2><p>Recognized for completed sharing activity. No financial benefit is attached.</p><div class="badge-grid">${badges.length?badges.map(b=>`<article class="earned-badge earned"><span>${b.icon}</span><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p></article>`).join(''):'<p class="muted">No badges earned yet.</p>'}</div><h2>Reviews</h2>${reviewCards(received)}</section><section><h2>Tools shared</h2><div class="grid">${tools.filter(t=>t.owner_id===id&&t.available).map(toolCard).join('')||'<p class="muted">No available tools right now.</p>'}</div></section>`;
 root.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>nav('/tool/'+b.dataset.tool));
}

async function pickupDialog(id){
  const r=rentals.find(x=>x.id===id),code=tracking(r.tool);showModal(`<div class="dialog-head"><h2>Confirm pickup</h2><button data-close>✕</button></div><p>Match the code on the tool before you take possession.</p><button type="button" id="scan-code">Scan QR with camera</button><video id="scan-preview" class="upload-preview hidden" playsinline muted></video><p id="scan-status" class="fine"></p><form id="pickup-form" class="stack"><label>Tracking code<input name="code" placeholder="${esc(code)}" required></label><button class="primary">Confirm pickup</button></form>`);bindScanner('#pickup-form');$('#pickup-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{await rentalAction(id,'pickup',{code:new FormData(e.target).get('code').trim().toUpperCase()});closeModal();}catch(err){toast(errorText(err));}finally{setBusy(b,false);}}
}

function bindScanner(formSelector){
 $('#scan-code').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia)throw new Error('Camera scanning is unavailable in this browser. Type the tracking code below.');
  const detector=new BarcodeDetector({formats:['qr_code']});cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  const video=$('#scan-preview');if(!modal.open){stopCamera();return;}video.srcObject=cameraStream;video.classList.remove('hidden');await video.play();$('#scan-status').textContent='Point the camera at the tool QR code.';
  const scan=async()=>{if(!cameraStream||!modal.open)return;try{const codes=await detector.detect(video);const found=codes.find(c=>/^NG[0-9A-F]{8}$/i.test(c.rawValue));if(found){$(formSelector).elements.code.value=found.rawValue.toUpperCase();$('#scan-status').textContent='Tracking code scanned. Confirm the handoff below.';stopCamera();video.classList.add('hidden');setBusy(b,false);return;}}catch{/* another frame may be readable */}setTimeout(scan,300);};scan();
 }catch(err){stopCamera();$('#scan-status').textContent=errorText(err);setBusy(b,false);}};
}

async function returnDialog(id){
  showModal(`<div class="dialog-head"><h2>Return tool</h2><button data-close>✕</button></div><button type="button" id="scan-code">Scan QR with camera</button><video id="scan-preview" class="upload-preview hidden" playsinline muted></video><p id="scan-status" class="fine"></p><form id="return-form" class="stack"><label>Return photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><label>Condition note<textarea name="note" maxlength="500" placeholder="Returned clean; normal wear only."></textarea></label><label>Tracking code (for in-person handoff)<input name="code" placeholder="Code shown on the tool"></label><label>Handoff method<select name="handoff"><option value="scan">In-person handoff</option><option value="dropoff">Agreed drop-off</option></select></label><button class="primary">Submit return</button></form>`);bindScanner('#return-form');$('#return-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target),file=f.get('photo');const ext=photoExtension(file),path=`${user.id}/${id}/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('return-photos').upload(path,file,{upsert:false});if(up.error)throw up.error;await rentalAction(id,'return',{returnPhotoPath:path,handoffMethod:f.get('handoff'),note:f.get('note'),code:f.get('code')});closeModal()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}}
}
async function reviewDialog(id){showModal(`<div class="dialog-head"><h2>Leave a review</h2><button data-close>✕</button></div><form id="review-form" class="stack"><label>Rating<select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} stars</option>`).join('')}</select></label><label>Review<textarea name="body" maxlength="1000"></textarea></label><button class="primary">Publish review</button></form>`);$('#review-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.from('reviews').insert({rental_id:id,author_id:user.id,rating:Number(f.get('rating')),body:f.get('body')});if(error)toast(error.message);else{closeModal();toast('Review published.');await refresh()}}}
async function resumeCheckout(id,b){const r=rentals.find(x=>x.id===id);setBusy(b);try{const base=location.href.split('#')[0],data=await invoke('create-checkout',{toolId:r.tool_id,days:r.days,requestId:r.checkout_request_id,successUrl:base+'#/rentals?payment=success',cancelUrl:base+'#/rentals'});if(data.checkoutUrl)location.assign(data.checkoutUrl);else await refresh();}catch(err){toast(errorText(err));}finally{setBusy(b,false);}}
async function cancelPendingRental(id){
  try{
    const data=await invoke('rental-action',{rentalId:id,action:'cancel'});
    toast('Checkout cancelled. The tool is available again.');await refresh();
  }catch(err){if(!/Cancellation is not available/.test(errorText(err)))toast(errorText(err))}
}
async function rentalAction(id,action,payload){const data=await invoke('rental-action',{rentalId:id,action,...payload});toast(data.payoutWarning||(action==='approve'?'Deposit returned and owner earnings added to credits.':'Rental updated.'));await refresh();return data;}
async function showTracking(tool){const url=await QRCode.toDataURL(tracking(tool),{width:240,margin:2});showModal(`<div class="dialog-head"><h2>Tool tracking</h2><button data-close aria-label="Close">✕</button></div><p>${esc(tool.title)}</p><img class="qr" src="${url}" alt="Tracking QR code"><p class="tracking">${esc(tracking(tool))}</p><p class="fine">Show this code at pickup and return. Your neighbor can type the code if camera scanning is unavailable.</p>`);}

async function renderMfaChallenge(){
  app.innerHTML=`<main class="onboard"><section class="onboard-card"><div class="eyebrow">Two-factor authentication</div><h1>Enter your authenticator code.</h1><form id="mfa-challenge" class="stack"><label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label><button class="primary">Verify</button></form><button id="mfa-signout" class="linkish">Sign out</button></section></main>`;
  $('#mfa-signout').onclick=()=>supabase.auth.signOut();
  $('#mfa-challenge').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const factors=await supabase.auth.mfa.listFactors();if(factors.error)throw factors.error;const factor=factors.data.totp.find(x=>x.status==='verified');if(!factor)throw new Error('No verified authenticator factor found.');const challenge=await supabase.auth.mfa.challenge({factorId:factor.id});if(challenge.error)throw challenge.error;const verify=await supabase.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code:new FormData(e.target).get('code')});if(verify.error)throw verify.error;await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
}

async function startStripeOnboarding(){
  try{const base=location.href.split('#')[0];const data=await invoke('connect-account',{action:'onboard',refreshUrl:base+'#/profile?stripe=refresh',returnUrl:base+'#/profile?stripe=return'});if(data?.complete){toast('Stripe payouts are enabled.');await refresh();return}if(data?.url)location.assign(data.url);else throw new Error('Stripe onboarding link was not returned.')}catch(err){toast(errorText(err))}
}
async function refreshStripeStatus(){
  try{const data=await invoke('connect-account',{action:'status'});if(data?.complete){toast('Stripe payout setup is complete.');route='/profile';history.replaceState(null,'',location.href.split('#')[0]+'#/profile');await refresh()}else toast('Stripe still needs more information before payouts can be enabled.')}catch(err){toast(errorText(err))}
}
async function openStripeDashboard(){
  try{const data=await invoke('connect-account',{action:'dashboard'});if(data?.url)location.assign(data.url);else throw new Error(data?.error||'Stripe dashboard link unavailable.')}catch(err){toast(errorText(err))}
}

async function getServerPendingMfa(){
  const data=await invoke('mfa-recovery',{action:'status'});
  return data?.pending||[];
}

async function cleanupPendingMfa(){
  const data=await invoke('mfa-recovery',{action:'cleanup'});
  clearPendingMfaId();
  return data?.removed||[];
}

async function verifyPendingMfa(factorId,code){
  const challenge=await supabase.auth.mfa.challenge({factorId});
  if(challenge.error)throw challenge.error;
  const verify=await supabase.auth.mfa.verify({factorId,challengeId:challenge.data.id,code:String(code||'').trim()});
  if(verify.error)throw verify.error;
  clearPendingMfaId();
  return verify.data;
}

function showPendingMfaVerification(factorId){
  setPendingMfaId(factorId);
  showModal(`<div class="dialog-head"><h2>Finish two-factor setup</h2><button data-close>✕</button></div><p>Enter the current 6-digit code from the authenticator entry you already scanned.</p><form id="resume-mfa" class="stack"><label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required autofocus></label><button class="primary">Verify 2FA code</button></form><button id="restart-mfa" class="linkish">That authenticator entry is unusable — start over</button>`);
  $('#resume-mfa').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{await verifyPendingMfa(factorId,new FormData(e.target).get('code'));closeModal();toast('Two-factor authentication enabled.');await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#restart-mfa').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{await cleanupPendingMfa();closeModal();await beginMfaEnrollment({skipPendingCheck:true})}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
}

async function beginMfaEnrollment({skipPendingCheck=false,retried=false}={}){
  try{
    if(!skipPendingCheck){
      const pending=await getServerPendingMfa();
      if(pending.length){showPendingMfaVerification(pending[0].id);return}
    }
    const enroll=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:`Neighborhood Garage ${crypto.randomUUID().slice(0,8)}`});
    if(enroll.error)throw enroll.error;
    setPendingMfaId(enroll.data.id);
    showModal(`<div class="dialog-head"><h2>Add authenticator</h2><button data-close>✕</button></div><p>Scan this code with your authenticator app.</p><img class="qr" src="${esc(enroll.data.totp.qr_code)}" alt="Authenticator QR code"><p class="fine">Manual secret: <code>${esc(enroll.data.totp.secret)}</code></p><p class="fine">After scanning, switch back here and enter the 6-digit code below. If this dialog closes, choose Manage two-factor authentication again and the app will resume this exact factor.</p><form id="enable-mfa" class="stack"><label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><button class="primary">Verify 2FA code</button></form><button id="restart-current-mfa" class="linkish">Generate a different QR code</button>`);
    $('#enable-mfa').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{await verifyPendingMfa(enroll.data.id,new FormData(e.target).get('code'));closeModal();toast('Two-factor authentication enabled.');await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
    $('#restart-current-mfa').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{await cleanupPendingMfa();closeModal();await beginMfaEnrollment({skipPendingCheck:true,retried:true})}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  }catch(err){
    const duplicate=/friendly name|already exists|factor.*exists/i.test(errorText(err));
    if(!retried&&duplicate){
      try{
        const pending=await getServerPendingMfa();
        if(pending.length){showPendingMfaVerification(pending[0].id);return}
        await cleanupPendingMfa();
        await beginMfaEnrollment({skipPendingCheck:true,retried:true});
        return;
      }catch(cleanErr){toast(errorText(cleanErr));return}
    }
    toast(errorText(err));
  }
}

function renderPasswordRecovery(){
  app.innerHTML=`<main class="onboard"><section class="onboard-card"><div class="eyebrow">Account recovery</div><h1>Choose a new password.</h1><p class="muted">Use at least 12 characters and store it in a password manager.</p><form id="recovery-form" class="stack"><label>New password<input type="password" name="password" minlength="12" autocomplete="new-password" required></label><label>Confirm password<input type="password" name="confirm" minlength="12" autocomplete="new-password" required></label><button class="primary">Update password</button></form><button id="recovery-signout" class="linkish">Cancel and sign out</button></section></main>`;
  $('#recovery-signout').onclick=()=>supabase.auth.signOut();
  $('#recovery-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target),password=String(f.get('password')||''),confirm=String(f.get('confirm')||'');if(password!==confirm)throw new Error('Passwords do not match.');const {error}=await supabase.auth.updateUser({password});if(error)throw error;passwordRecovery=false;toast('Password updated.');await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
}

async function manageMfa(){
  try{
    const factors=await supabase.auth.mfa.listFactors();if(factors.error)throw factors.error;
    const verified=(factors.data?.totp||[]).filter(x=>x.status==='verified');
    if(!verified.length){
      const pending=await getServerPendingMfa();
      if(pending.length){showPendingMfaVerification(pending[0].id);return}
      await beginMfaEnrollment();return;
    }
    showModal(`<div class="dialog-head"><h2>Two-factor authentication</h2><button data-close>✕</button></div><p>2FA is enabled for this account. You can add another authenticator or disable an existing one during sandbox testing.</p>${verified.map(f=>`<div class="row panel-lite"><span>${esc(f.friendly_name||'Authenticator')}</span><button data-unenroll="${f.id}">Disable</button></div>`).join('')}<button class="primary" id="add-mfa-factor">Add another authenticator</button>`);
    $('#add-mfa-factor').onclick=()=>{closeModal();beginMfaEnrollment({skipPendingCheck:false})};
    document.querySelectorAll('[data-unenroll]').forEach(b=>b.onclick=async()=>{try{const {error}=await supabase.auth.mfa.unenroll({factorId:b.dataset.unenroll});if(error)throw error;await supabase.auth.refreshSession();closeModal();toast('Two-factor authentication disabled for that authenticator.');await refresh()}catch(err){toast(errorText(err))}});
  }catch(err){toast(errorText(err))}
}

bootstrap();

async function withdrawCreditsDialog(){
 const accountId=user.id;
 showModal(`<div class="dialog-head"><h2>Withdraw Tool Share Credits</h2><button data-close>✕</button></div><p>Keep credits here to reuse them without a Stripe transaction. Withdrawals send funds to your connected Stripe balance; bank arrival depends on Stripe. Sandbox mode only: no real money moves.</p><p>External processing/payout fees depend on the Stripe account. The app does not deduct a separate withdrawal fee.</p><form id="withdraw-form"><label>Amount (USD)<input name="amount" type="number" min="1" step="0.01" max="${credits/100}" required></label><button class="primary">Request sandbox withdrawal</button></form><p id="withdraw-status" role="status"></p><div id="withdraw-history">Loading transfer history…</div>`);
 const status=$('#withdraw-status'),history=$('#withdraw-history');
 let requestId=crypto.randomUUID(),pendingAmount=null;
 const send=async(amount,id,button)=>{setBusy(button);try{await invoke('withdraw-credits',{amountCents:amount,requestId:id});status.textContent='Transferred to your Stripe balance. Bank settlement may take longer.';await refresh({quiet:true});}catch(e){status.textContent=errorText(e)+' If reserved, credits stay held until this same request is resolved. Do not submit a different withdrawal.';}finally{setBusy(button,false)}};
 $('#withdraw-form').onsubmit=async e=>{e.preventDefault();const amount=Math.round(Number(new FormData(e.target).get('amount'))*100);if(pendingAmount!==null&&amount!==pendingAmount){status.textContent='Retry the original amount or reopen transfer history to resolve the pending request.';return;}pendingAmount=amount;await send(amount,requestId,e.submitter)};
 const result=await supabase.from('credit_withdrawals').select('id,amount_cents,status,created_at').order('created_at',{ascending:false}).limit(20);
 if(user?.id!==accountId||!history.isConnected)return;
 if(result.error){history.textContent=errorText(result.error);return;}
 history.innerHTML=(result.data||[]).map(w=>`<div class="row"><span>${money(w.amount_cents)} · ${esc(w.status==='paid'?'Sent to Stripe':'Pending / credits reserved')}</span>${w.status==='pending'?`<button data-withdraw-retry="${esc(w.id)}" data-amount="${w.amount_cents}">Retry same transfer</button>`:''}</div>`).join('')||'<p>No withdrawals yet.</p>';
 history.querySelectorAll('[data-withdraw-retry]').forEach(b=>b.onclick=()=>send(Number(b.dataset.amount),b.dataset.withdrawRetry,b));
}
