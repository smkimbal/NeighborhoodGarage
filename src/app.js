import { supabase } from './supabase.js';
import { money,quote,esc } from './core.js';

const $=s=>document.querySelector(s);
const app=$('#app');
const modal=$('#modal');
const toastEl=$('#toast');
let session=null,user=null,profile=null,tools=[],rentals=[],messages=[],reviews=[],credits=0,route='/',realtimeChannel=null,passwordRecovery=false;
const categories=['Power tools','Outdoor','Home & DIY','Garden','Automotive','Other'];

function toast(msg){toastEl.textContent=msg;toastEl.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>toastEl.hidden=true,4200)}
function nav(path){location.hash=path.startsWith('#')?path:'#'+path}
function closeModal(){if(modal.open)modal.close();modal.innerHTML=''}
function showModal(html){modal.innerHTML=html;modal.showModal();const c=modal.querySelector('[data-close]');if(c)c.onclick=closeModal}
function setBusy(btn,on=true){if(btn){btn.disabled=on;btn.dataset.oldText??=btn.textContent;if(on)btn.textContent='Working…';else btn.textContent=btn.dataset.oldText}}
function errorText(e){return e?.message||String(e||'Something went wrong.')}
function initials(name='Neighbor'){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function tracking(tool){return tool?.tracking_code||('NG'+String(tool?.id||'').replaceAll('-','').slice(0,8).toUpperCase())}
function authRedirectUrl(){return window.NG_CONFIG?.authRedirectUrl||location.href.split('#')[0]}

async function bootstrap(){
  const {data}=await supabase.auth.getSession();
  session=data.session;user=session?.user||null;
  supabase.auth.onAuthStateChange((event,s)=>{
    session=s;user=s?.user||null;
    if(event==='PASSWORD_RECOVERY')passwordRecovery=true;
    if(event==='SIGNED_OUT')passwordRecovery=false;
    setTimeout(()=>refresh(),0);
  });
  window.addEventListener('hashchange',()=>{route=(location.hash||'#/').slice(1)||'/';render();window.scrollTo(0,0)});
  route=(location.hash||'#/').slice(1)||'/';
  await refresh();
}

async function refresh(){
  closeModal();
  if(!user){profile=null;tools=[];rentals=[];messages=[];reviews=[];credits=0;unsubscribeRealtime();render();return;}
  try{
    const factors=await supabase.auth.mfa.listFactors();
    if(factors.error)throw factors.error;
    const verifiedFactors=(factors.data?.totp||[]).filter(x=>x.status==='verified');
    const aal=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal.error) throw aal.error;
    if(passwordRecovery){
      if(verifiedFactors.length&&aal.data?.currentLevel!=='aal2'){renderMfaChallenge();return;}
      renderPasswordRecovery();return;
    }
    if(!verifiedFactors.length){renderRequiredMfaEnrollment(factors.data?.totp||[]);return;}
    if(aal.data?.currentLevel!=='aal2'){renderMfaChallenge();return;}
    const [p,t,r,m,v,c]=await Promise.all([
      supabase.from('profiles').select('id,display_name,neighborhood,city,state,bio,avatar_path,created_at,updated_at,stripe_onboarding_complete').eq('id',user.id).single(),
      supabase.from('tools').select('*, owner:profiles!tools_owner_id_fkey(display_name)').order('created_at',{ascending:false}),
      supabase.from('rentals').select('*, tool:tools(id,title,tracking_code,photo_path,condition), renter:profiles!rentals_renter_id_fkey(display_name), owner:profiles!rentals_owner_id_fkey(display_name)').order('created_at',{ascending:false}),
      supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(display_name), recipient:profiles!messages_recipient_id_fkey(display_name)').order('created_at',{ascending:true}),
      supabase.from('reviews').select('*').order('created_at',{ascending:false}),
      supabase.from('credit_ledger').select('amount_cents')
    ]);
    for(const x of [p,t,r,m,v,c]) if(x.error) throw x.error;
    profile=p.data;tools=t.data||[];rentals=r.data||[];messages=m.data||[];reviews=v.data||[];credits=(c.data||[]).reduce((s,x)=>s+Number(x.amount_cents||0),0);
    await hydratePhotos();
    subscribeRealtime();
    render();
  }catch(e){app.innerHTML=`<main class="shell"><div class="alert error">${esc(errorText(e))}</div></main>`}
}

