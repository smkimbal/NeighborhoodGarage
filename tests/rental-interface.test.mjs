import test from 'node:test';
import assert from 'node:assert/strict';
import {handoffUrl,normalizeItemCode,directionLinks,bookingOverlap,billingDays,availabilityLabel} from '../src/rental-workflow.js';
const id='00000000-0000-4000-8000-000000000003';
test('permanent item QR links preserve deployment paths and reject foreign handoff links',()=>{
 for(const base of ['https://neighborhoodgarage.net/','https://smkimbal.github.io/NeighborhoodGarage/']){
  const link=handoffUrl(base+'?payment=success',id);
  assert.equal(normalizeItemCode(link,base),id);
  assert.equal(new URL(link).search,'');
 }
 assert.equal(normalizeItemCode('ng1234abcd','https://neighborhoodgarage.net/'),'NG1234ABCD');
 for(const bad of ['https://evil.example/#/handoff/'+id,'https://smkimbal.github.io/OtherApp/#/handoff/'+id,'random'])assert.throws(()=>normalizeItemCode(bad,'https://smkimbal.github.io/NeighborhoodGarage/'));
});
test('private directions support GPS or designated places without exposing other booking data',()=>{
 const place=directionLinks({type:'place',address:'123 Main St, Chicago & entrance B'});
 assert.equal(new URL(place.google).searchParams.get('destination'),'123 Main St, Chicago & entrance B');
 assert.equal(new URL(place.apple).searchParams.get('daddr'),'123 Main St, Chicago & entrance B');
 assert.equal(new URL(directionLinks({type:'owner_location',lat:41.88,lng:-87.63}).google).searchParams.get('destination'),'41.88,-87.63');
 assert.equal(directionLinks(null),null);
});
test('future booking previews allow adjacent windows and show currently rented tools',()=>{
 const ranges=[{start:'2026-10-03T12:00:00Z',end:'2026-10-04T12:00:00Z'}];
 assert.equal(bookingOverlap('2026-10-04T12:00:00Z','2026-10-05T12:00:00Z',ranges),false);
 assert.equal(bookingOverlap('2026-10-04T11:59:00Z','2026-10-05T12:00:00Z',ranges),true);
 assert.equal(billingDays('2026-10-03T12:00:00Z','2026-10-05T12:01:00Z'),3);
 assert.match(availabilityLabel({available:true,availability:{rented:true,expected_return:ranges[0].end}}),/Rented · expected back/);
});

test('reservation duration and cost cover earliest pickup through latest return with partial days',async()=>{
 const {reservedPrice,durationLabel,earlyReturnEstimate}=await import('../src/rental-workflow.js');
 assert.equal(durationLabel('2026-10-03T10:00Z','2026-10-04T12:30Z'),'1 day 2 hours 30 minutes');
 assert.equal(reservedPrice(2400,'2026-10-03T10:00Z','2026-10-04T12:30Z'),2650);
 assert.equal(earlyReturnEstimate({rental_cents:2650,daily_rate_cents:2400,billing_starts_at:'2026-10-03T10:00Z'},'2026-10-03T20:45Z'),1575);
 // A daylight-saving day is priced by actual elapsed reserved time.
 assert.equal(reservedPrice(2400,'2026-11-01T00:00:00-06:00','2026-11-02T00:00:00-07:00'),2500);
});

test('changing an earlier selection automatically keeps its later window and return dates ordered',async()=>{
 const {normalizeWindows}=await import('../src/rental-workflow.js');
 const old={pickupStart:'2026-10-03T10:00Z',pickupEnd:'2026-10-03T12:00Z',returnStart:'2026-10-04T10:00Z',returnEnd:'2026-10-04T12:00Z'};
 const moved=normalizeWindows({...old,returnStart:'2026-10-06T10:00Z'},'returnStart',old);
 assert.equal(new Date(moved.returnEnd).toISOString(),'2026-10-06T12:00:00.000Z');
 const future=normalizeWindows({...old,pickupStart:'2026-10-08T10:00Z'},'pickupStart',old);
 assert.equal(new Date(future.pickupEnd).toISOString(),'2026-10-08T12:00:00.000Z');
 assert.equal(new Date(future.returnEnd).toISOString(),'2026-10-09T12:00:00.000Z');
 const reversed=normalizeWindows({...old,returnEnd:'2026-10-01T08:00Z'},'returnEnd',old);
 assert(new Date(reversed.returnEnd)>new Date(reversed.returnStart));
 assert(new Date(normalizeWindows({...old,pickupEnd:'2026-10-09T12:00Z'},'pickupEnd',old).pickupEnd)-new Date(old.pickupStart)<=86400000);
});
