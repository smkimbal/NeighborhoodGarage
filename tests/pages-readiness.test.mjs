import {test} from 'node:test';import assert from 'node:assert/strict';import {pagesReadiness} from '../scripts/pages-readiness.mjs';
test('sandbox publishing distinguishes a build artifact from enabled Pages hosting',async()=>{
 const read=async result=>pagesReadiness({token:'fixture',request:async(url,o)=>{assert.equal(o.method,undefined);assert.equal(o.redirect,'error');assert.equal(o.body,undefined);assert.equal(url,'https://api.github.com/repos/smkimbal/NeighborhoodGarage/pages');return result;}});
 assert.equal((await read(new Response('',{status:404}))).ready,false);
 assert.equal((await read(Response.json({html_url:'https://smkimbal.github.io/NeighborhoodGarage/',build_type:'legacy'}))).ready,false);
 assert.equal((await read(Response.json({html_url:'https://smkimbal.github.io/NeighborhoodGarage/',build_type:'workflow'}))).ready,true);
 await assert.rejects(()=>read(Response.json({html_url:'https://neighborhoodgarage.net/',cname:'neighborhoodgarage.net',build_type:'workflow'})),/without a production custom domain/);
 await assert.rejects(()=>read(new Response('',{status:403})),/403/);
});