async function hydratePhotos(){
  await Promise.all(tools.map(async t=>{
    if(!t.photo_path){t.photo_url='';return}
    const {data}=await supabase.storage.from('tool-photos').createSignedUrl(t.photo_path,3600);
    t.photo_url=data?.signedUrl||'';
  }));
  await Promise.all(rentals.map(async r=>{
    if(!r.return_photo_path)return;
    const {data}=await supabase.storage.from('return-photos').createSignedUrl(r.return_photo_path,1800);
    r.return_photo_url=data?.signedUrl||'';
  }));
}

function subscribeRealtime(){
  if(realtimeChannel)return;
  realtimeChannel=supabase.channel('ng-messages').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async()=>{await refresh()}).subscribe();
}
function unsubscribeRealtime(){if(realtimeChannel){supabase.removeChannel(realtimeChannel);realtimeChannel=null}}

function render(){
  if(!user)return renderAuth();
  if(!profile||!profile.display_name||!profile.neighborhood||!profile.city||!profile.state)return renderOnboarding();
  const path=route.split('?')[0];
  app.innerHTML=layout();
  const content=$('#content');
  if(path==='/')renderExplore(content);
  else if(path.startsWith('/tool/'))renderTool(content,path.split('/')[2]);
  else if(path==='/lend')renderLend(content);
  else if(path==='/rentals')renderRentals(content);
  else if(path==='/garage')renderGarage(content);
  else if(path==='/messages')renderMessages(content);
  else if(path==='/profile')renderProfile(content);
  else content.innerHTML='<div class="empty"><h2>Page not found</h2><a class="button" href="#/">Back home</a></div>';
  bindGlobal();
  const params=new URLSearchParams(route.split('?')[1]||'');
  if(params.get('stripe')==='return'){setTimeout(()=>refreshStripeStatus(),0);}
  if(params.get('payment')==='cancel'&&params.get('rental')){
    const rentalId=params.get('rental'),cleanPath=route.split('?')[0];
    history.replaceState(null,'',location.href.split('#')[0]+'#'+cleanPath);
    setTimeout(()=>cancelPendingRental(rentalId),0);
  }
}

function layout(){
  return `<header class="topbar"><a class="brand" href="#/"><img src="./favicon.svg" alt=""><span>Neighborhood<br><b>Garage</b></span></a><nav>${[['/','Explore'],['/rentals','Rentals'],['/garage','My garage'],['/messages','Messages']].map(([p,l])=>`<a href="#${p}" class="${route.split('?')[0]===p?'active':''}">${l}</a>`).join('')}</nav><div class="top-actions"><button class="ghost" data-go="/lend">List a tool</button><button class="avatar" data-go="/profile" aria-label="Profile">${esc(initials(profile?.display_name))}</button></div></header><main id="content" class="shell"></main><footer>Neighborhood Garage · Share more. Buy less.</footer>`;
}
function bindGlobal(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go))}

function renderAuth(){
  app.innerHTML=`<main class="auth-page"><section class="auth-hero"><div class="eyebrow">Neighbors helping neighbors</div><h1>The tool you need may already be next door.</h1><p>Borrow useful tools nearby, lend what you own, and keep deposits moving as Tool Share Credits.</p><div class="trust-row"><span>Secure accounts</span><span>Private uploads</span><span>Protected checkout</span></div></section><section class="auth-card"><div class="brand auth-brand"><img src="./favicon.svg" alt=""><span>Neighborhood <b>Garage</b></span></div><div class="tabs"><button class="active" data-auth-tab="signin">Sign in</button><button data-auth-tab="signup">Create account</button></div><form id="signin" class="stack"><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required></label><button class="primary">Sign in</button><button type="button" class="linkish" id="reset-password">Forgot password?</button></form><form id="signup" class="stack hidden"><label>Your name<input name="displayName" maxlength="60" required></label><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Password<input type="password" name="password" autocomplete="new-password" minlength="12" required></label><p class="fine">Use at least 12 characters. You’ll verify your email before using the marketplace.</p><button class="primary">Create account</button></form></section></main>`;
  const tabs=[...document.querySelectorAll('[data-auth-tab]')];
  tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.toggle('active',x===b));$('#signin').classList.toggle('hidden',b.dataset.authTab!=='signin');$('#signup').classList.toggle('hidden',b.dataset.authTab!=='signup')});
  $('#signin').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target);const {error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)throw error}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#signup').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target);const {data,error}=await supabase.auth.signUp({email:f.get('email'),password:f.get('password'),options:{data:{display_name:f.get('displayName')},emailRedirectTo:authRedirectUrl()}});if(error)throw error;if(!data.session)toast('Check your email to confirm your account.');}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#reset-password').onclick=async()=>{const email=prompt('Enter your account email');if(!email)return;const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authRedirectUrl()});toast(error?error.message:'Password reset email sent.')};
}

