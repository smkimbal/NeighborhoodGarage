import {test} from 'node:test';import assert from 'node:assert/strict';import{database}from'./helpers/local-database.mjs';
test('Postgres reservations, payments, handoffs, reviews and extensions',async t=>{
 const db=await database();t.after(()=>db.close());
 const {owner,renter,other,card,tool}=(await db.query('select gen_random_uuid() owner,gen_random_uuid() renter,gen_random_uuid() other,gen_random_uuid() card,gen_random_uuid() tool')).rows[0];
 await db.query('insert into auth.users(id) values($1),($2),($3),($4)',[owner,renter,other,card]);
 await db.query("insert into public.tools(id,owner_id,title,category,rate_cents,deposit_cents) values($1,$2,'Workflow drill','Power tools',1000,5000)",[tool,owner]);
 await db.query("insert into public.credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1::uuid,20000,'test_seed',$1::text),($2::uuid,20000,'test_seed',$2::text),($3::uuid,5975,'test_seed',$3::text)",[renter,other,card]);
 const row=async id=>(await db.query('select * from public.rentals where id=$1',[id])).rows[0];
 const act=async(who,id,name,data={})=>(await db.query('select * from public.change_rental($1,$2,$3,$4::jsonb)',[who,id,name,JSON.stringify(data)])).rows[0];
 const start=new Date();start.setSeconds(0,0);const iso=h=>new Date(+start+h*3600000).toISOString();
 const request=async(who,pickup=0,days=1,key=crypto.randomUUID())=>(await db.query('select * from public.request_rental($1,$2,$3,$4,$5,$6,$7)',[who,tool,key,iso(pickup),iso(pickup+2),iso(pickup+days*24-2),iso(pickup+days*24)])).rows[0];
 const place={type:'place',label:'Community pickup locker',address:'123 Test Street'};
 const accept=r=>act(owner,r.id,'accept',{pickupLocation:place,returnLocation:place});
 const pay=async r=>{await act(r.renter_id,r.id,'schedule',{pickupAt:r.pickup_window_start});return(await db.query('select * from public.begin_rental_checkout($1,$2)',[r.renter_id,r.id])).rows[0];};
 const balance=async who=>(await db.query('select coalesce(sum(amount_cents),0)::integer b from public.credit_ledger where user_id=$1',[who])).rows[0].b;
 const finish=async(rental,event,paid=true,amount=rental.amount_due_cents,session='cs_'+rental.id)=>db.query("select public.finish_payment($1,'checkout.session.completed',$2,$3,$4,$5,'usd',$6,'{}')",[event,session,rental.id,paid,amount,'pi_'+rental.id]);
 let r,key=crypto.randomUUID();
 await t.test('requests are idempotent and charge nothing before owner approval',async()=>{
  r=await request(renter,0,1,key);assert.equal(r.status,'requested');assert.equal(await balance(renter),20000);assert.equal((await request(renter,0,1,key)).id,r.id);
  await assert.rejects(()=>request(other,0,1,key),/mismatch/);await assert.rejects(()=>db.query('select public.begin_rental_checkout($1,$2)',[renter,r.id]),/owner must approve/);
  await assert.rejects(()=>act(renter,r.id,'accept',{pickupLocation:place,returnLocation:place}),/unavailable/);r=await accept(r);assert.equal(r.status,'accepted');
 });
 await t.test('future confirmed reservations coexist; approval serializes conflicting requests',async()=>{
  await assert.rejects(()=>db.query('select public.begin_rental_checkout($1,$2)',[renter,r.id]),/pickup plan/);r=await pay(r);assert.equal(r.status,'reserved');assert.equal(r.amount_due_cents,0);
  await assert.rejects(()=>request(other),/overlap/);const future=await pay(await accept(await request(other,48)));assert.equal(future.status,'reserved');await act(other,future.id,'cancel');assert.equal(await balance(other),20000);
  const a=await request(other,96),b=await request(card,96);await accept(a);await assert.rejects(()=>accept(b),/overlap/);await act(other,a.id,'cancel');await act(card,b.id,'cancel');
 });
 await t.test('QR confirmation validates renter, item and possession; rented tools remain discoverable',async()=>{
  await assert.rejects(()=>act(owner,r.id,'pickup',{code:tool}),/unavailable/);await assert.rejects(()=>act(renter,r.id,'pickup',{code:crypto.randomUUID()}),/does not match/);
  r=await act(renter,r.id,'pickup',{code:tool});assert.equal(r.status,'out');assert(r.picked_up_at);const a=(await db.query('select * from public.rental_availability(array[$1::uuid])',[tool])).rows[0];assert.equal(a.rented,true);assert(a.expected_return);assert.equal((await db.query('select available from tools where id=$1',[tool])).rows[0].available,true);
 });
 await t.test('approved credit extensions reuse the deposit and never double-extend on retries',async()=>{
  const e=(await db.query('select * from public.request_rental_extension($1,$2,gen_random_uuid(),$3,$4)',[renter,r.id,iso(46),iso(48)])).rows[0];assert.equal(e.extra_days,1);
  await assert.rejects(()=>db.query('select public.begin_extension_checkout($1,$2)',[renter,e.id]),/owner must approve/);await db.query("select public.change_rental_extension($1,$2,'approve')",[owner,e.id]);
  const paid=(await db.query('select * from public.begin_extension_checkout($1,$2)',[renter,e.id])).rows[0];assert.equal(paid.status,'paid');assert.equal(paid.amount_due_cents,0);await db.query('select public.begin_extension_checkout($1,$2)',[renter,e.id]);r=await row(r.id);assert.equal(r.days,2);assert.equal(r.rental_cents,2000);assert.equal(r.deposit_cents,5000);
 });
 await t.test('held returns stay actionable; approvals refund and credit earnings exactly once',async()=>{
  const photo=renter+'/'+r.id+'/return.png';await db.query("insert into storage.objects(bucket_id,name) values('return-photos',$1)",[photo]);await assert.rejects(()=>act(renter,r.id,'return',{photo:owner+'/'+r.id+'/foreign.png',handoff:'dropoff'}),/Upload/);
  r=await act(renter,r.id,'return',{photo,handoff:'scan',code:tool,assessment:{source:'manual'}});r=await act(owner,r.id,'hold-review',{note:'Inspect the handle this afternoon.'});assert.equal(r.status,'review');await assert.rejects(()=>act(owner,r.id,'hold-review',{note:'Extend the inspection a second time.'}),/already extended/);
  r=await act(owner,r.id,'approve',{confirmReceipt:true});await act(owner,r.id,'approve',{confirmReceipt:true});assert.equal(r.status,'complete');assert.equal(r.deposit_refunded_cents,5000);
  assert.equal((await db.query("select sum(amount_cents)::integer total from credit_ledger where rental_id=$1 and reason='deposit_refund'",[r.id])).rows[0].total,5000);assert.equal((await db.query("select sum(amount_cents)::integer total from credit_ledger where rental_id=$1 and reason='owner_earnings'",[r.id])).rows[0].total,r.owner_payout_cents-r.rental_refunded_cents+r.rental_fee_refunded_cents);
 });
 await t.test('evidence-backed deductions return the undisputed deposit and remain contestable',async()=>{
  let loan=await pay(await accept(await request(renter)));await act(renter,loan.id,'pickup',{code:tool});const photo=renter+'/'+loan.id+'/return.png',inspection=owner+'/'+loan.id+'/inspection.png';await db.query("insert into storage.objects(bucket_id,name) values('return-photos',$1),('return-photos',$2)",[photo,inspection]);await act(renter,loan.id,'return',{photo,handoff:'dropoff'});
  await assert.rejects(()=>act(owner,loan.id,'claim-damage',{amountCents:500,note:'Claim with no evidence.'}),/inspection photo/);
  loan=await act(owner,loan.id,'claim-damage',{amountCents:500,note:'Broken handle; itemized repair estimate is five dollars.',photo:inspection});assert.equal(loan.status,'disputed');assert.equal(loan.deposit_refunded_cents,4500);
  await assert.rejects(()=>act(owner,loan.id,'claim-damage',{amountCents:1000,note:'An increased estimate, which is not permitted.',photo:inspection}),/only be reduced/);loan=await act(renter,loan.id,'contest-claim',{note:'This mark was already in the original condition.'});assert(loan.dispute_opened_at);
  loan=await act(owner,loan.id,'approve',{confirmReceipt:true});assert.equal(loan.deposit_refunded_cents,5000);assert.equal(loan.status,'complete');
 });
 await t.test('owners can audit physical corrections without reopening settled deposits',async()=>{
  let loan=await pay(await accept(await request(renter)));loan=await act(owner,loan.id,'correct-handoff',{physicalState:'out',note:'Neighbor collected but forgot to confirm pickup.'});assert.equal(loan.status,'out');loan=await act(owner,loan.id,'correct-handoff',{physicalState:'returned',note:'Item is back in the designated pickup locker.'});assert.equal(loan.status,'review');await act(owner,loan.id,'approve',{confirmReceipt:true});
  const before=await balance(renter);loan=await act(owner,loan.id,'correct-handoff',{physicalState:'out',note:'The renter still has the item after the deposit settled.'});assert.equal(loan.status,'complete');assert.equal(loan.physical_state,'out');assert.equal(await balance(renter),before);const photo=renter+'/'+loan.id+'/late-return.png';await db.query("insert into storage.objects(bucket_id,name) values('return-photos',$1)",[photo]);loan=await act(renter,loan.id,'return',{photo,handoff:'scan',code:tool});assert.equal(loan.status,'complete');await act(owner,loan.id,'received');await act(owner,loan.id,'mark-ready');assert.equal((await db.query("select count(*)::integer n from rental_events where rental_id=$1 and action='correct-handoff'",[loan.id])).rows[0].n,3);
 });
 await t.test('partial credits respect the Stripe minimum; paid initial and extension events are idempotent',async()=>{
  let loan=await pay(await accept(await request(card)));assert.equal(loan.amount_due_cents,50);assert.equal(loan.credits_used_cents,5950);assert.equal(await balance(card),25);
  await assert.rejects(()=>finish(loan,'bad_amount',true,49),/amount/);await finish(loan,'paid_initial');await finish(loan,'paid_initial');loan=await row(loan.id);assert.equal(loan.status,'reserved');
  await act(card,loan.id,'pickup',{code:tool});const e=(await db.query('select * from public.request_rental_extension($1,$2,gen_random_uuid(),$3,$4)',[card,loan.id,iso(46),iso(48)])).rows[0];await db.query("select public.change_rental_extension($1,$2,'approve')",[owner,e.id]);const pending=(await db.query('select * from public.begin_extension_checkout($1,$2)',[card,e.id])).rows[0];assert.equal(pending.amount_due_cents,975);assert.equal(pending.credits_used_cents,25);
  await db.query("select public.finish_extension_payment('paid_ext','checkout.session.completed','cs_ext',$1,true,975,'usd','pi_ext','{}')",[e.id]);await db.query("select public.finish_extension_payment('paid_ext','checkout.session.completed','cs_ext',$1,true,975,'usd','pi_ext','{}')",[e.id]);loan=await row(loan.id);assert.equal(loan.days,2);assert.equal(loan.deposit_cents,5000);assert.equal(loan.rental_cents,2000);
  await act(owner,loan.id,'correct-handoff',{physicalState:'returned',note:'The owner has received the tool at the agreed place.'});loan=await act(owner,loan.id,'approve',{confirmReceipt:true});assert.equal(await balance(card),5000+loan.rental_refunded_cents);
 });
 await t.test('abandoned session creation releases credits only after its deadline',async()=>{
  await db.query("insert into public.credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1,-5000,'test_reset','reset')",[card]);let loan=await pay(await accept(await request(card)));assert.equal(loan.status,'pending_payment');await assert.rejects(()=>db.query('select public.release_uncreated_checkout($1,$2)',[card,loan.id]),/existing payment/);await db.query("update rentals set checkout_expires_at=now()-interval '1 minute' where id=$1",[loan.id]);await db.query('select public.release_uncreated_checkout($1,$2)',[card,loan.id]);assert.equal((await row(loan.id)).status,'payment_failed');
 });
 await t.test('background review deadlines refund deposits; RLS and direct financial writes are enforced',async()=>{
  let loan=await pay(await accept(await request(renter)));await act(owner,loan.id,'correct-handoff',{physicalState:'out',note:'Owner confirms actual pickup this morning.'});await act(owner,loan.id,'correct-handoff',{physicalState:'returned',note:'Owner confirms physical receipt in the locker.'});await db.query("update rentals set review_deadline=now()-interval '1 minute' where id=$1",[loan.id]);await db.query('select public.process_rental_deadlines()');loan=await row(loan.id);assert.equal(loan.status,'complete');assert.equal(loan.deposit_refunded_cents,5000);
  await db.exec('set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[other,JSON.stringify({sub:other,role:'authenticated',aal:'aal1'})]);assert.equal((await db.query('select id from rentals where id=$1',[loan.id])).rows.length,0);assert.equal((await db.query('select id from rental_events where rental_id=$1',[loan.id])).rows.length,0);
  await assert.rejects(()=>db.query('select public.begin_rental_checkout($1,$2)',[renter,loan.id]),/permission denied/);await assert.rejects(()=>db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1,999999,'forged','forged')",[other]),/permission denied/);await db.exec('reset role;');
  assert.equal(loan.physical_state,'returned');assert.equal(loan.item_ready,false);await act(owner,loan.id,'mark-ready');
 });
 await t.test('pending extension never blocks deposit deadlines; late payment settles once without reopening possession',async()=>{
  let loan=await pay(await accept(await request(card)));await finish(loan,'late_initial');loan=await act(card,loan.id,'pickup',{code:tool});
  const e=(await db.query('select * from public.request_rental_extension($1,$2,gen_random_uuid(),$3,$4)',[card,loan.id,iso(46),iso(48)])).rows[0];await db.query("select public.change_rental_extension($1,$2,'approve')",[owner,e.id]);await db.query('select public.begin_extension_checkout($1,$2)',[card,e.id]);
  const photo=card+'/'+loan.id+'/pending-extension-return.png';await db.query("insert into storage.objects(bucket_id,name) values('return-photos',$1)",[photo]);await act(card,loan.id,'return',{photo,handoff:'dropoff'});await db.query("update rentals set review_deadline=now()-interval '1 minute' where id=$1",[loan.id]);await db.query('select public.process_rental_deadlines()');
  loan=await row(loan.id);assert.equal(loan.status,'review');assert.equal(loan.deposit_refunded_cents,0);assert(loan.receipt_case_id);await act(owner,loan.id,'received');await db.query('select public.process_rental_deadlines()');loan=await row(loan.id);assert.equal(loan.status,'complete');assert.equal(loan.deposit_refunded_cents,5000);assert.equal(loan.physical_state,'returned');assert(loan.physical_returned_at);assert.equal(loan.item_ready,false);assert.equal((await db.query('select * from public.rental_availability(array[$1::uuid])',[tool])).rows[0].inspection_pending,true);
  const next=await pay(await accept(await request(other)));await assert.rejects(()=>act(other,next.id,'pickup',{code:tool}),/physical handoff/);await act(other,next.id,'cancel');
  const ownerBefore=await balance(owner),calendar=loan.calendar_ends_at,refundBefore=loan.rental_refunded_cents;
  await db.query("select public.finish_extension_payment('late_ext','checkout.session.completed','cs_late',$1,true,1000,'usd','pi_late','{}')",[e.id]);await db.query("select public.finish_extension_payment('late_ext_duplicate','checkout.session.completed','cs_late',$1,true,1000,'usd','pi_late','{}')",[e.id]);
  loan=await row(loan.id);assert.equal(await balance(owner),ownerBefore);assert.equal(loan.rental_refunded_cents-refundBefore,1000);assert.equal(loan.status,'complete');assert.equal(+loan.calendar_ends_at,+calendar);assert.equal(loan.physical_state,'returned');assert.equal(loan.days,2);await act(owner,loan.id,'received');await act(owner,loan.id,'mark-ready');
  await db.exec('set role authenticated;');await assert.rejects(()=>db.query("select public.rental_maintenance_authorized(repeat('a',64))"),/permission denied/);await assert.rejects(()=>db.query('select public.stripe_webhook_signing_secret()'),/permission denied/);await db.exec('reset role;');
 });
});
