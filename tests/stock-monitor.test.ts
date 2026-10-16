import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInventory,defaultInventoryRules,type ProductRow,type LotRow} from '../lib/ai-ads/inventory';
import {buildStockSnapshot,stockSnapshotFresh,stockMonitorState,stockAdvisorEvidence,stockWorkStatus} from '../lib/ai-ads/monitor';
import {ownerFixedFx,ronValue,usableFx,observationInRon} from '../lib/ads-fx';
const now=Date.parse('2026-10-16T12:00:00Z'),project='dmjunqbncyrinykbbmfk';
const product:ProductRow={id:'p1',name:'Recorded display',sku:'SKU1',brand:'Recorded',partCode:null,partType:'display',compatibleModels:['Recorded Model'],modelId:null,category:'PART',quality:'used',active:true,minStock:1,recommendedPrice:'150.00',updatedAt:new Date(now).toISOString()};
const lot:LotRow={id:'l1',productId:'p1',quantityAvailable:3,unitCost:'50.00',costIncludesVat:null,updatedAt:product.updatedAt};
function source(quantity=3,time=now){return {sourceProject:project,complete:true,parts:normalizeInventory(project,[product],[{...lot,quantityAvailable:quantity}],[],defaultInventoryRules,time)};}
test('first complete run prepares blocked stock-specific drafts with evidence',()=>{
 const run=buildStockSnapshot(source(),null,now);assert.equal(run.summary.stockQualified,1);assert.equal(run.drafts.length,1);assert.equal(run.drafts[0].stockAtGeneration,3);assert.equal(run.drafts[0].policy.publishAllowed,false);assert.equal(run.drafts[0].repairPriceBani,null);assert.equal(run.drafts[0].landingUrl,null);assert.equal(run.events.length,0);
});
test('stock depletion removes drafts and records a review event without claiming an ad pause',()=>{
 const before=buildStockSnapshot(source(),null,now),after=buildStockSnapshot(source(0,now+60000),before,now+60000);
 assert.equal(after.drafts.length,0);assert.equal(after.summary.outOfStock,1);assert.equal(after.events[0].kind,'unavailable');assert.match(after.events[0].message,/No mapped Google ad or account change is confirmed/);
});
test('restock prepares a new draft but never re-enables an ad',()=>{
 const before=buildStockSnapshot(source(0),null,now),after=buildStockSnapshot(source(2,now+60000),before,now+60000);
 assert.equal(after.events[0].kind,'restocked');assert.match(after.events[0].message,/no ad was re-enabled/);assert.equal(after.drafts[0].policy.publishAllowed,false);
});
test('unchanged stock does not duplicate change events or draft identities',()=>{
 const before=buildStockSnapshot(source(),null,now),after=buildStockSnapshot(source(3,now+60000),before,now+60000);assert.equal(after.events.length,0);assert.equal(after.drafts[0].id,before.drafts[0].id);
});
test('incomplete, stale and wrong-project inventory are rejected',()=>{
 assert.throws(()=>buildStockSnapshot({...source(),complete:false},null,now));
 assert.throws(()=>buildStockSnapshot(source(),null,now+300000),/stale/);
 assert.throws(()=>buildStockSnapshot({...source(),sourceProject:'different'},null,now));
});
test('report freshness follows the oldest part read, not completion time',()=>{
 const snapshot=buildStockSnapshot(source(),null,now+120000);assert.equal(snapshot.observedAt,new Date(now).toISOString());assert.equal(stockSnapshotFresh(snapshot,now+300000),false);
});
test('failed reads keep historical stock visible but explicitly unreliable',()=>{
 const snapshot=buildStockSnapshot(source(),null,now),good={status:'complete' as const,snapshot,created_at:new Date(now).toISOString(),error_code:null};
 const failed={status:'failed' as const,snapshot:null,created_at:new Date(now+1000).toISOString(),error_code:'inventory_read_failed'};
 const state=stockMonitorState(failed,good,now+1000);assert.equal(state.reliable,false);assert.equal(state.lastAttemptFailed,true);assert.equal(state.snapshot,snapshot);assert.equal(state.executionEnabled,false);
});
test('owner fixed rate is exactly 4.74 and never depends on a Google quote',()=>{
 const fx=ownerFixedFx(now);assert.equal(fx.source,'owner_fixed');assert.equal(fx.quoteAt,null);assert.equal(fx.rate,4.74);assert.equal(usableFx(fx,now),true);assert.equal(ronValue(100,'USD',fx,now),474);assert.equal(usableFx({...fx,rate:4.75},now),false);assert.equal(observationInRon(null,fx,now),null);
});
test('advisor receives bounded stock facts without costs, credentials or customer records',()=>{
 const snapshot=buildStockSnapshot(source(),null,now),run={status:'complete' as const,snapshot,created_at:new Date(now).toISOString(),error_code:null};
 const evidence=stockAdvisorEvidence(stockMonitorState(run,run,now));assert.equal(evidence.stockQualifiedSamples.length,1);assert.deepEqual(evidence.stockQualifiedSamples[0].models,['Recorded Model']);assert.equal(evidence.publicationBlocked,true);assert.ok(!JSON.stringify(evidence).includes('weightedUnitCostBani'));
 assert.equal(stockAdvisorEvidence(stockMonitorState(run,run,now+300000)).stockQualifiedSamples.length,0);
});
test('agent reports active stock work only after a fresh successful collection',()=>{
 const snapshot=buildStockSnapshot(source(),null,now),run={status:'complete' as const,snapshot,created_at:new Date(now).toISOString(),error_code:null};
 assert.equal(stockWorkStatus(stockMonitorState(null,null,now)).state,'unavailable');
 const active=stockWorkStatus(stockMonitorState(run,run,now));assert.equal(active.state,'active');assert.equal(active.qualifiedParts,1);assert.equal(active.draftCount,1);
 assert.equal(stockWorkStatus(stockMonitorState(run,run,now+300000)).state,'stale');
 const failure={...run,status:'failed' as const,error_code:'inventory_read_failed',snapshot:null};assert.equal(stockWorkStatus(stockMonitorState(failure,run,now)).state,'stale');
});
