import {test} from 'node:test';import assert from 'node:assert/strict';
import {trustFor,badgesFor} from '../src/reputation.js';
import {amountInCents} from '../src/wallet.js';
test('owner and renter trust use their own completed activity and independent reviewers',()=>{
 const m={lent:50,borrowed:3,ownerReviewCount:20,ownerRating:4.8,ownerReviewers:10,renterReviewCount:2,renterRating:4.3,renterReviewers:2};
 assert.equal(trustFor(m,'owner').tier.name,'Platinum');assert.equal(trustFor(m,'renter').tier.name,'Bronze');
 assert.equal(trustFor({...m,ownerReviewers:1},'owner').tier,null);assert.equal(trustFor({...m,ownerRating:3.9},'owner').tier,null);
 assert.equal(trustFor({borrowed:50,ownerReviewCount:50,ownerRating:5,ownerReviewers:20},'renter').tier,null);
 assert.equal(trustFor({...m,ownerRating:4.7},'owner').tier.name,'Gold');assert.equal(trustFor({...m,lent:10},'owner').tier.name,'Silver');
 assert.equal(trustFor({},'renter').next.name,'Bronze');
});
test('review badges recognize honest feedback without requiring favorable ratings',()=>{
 const earned=badgesFor({reviewsWritten:5,renterReviewsWritten:3,renterRating:1,ownerRating:1}).filter(b=>b.earned).map(b=>b.name);
 assert(earned.includes('First feedback'));assert(earned.includes('Community voice'));assert(earned.includes('Thoughtful renter'));assert(!earned.includes('Trusted renter'));assert(badgesFor({}).length>=20);
});
test('wallet amounts reject fractional cents and unsafe input',()=>{
 assert.equal(amountInCents('25.50'),2550);assert.equal(amountInCents('1'),100);for(const v of ['0','0.99','1.001','1e4','Infinity','-5','abc'])assert.throws(()=>amountInCents(v));
});
