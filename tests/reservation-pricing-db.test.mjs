import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/local-database.mjs';

test('reservation billing, confirmed fractional refunds and mutable windows',async t=>{
 const db=await database();t.after(()=>db.close());
 const {owner,renter,other}=(await db.query('select gen_random_uuid() owner,gen_random_uuid() renter,gen_random_uuid() other')).rows[0];
 await db.query('insert into auth.users(id) values($1),($2),($3)',[owner,renter,other]);
 await db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1,1000000,'test_seed','pricing_seed')",[renter]);
 const place={type:'place',label:'Community return locker',address:'123 Test Street'};
 const act=async(who,id,action,data={})=>(await db.query('select * from public.change_rental($1,$2,$3,$4::jsonb)',[who,id,action,JSON.stringify(data)])).rows[0];
 const row=async id=>(await db.query('select * from rentals where id=$1',[id])).rows[0];
 const request=async(hours=36)=>{
  const {id}=(await db.query("insert into tools(owner_id,title,category,rate_cents,deposit_cents) values($1,'Priced drill','Power tools',2400,5000) returning id",[owner])).rows[0];
  const start=new Date();start.setSeconds(0,0);const at=h=>new Date(+start+h*3600000).toISOString();
  return (await db.query('select * from request_rental($1,$2,gen_random_uuid(),$3,$4,$5,$6)',[renter,id,at(0),at(2),at(hours-2),at(hours)])).rows[0];
 };
 const accept=r=>act(owner,r.id,'accept',{pickupLocation:place,returnLocation:place});
 const pay=async r=>{await act(renter,r.id,'schedule',{pickupAt:r.pickup_window_start});return(await db.query('select * from begin_rental_checkout($1,$2)',[renter,r.id])).rows[0];};
 const returnPhoto=async r=>{const path=renter+'/'+r.id+'/return.png';await db.query("insert into storage.objects(bucket_id,name) values('return-photos',$1)",[path]);return path;};
 await t.test('full windows set the exact prepaid fee and do not depend on scheduled pickup',async()=>{
  let r=await request(26.5);assert.equal(r.rental_cents,2650);assert.equal(r.days,2);assert.equal(r.pricing_basis,'reservation_window');
  r=await accept(r);await act(renter,r.id,'schedule',{pickupAt:r.pickup_window_end});r=(await db.query('select * from begin_rental_checkout($1,$2)',[renter,r.id])).rows[0];
  assert.equal(r.rental_cents,2650);assert.equal(r.amount_due_cents,0);await act(renter,r.id,'cancel');
 });
 await t.test('unpaid windows may change duration and price after participant approval',async()=>{
  let r=await accept(await request(36));const ps=new Date(r.pickup_window_start),at=h=>new Date(+ps+h*3600000).toISOString();
  r=await act(renter,r.id,'request-window',{pickupStart:at(0),pickupEnd:at(2),returnStart:at(8),returnEnd:at(12)});
  await assert.rejects(()=>act(renter,r.id,'approve-window'),/other participant/);r=await act(owner,r.id,'approve-window');
  assert.equal(r.rental_cents,1200);assert.equal(r.days,1);assert.equal(r.amount_due_cents,6200);
  await act(renter,r.id,'cancel');
 });
 await t.test('confirmed early return refunds fractional time once, independently from inspection and deposit',async()=>{
  let r=await pay(await accept(await request(36)));r=await act(renter,r.id,'pickup',{code:r.tool_id});
  // Simulate a reservation that began 10h45m ago, with collection 8h ago.
  await db.query("update rentals set billing_starts_at=now()-interval '10 hours 45 minutes',billing_ends_at=now()+interval '25 hours 15 minutes',picked_up_at=now()-interval '8 hours' where id=$1",[r.id]);
  const photo=await returnPhoto(r);r=await act(renter,r.id,'return',{photo,handoff:'dropoff',returnedAt:'2020-01-01T00:00:00Z'});
  assert.equal(r.rental_refunded_cents,0);assert(new Date(r.billing_returned_at)>new Date('2026-01-01'));
  r=await act(owner,r.id,'hold-review',{note:'Checking the tool condition after receiving it.'});
  r=await act(owner,r.id,'received');assert.equal(r.rental_refunded_cents,2525);assert.equal(r.deposit_refunded_cents,0);assert.equal(r.rental_fee_refunded_cents,126);
  const frozen=+r.billing_returned_at;
  // Later inspection timestamps cannot restart or extend the frozen billing clock.
  await db.query("update rentals set returned_at=now()+interval '2 days' where id=$1",[r.id]);
  r=await act(owner,r.id,'approve',{confirmReceipt:true});await act(owner,r.id,'approve',{confirmReceipt:true});
  assert.equal(+r.billing_returned_at,frozen);assert.equal(r.rental_refunded_cents,2525);assert.equal(r.deposit_refunded_cents,5000);
  assert.equal((await db.query("select sum(amount_cents)::integer n from credit_ledger where rental_id=$1 and reason='early_return_rental_refund'",[r.id])).rows[0].n,2525);
  assert.equal((await db.query("select sum(amount_cents)::integer n from credit_ledger where rental_id=$1 and reason='owner_earnings'",[r.id])).rows[0].n,1021);
 });
 await t.test('paid windows cannot silently add time; partial extensions use the saved rate',async()=>{
  let r=await pay(await accept(await request(24)));const at=h=>new Date(+new Date(r.pickup_window_start)+h*3600000).toISOString();
  await assert.rejects(()=>act(renter,r.id,'request-window',{pickupStart:at(0),pickupEnd:at(2),returnStart:at(30),returnEnd:at(36)}),/paid reservation duration/);
  const e=(await db.query('select * from request_rental_extension($1,$2,gen_random_uuid(),$3,$4)',[renter,r.id,at(34),at(36)])).rows[0];assert.equal(e.rental_cents,1200);
  await db.query("update tools set rate_cents=9900 where id=$1",[r.tool_id]);await db.query("select change_rental_extension($1,$2,'approve')",[owner,e.id]);
  await db.query('select begin_extension_checkout($1,$2)',[renter,e.id]);r=await row(r.id);assert.equal(r.rental_cents,3600);assert.equal(r.deposit_cents,5000);
  await act(renter,r.id,'cancel');
 });
 await t.test('correcting a mistaken return before confirmation clears the refund clock',async()=>{
  let r=await pay(await accept(await request(24)));r=await act(renter,r.id,'pickup',{code:r.tool_id});
  r=await act(renter,r.id,'return',{photo:await returnPhoto(r),handoff:'dropoff'});
  r=await act(owner,r.id,'correct-handoff',{physicalState:'out',note:'Renter reported a return but still has the tool.'});
  assert.equal(r.billing_returned_at,null);assert.equal(r.rental_refunded_cents,0);
  r=await act(owner,r.id,'approve');assert.equal(r.rental_refunded_cents,0);assert.equal(r.billing_returned_at,null);
 });
 await t.test('late paid extensions refund only unused hours and credit actual extra use once',async()=>{
  const {card}=(await db.query('select gen_random_uuid() card')).rows[0];await db.query('insert into auth.users(id) values($1)',[card]);
  let r=await accept(await request(24));await db.query('update rentals set renter_id=$1 where id=$2',[card,r.id]);
  await act(card,r.id,'schedule',{pickupAt:r.pickup_window_start});
  r=(await db.query('select * from begin_rental_checkout($1,$2)',[card,r.id])).rows[0];
  await db.query("select finish_payment('pricing_card','checkout.session.completed','cs_pricing_card',$1,true,$2,'usd','pi_pricing_card','{}')",[r.id,r.amount_due_cents]);
  r=await act(card,r.id,'pickup',{code:r.tool_id});const at=h=>new Date(+new Date(r.pickup_window_start)+h*3600000).toISOString();
  let e=(await db.query('select * from request_rental_extension($1,$2,gen_random_uuid(),$3,$4)',[card,r.id,at(34),at(36)])).rows[0];
  await db.query("select change_rental_extension($1,$2,'approve')",[owner,e.id]);e=(await db.query('select * from begin_extension_checkout($1,$2)',[card,e.id])).rows[0];assert.equal(e.amount_due_cents,1200);
  await db.query("update rentals set billing_starts_at=now()-interval '30 hours',billing_ends_at=now()-interval '6 hours' where id=$1",[r.id]);
  await db.query("update rental_extensions set return_window_start=now()+interval '4 hours',return_window_end=now()+interval '6 hours',billing_starts_at=now()-interval '6 hours',billing_ends_at=now()+interval '6 hours' where id=$1",[e.id]);
  const photo=card+'/'+r.id+'/return.png';await db.query("insert into storage.objects(bucket_id,name) values('return-photos',$1)",[photo]);
  await act(card,r.id,'return',{photo,handoff:'dropoff'});r=await act(owner,r.id,'approve',{confirmReceipt:true});assert.equal(r.rental_refunded_cents,0);
  const calendar=+r.calendar_ends_at;
  await db.query("select finish_extension_payment('pricing_late','checkout.session.completed','cs_pricing_late',$1,true,1200,'usd','pi_pricing_late','{}')",[e.id]);
  await db.query("select finish_extension_payment('pricing_late_duplicate','checkout.session.completed','cs_pricing_late',$1,true,1200,'usd','pi_pricing_late','{}')",[e.id]);
  r=await row(r.id);assert.equal(r.rental_refunded_cents,600);assert.equal(+r.calendar_ends_at,calendar);assert.equal(r.status,'complete');
  assert.equal((await db.query("select sum(amount_cents)::integer n from credit_ledger where rental_id=$1 and reason='owner_extension_earnings'",[r.id])).rows[0].n,570);
 });
 await t.test('tiny card payments fail before placing a payment hold or debiting credits',async()=>{
  let r=await request(4);await db.query('update rentals set renter_id=$1,rental_cents=17,daily_rate_cents=100,fee_cents=1,deposit_cents=0,amount_due_cents=17 where id=$2',[other,r.id]);r=await accept(await row(r.id));
  await act(other,r.id,'schedule',{pickupAt:r.pickup_window_start});
  await assert.rejects(()=>db.query('select begin_rental_checkout($1,$2)',[other,r.id]),/at least \$0.50/);
  r=await row(r.id);assert.equal(r.status,'accepted');assert.equal(r.credits_used_cents,0);await act(other,r.id,'cancel');
 });
 await t.test('older day-rounded bookings do not receive an early-return refund after the deadline',async()=>{
  let r=await request(26);await db.query("update rentals set pricing_basis='legacy_daily',rental_cents=4800,fee_cents=240,amount_due_cents=9800 where id=$1",[r.id]);
  r=await pay(await accept(await row(r.id)));r=await act(renter,r.id,'pickup',{code:r.tool_id});
  await db.query("update rentals set billing_starts_at=now()-interval '27 hours',billing_ends_at=now()-interval '1 hour' where id=$1",[r.id]);
  await act(renter,r.id,'return',{photo:await returnPhoto(r),handoff:'dropoff'});r=await act(owner,r.id,'approve',{confirmReceipt:true});
  assert.equal(r.rental_refunded_cents,0);assert.equal(r.rental_fee_refunded_cents,0);
  assert.equal((await db.query("select sum(amount_cents)::integer n from credit_ledger where rental_id=$1 and reason='owner_earnings'",[r.id])).rows[0].n,4560);
 });
 await t.test('clients cannot mint refunds or alter billing records directly',async()=>{
  await db.exec('set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[other,JSON.stringify({sub:other,role:'authenticated',aal:'aal1'})]);
  await assert.rejects(()=>db.query("select private.refund_unused_reservation(gen_random_uuid())"),/permission denied/);
  await assert.rejects(()=>db.query('update rentals set rental_refunded_cents=999999'),/permission denied/);
  await db.exec('reset role;');
 });
});