function renderOnboarding(){
  app.innerHTML=`<main class="onboard"><section class="onboard-card"><div class="eyebrow">One quick step</div><h1>Build your neighborhood profile.</h1><p class="muted">Your exact address is never shown in the public catalog. Use a neighborhood or nearby area.</p><form id="profile-form" class="stack"><label>Display name<input name="display_name" maxlength="60" value="${esc(profile?.display_name||user.user_metadata?.display_name||'')}" required></label><label>Neighborhood<input name="neighborhood" maxlength="80" placeholder="e.g. Oak Grove" required></label><div class="form-grid"><label>City<input name="city" maxlength="80" required></label><label>State<input name="state" maxlength="40" required></label></div><label>Short bio<textarea name="bio" maxlength="500" placeholder="Weekend DIYer, happy to share tools and tips."></textarea></label><button class="primary">Finish setup</button></form><button id="signout-onboard" class="linkish">Sign out</button></section></main>`;
  $('#profile-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=Object.fromEntries(new FormData(e.target));const {error}=await supabase.from('profiles').update(f).eq('id',user.id);if(error)throw error;await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#signout-onboard').onclick=()=>supabase.auth.signOut();
}

function toolCard(t){
  return `<article class="tool-card"><button data-tool="${t.id}" class="card-hit"><div class="tool-image">${t.photo_url?`<img src="${esc(t.photo_url)}" alt="${esc(t.title)}">`:'<span>🛠️</span>'}<div class="badge">${t.available?'Available':'Reserved'}</div></div><div class="card-copy"><div class="meta">${esc(t.category)}</div><h3>${esc(t.title)}</h3><div class="row"><strong>${money(t.rate_cents)} <small>/ day</small></strong><span>${esc(t.owner?.display_name||'Neighbor')}</span></div></div></button></article>`;
}
function renderExplore(root){
  root.innerHTML=`<section class="hero"><div><div class="eyebrow">Your neighborhood tool shelf</div><h1>Big plans. Neighborly prices.</h1><p>Find what you need nearby instead of buying it for one project.</p></div><button class="primary" data-go="/lend">List something you own</button></section><section class="filterbar"><input id="search" placeholder="Search drills, ladders, garden tools…"><select id="category"><option value="">All categories</option>${categories.map(c=>`<option>${c}</option>`).join('')}</select></section><div id="catalog" class="grid"></div>`;
  const draw=()=>{const q=$('#search').value.toLowerCase(),cat=$('#category').value;const visible=tools.filter(t=>t.owner_id!==user.id&&(t.available)&&(!cat||t.category===cat)&&(`${t.title} ${t.description} ${t.category}`).toLowerCase().includes(q));$('#catalog').innerHTML=visible.length?visible.map(toolCard).join(''):`<div class="empty span-all"><h2>No tools found</h2><p>Try another search or be the first to list one.</p></div>`;document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>nav('/tool/'+b.dataset.tool))};
  $('#search').oninput=draw;$('#category').onchange=draw;draw();
}

