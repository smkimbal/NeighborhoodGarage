import {test} from 'node:test';import assert from 'node:assert/strict';import {database} from './helpers/local-database.mjs';
test('production hardening enforces receipt, ledger, access and settlement invariants',async t=>{
 const db=await database();t.after(()=>db.close());const renter=crypto.randomUUID(),owner=crypto.randomUUID(),operator=crypto.randomUUID(),stranger=crypto.randomUUID(),tool=crypto.randomUUID();
 await db.query('insert into auth.users(id) values($1),($2),($3),($4)',[renter,owner,operator,stranger]);
 await db.query("insert into private.operator_accounts(user_id) values($1)",[operator]);
 await db.query("insert into tools(id,owner_id,title,category,rate_cents,deposit_cents) values($1,$2,'Hardening drill','Power tools',1000,2000)",[tool,owner]);
 const rental=(await db.query("select * from request_rental($1,$2,gen_random_uuid(),now(),now()+interval '1 hour',now()+interval '23 hours',now()+interval '24 hours')",[renter,tool])).rows[0];
 const ledger=async(uid,amount,key,age=0)=>db.query("insert into credit_ledger(user_id,amount_cents,reason,idempotency_key,created_at) values($1,$2,'fixture',$3,now()-make_interval(days=>$4))",[uid,amount,key,age]);
 const balance=async uid=>Number((await db.query('select coalesce(sum(amount_cents),0) n from credit_ledger where wallet_account=$1',[uid])).rows[0].n);
 const act=async(action,data={})=>(await db.query('select * from change_rental($1,$2,$3,$4)',[owner,rental.id,action,JSON.stringify(data)])).rows[0];
 await t.test('unconfirmed physical return creates an actionable case without any deposit refund',async()=>{
  await db.query("update rentals set status='review',physical_state='return_reported',billing_starts_at=now()-interval '12 hours',billing_ends_at=now()+interval '12 hours',returned_at=now(),review_deadline=now()-interval '1 minute' where id=$1",[rental.id]);
  await db.query('select process_rental_deadlines()');const r=(await db.query('select * from rentals where id=$1',[rental.id])).rows[0];assert.equal(r.status,'review');assert.equal(r.deposit_refunded_cents,0);assert(r.receipt_case_id);
  assert.equal((await db.query("select count(*) n from rental_events where rental_id=$1 and action='deadline_refund'",[rental.id])).rows[0].n,0);
  await db.query('select process_rental_deadlines()');assert.equal((await db.query("select count(*) n from support_cases where rental_id=$1 and kind='not_received'",[rental.id])).rows[0].n,1);
  const settled=await act('approve',{confirmReceipt:true});assert.equal(settled.status,'complete');assert.equal(settled.deposit_refunded_cents,2000);assert(settled.physical_returned_at);
  assert.equal((await db.query('select status from support_cases where id=$1',[r.receipt_case_id])).rows[0].status,'resolved');
 });
 await t.test('rental refund/dispute compensation is bounded, replay safe, and restoration never repeats',async()=>{
  await ledger(renter,3000,'old-renter-funding',10);
  await db.query("insert into payment_receipts(charge_id,payment_intent_id,session_id,wallet_account,rental_id,principal_cents,processing_fee_cents,available_at) values('ch_hardening','pi_hardening','cs_hardening',$1,$2,3000,121,now())",[renter,rental.id]);
  const before=await balance(renter);const reverse=(event,time,refund,dispute,active)=>db.query("select reconcile_rental_charge('ch_hardening',$1,$2,$3,$4,$5)",[event,time,refund,dispute,active]);
  await reverse('refund-one',100,500,0,false);await reverse('refund-one',100,500,0,false);assert.equal(await balance(renter),before-500);
  await reverse('dispute-open',101,500,2621,true);assert.equal(await balance(renter),before-3000);await assert.rejects(()=>db.query('select private.assert_credit_account_clear($1)',[owner]),/review/);
  await reverse('won',102,500,0,false);assert.equal(await balance(renter),before-500);await reverse('older-dispute',101,500,2621,true);assert.equal(await balance(renter),before-500);
  await assert.rejects(()=>reverse('forged-total',103,5000,0,false),/Invalid reversal/);
  const c=(await db.query("select * from support_cases where dedupe_key='charge:ch_hardening'")).rows[0];assert(c.financial_hold);const request=crypto.randomUUID();
  await db.query("select operate_case($1,$2,'allocate-payment-loss','Owner agreed to absorb this verified payment loss.',100,$3)",[operator,c.id,request]);
  const ownerAfter=await balance(owner);await db.query("select operate_case($1,$2,'allocate-payment-loss','Owner agreed to absorb this verified payment loss.',100,$3)",[operator,c.id,request]);assert.equal(await balance(owner),ownerAfter);
  await assert.rejects(()=>db.query("select operate_case($1,$2,'allocate-payment-loss','Changed explanation must not reuse a committed request.',100,$3)",[operator,c.id,request]),/request mismatch/);
  await assert.rejects(()=>db.query("select operate_case($1,$2,'allocate-payment-loss','Cannot allocate more than the verified payment loss.',5000,gen_random_uuid())",[operator,c.id]),/exceeds/);
  await db.query("select operate_case($1,$2,'resolve','Reconciled the refund, allocation and remaining funds.',0,gen_random_uuid())",[operator,c.id]);await db.query('select private.assert_credit_account_clear($1)',[owner]);
 });
 await t.test('an unverified user report cannot freeze another wallet',async()=>{
  await db.query("insert into support_cases(reporter_id,subject_id,kind,description) values($1,$2,'payment','A complaint without a verified provider reversal.')",[stranger,owner]);await db.query('select private.assert_credit_account_clear($1)',[owner]);
 });
 await t.test('withdrawals distinguish spendable, recent and provider-pending funds',async()=>{
  await ledger(stranger,10000,'settled-old',10);await ledger(stranger,1000,'recent');assert.equal(Number((await db.query('select private.withdrawable($1) n',[stranger])).rows[0].n),10000);
  await db.query("insert into payment_receipts(charge_id,payment_intent_id,session_id,wallet_account,principal_cents) values('ch_pending','pi_pending','cs_pending',$1,2500)",[stranger]);assert.equal(Number((await db.query('select private.withdrawable($1) n',[stranger])).rows[0].n),7500);
  await db.query("update profiles set stripe_account_id='acct_fixture',stripe_onboarding_complete=true where id=$1",[stranger]);const id=crypto.randomUUID();
  await db.query('select reserve_credit_withdrawal($1,7000,$2)',[stranger,id]);await db.query('select credit_withdrawal_ready($1,$2)',[stranger,id]);
  await ledger(stranger,500,'unrelated-new');await db.query('select credit_withdrawal_ready($1,$2)',[stranger,id]);await assert.rejects(()=>db.query('select reserve_credit_withdrawal($1,1000,gen_random_uuid())',[stranger]),/settled credits/);
 });
 await t.test('MFA/RLS and service privileges protect new financial and operational endpoints',async()=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[stranger,JSON.stringify({aal:'aal1'})]);
  assert.equal((await db.query('select * from payment_receipts')).rows.length,1);await assert.rejects(()=>db.query('select operator_allowed($1)',[stranger]),/permission denied/);await assert.rejects(()=>db.query("select reconcile_rental_charge('ch_hardening','unauthorized',200,0,0,false)"),/permission denied/);await db.exec('reset role');
  await db.exec('set role service_role');await db.query('select private.withdrawable($1)',[stranger]);await db.query("select check_request_access($1,'fixture',2)",[stranger]);await db.query("select check_request_access($1,'fixture',2)",[stranger]);await assert.rejects(()=>db.query("select check_request_access($1,'fixture',2)",[stranger]),/Too many requests/);await db.exec('reset role');
 });
 await t.test('wallet identities accept a later topup reversal after a zero-balance account is deleted',async()=>{
  const u=crypto.randomUUID(),id=crypto.randomUUID();await db.query('insert into auth.users(id) values($1)',[u]);await db.query('select create_credit_topup($1,1000,$2)',[u,id]);
  await db.query("select finish_credit_topup('deleted-paid','checkout.session.completed',$1,'cs_deleted',true,1000,'usd','pi_deleted','ch_deleted','txn_deleted',50,now(),'{}')",[id]);await ledger(u,-1000,'deleted-spend',10);
  await db.query('select begin_account_deletion($1)',[u]);await db.query('delete from auth.users where id=$1',[u]);await db.query("select reverse_credit_topup($1,'deleted-refund','charge.refunded','ch_deleted',1000,0,false,'{}')",[id]);assert.equal(await balance(u),-1000);
  const rows=(await db.query('select user_id,wallet_account from credit_ledger where wallet_account=$1',[u])).rows;assert(rows.every(r=>r.user_id===null&&r.wallet_account===u));
 });
});
