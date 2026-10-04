import {test} from 'node:test';import assert from 'node:assert/strict';import {database} from './helpers/local-database.mjs';
test('credit funding receipts, append-only audit and two-way reputation',async t=>{
 const db=await database();t.after(()=>db.close());const user=crypto.randomUUID(),other=crypto.randomUUID(),owner=crypto.randomUUID(),tool=crypto.randomUUID();
 await db.query('insert into auth.users(id) values($1),($2),($3)',[user,other,owner]);
 const total=async id=>Number((await db.query('select coalesce(sum(amount_cents),0) total from credit_ledger where user_id=$1',[id])).rows[0].total);
 const create=async(amount,id=crypto.randomUUID())=>(await db.query('select * from public.create_credit_topup($1,$2,$3)',[user,amount,id])).rows[0];
 const finish=async(r,event='evt_'+crypto.randomUUID(),paid=true,amount=r.amount_cents,currency='usd')=>(await db.query('select * from public.finish_credit_topup($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12)',[event,paid?'checkout.session.completed':'checkout.session.expired',r.id,'cs_'+r.id,paid,amount,currency,paid?'pi_'+r.id:null,paid?'ch_'+r.id:null,paid?'txn_'+r.id:null,paid?50:null,'{}'])).rows[0];
 const reverse=async(r,event,refunded,disputed=0,active=false)=>(await db.query('select * from public.reverse_credit_topup($1,$2,$3,$4,$5,$6,$7,$8)',[r.id,event,'charge.refunded','ch_'+r.id,refunded,disputed,active,'{}'])).rows[0];
 const auth=async(id,fn)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id,role:'authenticated',aal:'aal1'})]);try{return await fn();}finally{await db.exec('reset role');}};
 let funding;
 await t.test('pending funding adds no credits; requests enforce identity, amount and one pending checkout',async()=>{
  funding=await create(2550);assert.equal(await total(user),0);assert.equal((await create(2550,funding.id)).id,funding.id);
  await assert.rejects(()=>create(2500,funding.id),/mismatch/);await assert.rejects(()=>create(100),/pending/);
  await assert.rejects(()=>finish(funding,'bad-amount',true,2549),/amount/);await assert.rejects(()=>finish(funding,'bad-currency',true,2550,'eur'),/currency/);assert.equal(await total(user),0);
 });
 await t.test('verified receipts credit once across repeated and competing webhook events',async()=>{
  funding=await finish(funding,'paid-topup');await finish(funding,'paid-topup');await finish(funding,'paid-other-event');await finish(funding,'expired-after-paid',false);
  assert.equal(await total(user),2550);assert.equal(funding.stripe_fee_cents,50);assert.equal(funding.stripe_payment_intent_id,'pi_'+funding.id);
  assert.equal((await db.query('select count(*) n from credit_ledger where topup_id=$1',[funding.id])).rows[0].n,1);
 });
 await t.test('refunds and disputes append compensating entries; replays and won disputes reconcile without double debits',async()=>{
  await reverse(funding,'refund-500',500);await reverse(funding,'refund-500',500);assert.equal(await total(user),2050);
  await reverse(funding,'dispute-start',500,2050,true);assert.equal(await total(user),0);
  await assert.rejects(()=>db.query('select private.assert_credit_account_clear($1)',[user]),/review/);
  await reverse(funding,'dispute-won',500,0,false);assert.equal(await total(user),2050);await reverse(funding,'old-refund-event',100,0,false);assert.equal(await total(user),2050);
  await db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1,-2000,'fixture_spend','spend-before-refund')",[user]);await reverse(funding,'refund-full',2550);assert.equal(await total(user),-2000);
  await assert.rejects(()=>db.query('select private.assert_credit_account_clear($1)',[user]),/review/);
 });
 await t.test('a refund arriving before completion is applied immediately when a late verified payment arrives',async()=>{
  const r=await create(1000);await reverse(r,'early-refund',300);assert.equal(await total(user),-2000);await finish(r,'late-paid');assert.equal(await total(user),-1300);
 });
 await t.test('expired creation cannot mint credits and requires a verified deadline before release',async()=>{
  const r=await create(100);await assert.rejects(()=>db.query('select public.cancel_uncreated_credit_topup($1,$2)',[user,r.id]),/reconciled/);
  await db.query("update credit_topups set checkout_expires_at=now()-interval '1 minute' where id=$1",[r.id]);await db.query('select public.cancel_uncreated_credit_topup($1,$2)',[user,r.id]);assert.equal(await total(user),-1300);
 });
 await t.test('ledger edits and deletion are denied, even to the service; authenticated users cannot forge receipts',async()=>{
  await assert.rejects(()=>db.query('update credit_ledger set amount_cents=999999 where topup_id=$1',[funding.id]),/append-only/);
  await assert.rejects(()=>db.query('delete from credit_ledger where topup_id=$1',[funding.id]),/append-only/);
  await auth(other,async()=>{assert.equal((await db.query('select * from credit_topups')).rows.length,0);assert.equal((await db.query('select * from credit_ledger')).rows.length,0);assert.equal((await db.query('select wallet_summary() s')).rows[0].s.balance_cents,0);
   await assert.rejects(()=>db.query('select public.create_credit_topup($1,100,gen_random_uuid())',[other]),/permission denied/);await assert.rejects(()=>db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1,100000,'forged','forged')",[other]),/permission denied/);});
 });
 await t.test('balances aggregate more than 1,000 entries; stable audit pages include correct running totals',async()=>{
  await db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key) select $1,1,'many_entries','many:'||n from generate_series(1,1100)n",[other]);
  await auth(other,async()=>{const summary=(await db.query('select wallet_summary() s')).rows[0].s;assert.equal(summary.balance_cents,1100);assert.equal(summary.entry_count,1100);
   const first=(await db.query('select wallet_activity() s')).rows[0].s;assert.equal(first.entries.length,50);assert.equal(first.entries[0].running_balance_cents,1100);
   const second=(await db.query('select wallet_activity($1,$2) s',[first.anchor,first.entries.at(-1).entry_no])).rows[0].s;assert.equal(second.entries[0].running_balance_cents,1050);assert(!first.entries.some(a=>second.entries.some(b=>a.id===b.id)));
   await assert.rejects(()=>db.query('select credit_liability_summary()'),/permission denied/);});
  const liabilities=(await db.query('select credit_liability_summary() s')).rows[0].s;
  assert.equal(liabilities.available_credit_liability_cents,1100);assert.equal(liabilities.negative_wallet_receivable_cents,1300);
 });
 await t.test('both rental participants can review; the server assigns subjects and strangers cannot forge reputation',async()=>{
  await db.query("insert into tools(id,owner_id,title,category,rate_cents,deposit_cents) values($1,$2,'Reputation drill','Power tools',1000,0)",[tool,owner]);
  const r=(await db.query("select * from public.request_rental($1,$2,gen_random_uuid(),now(),now()+interval '2 hours',now()+interval '22 hours',now()+interval '24 hours')",[other,tool])).rows[0].id;await db.query("update rentals set status='complete',physical_state='returned',physical_returned_at=now() where id=$1",[r]);
  await auth(other,()=>db.query("insert into reviews(rental_id,author_id,rating,body,subject_id,subject_role) values($1,$2,1,'Honest detailed review of the owner and pickup communication.',$2,'renter')",[r,other]));
  await db.query("update rentals set physical_state='ready' where id=$1",[r]);
  await auth(owner,()=>db.query("insert into reviews(rental_id,author_id,rating,body) values($1,$2,5,'Renter returned the drill clean and arrived within the planned window.')",[r,owner]));
  await auth(user,()=>assert.rejects(()=>db.query("insert into reviews(rental_id,author_id,rating) values($1,$2,5)",[r,user]),/participants/));
  await auth(other,()=>assert.rejects(()=>db.query("insert into reviews(rental_id,author_id,rating) values($1,$2,5)",[r,other]),/unique/));
  await auth(other,async()=>{const m=(await db.query('select * from reputation_summary(array[$1::uuid,$2::uuid])',[owner,other])).rows;
   assert.equal(m.find(a=>a.user_id===owner).lent,1);assert.equal(m.find(a=>a.user_id===other).borrowed,1);assert.equal(Number(m.find(a=>a.user_id===owner).owner_rating),1);assert.equal(Number(m.find(a=>a.user_id===other).renter_rating),5);assert.equal(m.find(a=>a.user_id===other).renter_reviews_written,1);assert.equal(m.find(a=>a.user_id===owner).owner_reviews_written,1);});
 });
 await t.test('account deletion retains a pseudonymous ledger instead of erasing financial history',async()=>{
  const archived=crypto.randomUUID();await db.query('insert into auth.users(id) values($1)',[archived]);await db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1,100,'fixture','archive')",[archived]);await assert.rejects(()=>db.query('select public.begin_account_deletion($1)',[archived]),/Settle your credit balance/);await db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key) values($1,-100,'fixture_withdrawal','archive-zero')",[archived]);await db.query('select public.begin_account_deletion($1)',[archived]);await db.query('delete from auth.users where id=$1',[archived]);
  const e=(await db.query("select * from credit_ledger where idempotency_key='archive'")).rows[0];assert.equal(e.user_id,null);assert.equal(e.wallet_account,archived);assert.equal(e.amount_cents,100);
  const liabilities=(await db.query('select credit_liability_summary() s')).rows[0].s;assert.equal(liabilities.archived_wallet_net_cents,0);assert.equal(liabilities.available_credit_liability_cents,1100);
 });
});
