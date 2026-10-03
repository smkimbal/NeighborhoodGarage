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