function renderTool(root,id){
  const t=tools.find(x=>x.id===id);if(!t){root.innerHTML='<div class="empty"><h2>Tool not found</h2></div>';return}
  const q=quote(t.rate_cents,t.deposit_cents,1,credits);
  root.innerHTML=`<a class="back" href="#/">← Explore</a><section class="detail-grid"><div><div class="detail-image">${t.photo_url?`<img src="${esc(t.photo_url)}" alt="${esc(t.title)}">`:'<span>🛠️</span>'}</div><div class="panel"><div class="eyebrow">${esc(t.category)}</div><h1>${esc(t.title)}</h1><p>${esc(t.description)}</p><div class="owner-line"><span class="mini-avatar">${esc(initials(t.owner?.display_name))}</span><b>${esc(t.owner?.display_name||'Neighbor')}</b></div><hr><h3>Listed condition</h3><p>${esc(t.condition)}</p></div></div><aside class="panel sticky"><h2>${money(t.rate_cents)} <small>/ day</small></h2><label>Rental length<select id="days">${Array.from({length:14},(_,i)=>`<option value="${i+1}">${i+1} day${i?'s':''}</option>`).join('')}</select></label><div id="quote"></div><button id="reserve" class="primary wide" ${!t.available?'disabled':''}>${t.available?'Reserve & checkout':'Unavailable'}</button><button class="wide" id="message-owner">Message owner</button><p class="fine">Payment is handled through Stripe. Approved deposits return as Tool Share Credits.</p></aside></section>`;
  const draw=()=>{const x=quote(t.rate_cents,t.deposit_cents,Number($('#days').value),credits);$('#quote').innerHTML=`<div class="summary"><div><span>Rental</span><b>${money(x.rental)}</b></div><div><span>Deposit</span><b>${money(x.deposit)}</b></div><div><span>Credits</span><b>−${money(x.creditsUsed)}</b></div><div class="total"><span>Due now</span><b>${money(x.due)}</b></div></div>`};draw();$('#days').onchange=draw;
  $('#reserve').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{const base=location.href.split('#')[0];const {data,error}=await supabase.functions.invoke('create-checkout',{body:{toolId:t.id,days:Number($('#days').value),successUrl:base+'#/rentals?payment=success',cancelUrl:base+'#/tool/'+t.id}});if(error)throw error;if(data?.error)throw new Error(data.error);if(data.checkoutUrl)location.assign(data.checkoutUrl);else{toast('Reserved using Tool Share Credits.');nav('/rentals');await refresh()}}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  $('#message-owner').onclick=()=>nav('/messages?peer='+t.owner_id);
}

