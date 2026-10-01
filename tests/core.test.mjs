import test from 'node:test';
import assert from 'node:assert/strict';
import {quote,distanceMiles} from '../src/core.js';
test('quote applies credits without exceeding total',()=>{
  assert.deepEqual(quote(800,6500,2,12000),{rental:1600,fee:80,owner:1520,deposit:6500,total:8100,creditsUsed:8100,due:0});
});
test('distance is zero for same point',()=>assert.equal(distanceMiles({lat:1,lng:2},{lat:1,lng:2}),0));

test('quote leaves Stripe minimum on partial-credit USD payments',()=>{const q=quote(100,0,1,75);assert.equal(q.due,50);assert.equal(q.creditsUsed,50);assert.equal(quote(100,0,1,100).due,0);});