function renderLend(root){
  if(!profile.stripe_onboarding_complete){root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Payout setup required</div><h1>Connect payouts before listing.</h1><p>Neighborhood Garage uses Stripe Connect so owners can receive rental proceeds securely.</p></div></section><div class="form-card"><h2>Set up owner payouts</h2><p class="muted">Stripe handles identity verification and payout details. Neighborhood Garage never stores your bank credentials.</p><button class="primary" id="start-payouts">Continue to Stripe</button></div>`;$('#start-payouts').onclick=startStripeOnboarding;return}
  root.innerHTML=`<a class="back" href="#/garage">← My garage</a><section class="page-head"><div><div class="eyebrow">Put idle tools to work</div><h1>List a tool</h1><p>Upload one clear photo and set honest pricing and condition notes.</p></div></section><form id="lend-form" class="form-card"><div class="form-grid"><label>Tool title<input name="title" maxlength="100" required></label><label>Category<select name="category">${categories.map(c=>`<option>${c}</option>`).join('')}</select></label></div><label>Description<textarea name="description" maxlength="2000" required></textarea></label><label>Current condition<textarea name="condition" maxlength="1000" required></textarea></label><div class="form-grid"><label>Daily price ($)<input name="rate" type="number" min="1" max="1000" step="0.01" required></label><label>Deposit ($)<input name="deposit" type="number" min="0" max="10000" step="0.01" required></label></div><label>Tool photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="primary">Publish listing</button></form>`;
  $('#lend-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target),file=f.get('photo');if(!(file instanceof File)||!file.size)throw new Error('Choose a photo.');if(file.size>8*1024*1024)throw new Error('Photo must be under 8 MB.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${user.id}/${crypto.randomUUID()}.${ext}`;let up=await supabase.storage.from('tool-photos').upload(path,file,{cacheControl:'3600',upsert:false});if(up.error)throw up.error;const payload={owner_id:user.id,title:f.get('title'),category:f.get('category'),description:f.get('description'),condition:f.get('condition'),rate_cents:Math.round(Number(f.get('rate'))*100),deposit_cents:Math.round(Number(f.get('deposit'))*100),photo_path:path,available:true};const {error}=await supabase.from('tools').insert(payload);if(error){await supabase.storage.from('tool-photos').remove([path]);throw error}toast('Your tool is live.');nav('/garage');await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
}

function statusLabel(s){return ({pending_payment:'Payment pending',reserved:'Ready for pickup',out:'Borrowed',review:'Awaiting owner review',complete:'Complete',disputed:'Under review',payment_failed:'Payment incomplete',cancelled:'Cancelled'})[s]||s}
function renderRentals(root){
  const mine=rentals.filter(r=>r.renter_id===user.id);
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Borrowed by you</div><h1>My rentals</h1></div></section><div class="stack-list">${mine.length?mine.map(r=>`<article class="rental-card"><div><span class="status">${esc(statusLabel(r.status))}</span><h3>${esc(r.tool?.title||'Tool')}</h3><p>${r.days} day${r.days===1?'':'s'} · ${money(r.rental_cents)} rental · ${money(r.deposit_cents)} deposit</p><p class="tracking">Tracking: <b>${esc(tracking(r.tool))}</b></p></div><div class="actions">${r.status==='reserved'?`<button class="primary" data-pickup="${r.id}">Confirm pickup</button>`:''}${r.status==='out'?`<button class="primary" data-return="${r.id}">Return tool</button>`:''}${r.status==='complete'&&!reviews.some(v=>v.rental_id===r.id)?`<button data-review="${r.id}">Leave review</button>`:''}</div></article>`).join(''):`<div class="empty"><h2>No rentals yet</h2><p>Browse the neighborhood and reserve your first tool.</p><button class="primary" data-go="/">Explore tools</button></div>`}</div>`;
  document.querySelectorAll('[data-pickup]').forEach(b=>b.onclick=()=>pickupDialog(b.dataset.pickup));
  document.querySelectorAll('[data-return]').forEach(b=>b.onclick=()=>returnDialog(b.dataset.return));
  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewDialog(b.dataset.review));
}

function renderGarage(root){
  const owned=tools.filter(t=>t.owner_id===user.id),pending=rentals.filter(r=>r.owner_id===user.id&&r.status==='review');
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Tools you share</div><h1>My garage</h1></div><button class="primary" data-go="/lend">List a tool</button></section>${pending.length?`<section><h2>Returns to review</h2><div class="stack-list">${pending.map(r=>`<article class="return-card"><div><span class="status">Owner review</span><h3>${esc(r.tool?.title||'Tool')}</h3><p>${esc(r.assessment?.note||'Review the return photo and condition before approving.')}</p>${r.return_photo_url?`<img src="${esc(r.return_photo_url)}" alt="Return condition">`:''}</div><div class="actions"><button class="primary" data-approve="${r.id}">Approve + return ${money(r.deposit_cents)} credits</button><button data-dispute="${r.id}">Hold for review</button></div></article>`).join('')}</div></section>`:''}<section><h2>Your listings</h2><div class="grid">${owned.length?owned.map(t=>`<article class="tool-card"><div class="tool-image">${t.photo_url?`<img src="${esc(t.photo_url)}" alt="${esc(t.title)}">`:'<span>🛠️</span>'}<div class="badge">${t.available?'Available':'Reserved'}</div></div><div class="card-copy"><div class="meta">${esc(t.category)}</div><h3>${esc(t.title)}</h3><div class="row"><strong>${money(t.rate_cents)} / day</strong><button data-toggle="${t.id}" data-value="${t.available?'0':'1'}">${t.available?'Pause':'Activate'}</button></div></div></article>`).join(''):`<div class="empty span-all"><h2>Your garage is empty</h2><p>List a tool to start sharing.</p></div>`}</div></section>`;
  document.querySelectorAll('[data-approve],[data-dispute]').forEach(b=>b.onclick=()=>rentalAction(b.dataset.approve||b.dataset.dispute,b.dataset.approve?'approve':'dispute',{}));
  document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const active=rentals.some(r=>r.tool_id===b.dataset.toggle&&['pending_payment','reserved','out','review','disputed'].includes(r.status));if(active){toast('This tool is currently in a rental and cannot be reactivated yet.');return}const {error}=await supabase.from('tools').update({available:b.dataset.value==='1'}).eq('id',b.dataset.toggle);if(error)toast(error.message);else await refresh()});
}

function renderMessages(root){
  const params=new URLSearchParams(route.split('?')[1]||''),requested=params.get('peer');
  const people=new Map();tools.forEach(t=>{if(t.owner_id!==user.id)people.set(t.owner_id,t.owner?.display_name||'Neighbor')});rentals.forEach(r=>{if(r.owner_id!==user.id)people.set(r.owner_id,r.owner?.display_name||'Neighbor');if(r.renter_id!==user.id)people.set(r.renter_id,r.renter?.display_name||'Neighbor')});messages.forEach(m=>{const other=m.sender_id===user.id?m.recipient_id:m.sender_id;people.set(other,m.sender_id===other?m.sender?.display_name:m.recipient?.display_name)});
  const peerId=requested&&people.has(requested)?requested:[...people.keys()][0];
  const thread=peerId?messages.filter(m=>(m.sender_id===user.id&&m.recipient_id===peerId)||(m.sender_id===peerId&&m.recipient_id===user.id)):[];
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Secure neighbor chat</div><h1>Messages</h1></div></section><div class="chat-layout"><aside class="people">${[...people].map(([id,name])=>`<button data-peer="${id}" class="${id===peerId?'active':''}"><span class="mini-avatar">${esc(initials(name))}</span>${esc(name)}</button>`).join('')||'<p class="muted">Reserve a tool or message an owner to start a conversation.</p>'}</aside><section class="chat-panel">${peerId?`<div class="messages">${thread.map(m=>`<div class="bubble ${m.sender_id===user.id?'self':''}">${esc(m.body)}<small>${new Date(m.created_at).toLocaleString()}</small></div>`).join('')||'<div class="empty"><p>Say hello and coordinate pickup.</p></div>'}</div><form id="chat-form"><input name="body" maxlength="2000" placeholder="Write a message…" required><button class="primary">Send</button></form>`:'<div class="empty"><h2>No conversation selected</h2></div>'}</section></div>`;
  document.querySelectorAll('[data-peer]').forEach(b=>b.onclick=()=>nav('/messages?peer='+b.dataset.peer));
  if($('#chat-form'))$('#chat-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const text=new FormData(e.target).get('body').trim();const {error}=await supabase.from('messages').insert({sender_id:user.id,recipient_id:peerId,body:text});if(error)throw error;e.target.reset();await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
}

function renderProfile(root){
  root.innerHTML=`<section class="page-head"><div><div class="eyebrow">Account & reputation</div><h1>${esc(profile.display_name)}</h1><p>${esc(profile.neighborhood)}, ${esc(profile.city)}, ${esc(profile.state)}</p></div><button id="signout">Sign out</button></section><div class="stats"><div class="stat"><span>Tool Share Credits</span><strong>${money(credits)}</strong></div><div class="stat"><span>Completed rentals</span><strong>${rentals.filter(r=>r.renter_id===user.id&&r.status==='complete').length}</strong></div><div class="stat"><span>Tools listed</span><strong>${tools.filter(t=>t.owner_id===user.id).length}</strong></div></div><div class="two-col"><form id="edit-profile" class="form-card"><h2>Profile</h2><label>Display name<input name="display_name" value="${esc(profile.display_name)}" required></label><label>Neighborhood<input name="neighborhood" value="${esc(profile.neighborhood)}" required></label><div class="form-grid"><label>City<input name="city" value="${esc(profile.city)}" required></label><label>State<input name="state" value="${esc(profile.state)}" required></label></div><label>Bio<textarea name="bio" maxlength="500">${esc(profile.bio||'')}</textarea></label><button class="primary">Save profile</button></form><section class="form-card"><h2>Security</h2><p>Your account uses verified email plus required authenticator-app two-factor authentication.</p><div id="mfa-box"><button id="manage-mfa">Manage two-factor authentication</button><button id="change-password">Change password</button></div><h3>Owner payouts</h3><div id="payout-box">${profile.stripe_onboarding_complete?'<span class="status">Payouts enabled</span><button id="stripe-dashboard">Open Stripe Express</button>':'<p class="muted">Connect Stripe before listing tools or receiving rental proceeds.</p><button class="primary" id="start-payouts">Set up payouts</button>'}</div><h3>Signed in as</h3><p class="muted">${esc(user.email||'')}</p></section></div>`;
  $('#signout').onclick=()=>supabase.auth.signOut();
  $('#edit-profile').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);const values=Object.fromEntries(new FormData(e.target));const {error}=await supabase.from('profiles').update(values).eq('id',user.id);setBusy(b,false);if(error)toast(error.message);else{toast('Profile updated.');await refresh()}};
  $('#manage-mfa').onclick=manageMfa;if($('#start-payouts'))$('#start-payouts').onclick=startStripeOnboarding;if($('#stripe-dashboard'))$('#stripe-dashboard').onclick=openStripeDashboard;$('#change-password').onclick=async()=>{const password=prompt('Enter a new password (12+ characters)');if(!password)return;if(password.length<12){toast('Use at least 12 characters.');return}const {error}=await supabase.auth.updateUser({password});toast(error?error.message:'Password updated.');};
}

async function pickupDialog(id){
  const r=rentals.find(x=>x.id===id),code=tracking(r.tool);showModal(`<div class="dialog-head"><h2>Confirm pickup</h2><button data-close>✕</button></div><p>Match the code on the tool before you take possession.</p><form id="pickup-form" class="stack"><label>Tracking code<input name="code" placeholder="${esc(code)}" required></label><button class="primary">Confirm pickup</button></form>`);$('#pickup-form').onsubmit=async e=>{e.preventDefault();await rentalAction(id,'pickup',{code:new FormData(e.target).get('code').trim().toUpperCase()});closeModal()}
}
async function returnDialog(id){
  showModal(`<div class="dialog-head"><h2>Return tool</h2><button data-close>✕</button></div><form id="return-form" class="stack"><label>Return photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><label>Condition note<textarea name="note" maxlength="500" placeholder="Returned clean; normal wear only."></textarea></label><label>Handoff method<select name="handoff"><option value="scan">In-person handoff</option><option value="dropoff">Agreed drop-off</option></select></label><button class="primary">Submit return</button></form>`);$('#return-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const f=new FormData(e.target),file=f.get('photo');const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${user.id}/${id}/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('return-photos').upload(path,file,{upsert:false});if(up.error)throw up.error;await rentalAction(id,'return',{returnPhotoPath:path,handoffMethod:f.get('handoff'),assessment:{note:f.get('note')}});closeModal()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}}
}
async function reviewDialog(id){showModal(`<div class="dialog-head"><h2>Leave a review</h2><button data-close>✕</button></div><form id="review-form" class="stack"><label>Rating<select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} stars</option>`).join('')}</select></label><label>Review<textarea name="body" maxlength="1000"></textarea></label><button class="primary">Publish review</button></form>`);$('#review-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.from('reviews').insert({rental_id:id,author_id:user.id,rating:Number(f.get('rating')),body:f.get('body')});if(error)toast(error.message);else{closeModal();toast('Review published.');await refresh()}}}
async function cancelPendingRental(id){
  try{
    const {data,error}=await supabase.functions.invoke('rental-action',{body:{rentalId:id,action:'cancel'}});
    if(error)throw error;if(data?.error)throw new Error(data.error);
    toast('Checkout cancelled. The tool is available again.');await refresh();
  }catch(err){if(!/Cancellation is not available/.test(errorText(err)))toast(errorText(err))}
}
async function rentalAction(id,action,payload){try{const {data,error}=await supabase.functions.invoke('rental-action',{body:{rentalId:id,action,...payload}});if(error)throw error;if(data?.error)throw new Error(data.error);toast(action==='approve'?'Deposit credits returned.':'Rental updated.');await refresh()}catch(err){toast(errorText(err))}}

async function renderMfaChallenge(){
  app.innerHTML=`<main class="onboard"><section class="onboard-card"><div class="eyebrow">Two-factor authentication</div><h1>Enter your authenticator code.</h1><form id="mfa-challenge" class="stack"><label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label><button class="primary">Verify</button></form><button id="mfa-signout" class="linkish">Sign out</button></section></main>`;
  $('#mfa-signout').onclick=()=>supabase.auth.signOut();
  $('#mfa-challenge').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const factors=await supabase.auth.mfa.listFactors();if(factors.error)throw factors.error;const factor=factors.data.totp.find(x=>x.status==='verified');if(!factor)throw new Error('No verified authenticator factor found.');const challenge=await supabase.auth.mfa.challenge({factorId:factor.id});if(challenge.error)throw challenge.error;const verify=await supabase.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code:new FormData(e.target).get('code')});if(verify.error)throw verify.error;await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
}

async function startStripeOnboarding(){
  try{const base=location.href.split('#')[0];const {data,error}=await supabase.functions.invoke('connect-account',{body:{action:'onboard',refreshUrl:base+'#/profile?stripe=refresh',returnUrl:base+'#/profile?stripe=return'}});if(error)throw error;if(data?.error)throw new Error(data.error);if(data?.complete){toast('Stripe payouts are enabled.');await refresh();return}if(data?.url)location.assign(data.url);else throw new Error('Stripe onboarding link was not returned.')}catch(err){toast(errorText(err))}
}
async function refreshStripeStatus(){
  try{const {data,error}=await supabase.functions.invoke('connect-account',{body:{action:'status'}});if(error)throw error;if(data?.complete){toast('Stripe payout setup is complete.');history.replaceState(null,'',location.href.split('?')[0]+'#/profile');await refresh()}else toast('Stripe still needs more information before payouts can be enabled.')}catch(err){toast(errorText(err))}
}
async function openStripeDashboard(){
  try{const {data,error}=await supabase.functions.invoke('connect-account',{body:{action:'dashboard'}});if(error)throw error;if(data?.url)location.assign(data.url);else throw new Error(data?.error||'Stripe dashboard link unavailable.')}catch(err){toast(errorText(err))}
}

async function beginMfaEnrollment({required=false}={}){
  try{
    const enroll=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:required?'Neighborhood Garage':'Backup authenticator'});
    if(enroll.error)throw enroll.error;
    const body=`<p>Scan this code with your authenticator app.</p><img class="qr" src="${esc(enroll.data.totp.qr_code)}" alt="Authenticator QR code"><p class="fine">Manual secret: <code>${esc(enroll.data.totp.secret)}</code></p><form id="enable-mfa" class="stack"><label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label><button class="primary">Enable 2FA</button></form>`;
    if(required){
      const box=$('#required-mfa-box');if(!box)return;box.innerHTML=body;
    }else{
      showModal(`<div class="dialog-head"><h2>Add authenticator</h2><button data-close>✕</button></div>${body}`);
    }
    $('#enable-mfa').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const challenge=await supabase.auth.mfa.challenge({factorId:enroll.data.id});if(challenge.error)throw challenge.error;const verify=await supabase.auth.mfa.verify({factorId:enroll.data.id,challengeId:challenge.data.id,code:new FormData(e.target).get('code')});if(verify.error)throw verify.error;closeModal();toast('Two-factor authentication enabled.');await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
  }catch(err){toast(errorText(err))}
}

function renderRequiredMfaEnrollment(totpFactors=[]){
  const pending=totpFactors.find(x=>x.status==='unverified');
  if(pending){
    app.innerHTML=`<main class="onboard"><section class="onboard-card"><div class="eyebrow">Finish securing your account</div><h1>Continue two-factor setup.</h1><p class="muted">An authenticator was already started for this account. If you scanned the QR code before switching apps, enter the current 6-digit code below.</p><form id="resume-mfa" class="stack"><label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><button class="primary">Verify and continue</button></form><button id="restart-mfa" class="linkish">I need a new QR code</button><button id="mfa-enroll-signout" class="linkish">Sign out</button></section></main>`;
    $('#resume-mfa').onsubmit=async e=>{e.preventDefault();const b=e.submitter;setBusy(b);try{const challenge=await supabase.auth.mfa.challenge({factorId:pending.id});if(challenge.error)throw challenge.error;const verify=await supabase.auth.mfa.verify({factorId:pending.id,challengeId:challenge.data.id,code:String(new FormData(e.target).get('code')||'').trim()});if(verify.error)throw verify.error;toast('Two-factor authentication enabled.');await refresh()}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
    $('#restart-mfa').onclick=async e=>{const b=e.currentTarget;setBusy(b);try{const {error}=await supabase.auth.mfa.unenroll({factorId:pending.id});if(error)throw error;await beginMfaEnrollment({required:true})}catch(err){toast(errorText(err))}finally{setBusy(b,false)}};
    $('#mfa-enroll-signout').onclick=()=>supabase.auth.signOut();
    return;
  }
  app.innerHTML=`<main class="onboard"><section class="onboard-card"><div class="eyebrow">Secure your account</div><h1>Add two-factor authentication.</h1><p class="muted">Neighborhood Garage requires an authenticator app before profile setup, listings, messages, or rentals can be accessed.</p><div id="required-mfa-box"><button class="primary" id="start-required-mfa">Set up authenticator</button></div><button id="mfa-enroll-signout" class="linkish">Sign out</button></section></main>`;
  $('#start-required-mfa').onclick=()=>beginMfaEnrollment({required:true});
  $('#mfa-enroll-signout').onclick=()=>supabase.auth.signOut();
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
    if(!verified.length){await beginMfaEnrollment();return}
    showModal(`<div class="dialog-head"><h2>Two-factor authentication</h2><button data-close>✕</button></div><p>At least one authenticator is required for this account.</p>${verified.map(f=>`<div class="row panel-lite"><span>${esc(f.friendly_name||'Authenticator')}</span>${verified.length>1?`<button data-unenroll="${f.id}">Remove</button>`:''}</div>`).join('')}<button class="primary" id="add-mfa-factor">Add backup authenticator</button><p class="fine">Add a backup authenticator before replacing your only factor.</p>`);
    $('#add-mfa-factor').onclick=()=>{closeModal();beginMfaEnrollment()};
    document.querySelectorAll('[data-unenroll]').forEach(b=>b.onclick=async()=>{const {error}=await supabase.auth.mfa.unenroll({factorId:b.dataset.unenroll});if(error)toast(error.message);else{closeModal();toast('Authenticator removed.');await refresh()}});
  }catch(err){toast(errorText(err))}
}

bootstrap();
