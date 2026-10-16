import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareCopyVariants,nextCopyStep} from '../lib/ai-ads/variants';
import {normalizeInventory,defaultInventoryRules} from '../lib/ai-ads/inventory';
import {validHeadline,restrictedCopy} from '../lib/ai-ads/copy-rules';
const now=Date.parse('2026-10-16T12:00:00Z');
const part=normalizeInventory('dmjunqbncyrinykbbmfk',[{id:'p',name:'Recorded display',sku:'s',brand:null,partCode:null,partType:'display',compatibleModels:['Recorded Model'],modelId:null,category:'PART',quality:'used',active:true,minStock:1,recommendedPrice:100,updatedAt:new Date(now).toISOString()}],[{id:'l',productId:'p',quantityAvailable:3,unitCost:50,costIncludesVat:null,updatedAt:new Date(now).toISOString()}],[],defaultInventoryRules,now)[0];
const base={feedback:null,attempts:0,internalHighRisk:false,stockCurrent:true,scopeApproved:true};
test('three bounded factual variants have stable identities and no fabricated approval',()=>{
 const variants=prepareCopyVariants(part);assert.equal(variants.length,3);assert.equal(new Set(variants.map(v=>v.id)).size,3);assert.deepEqual(prepareCopyVariants(part),variants);
 for(const variant of variants){assert.equal(variant.googleReview,'NOT_SUBMITTED');assert.equal(variant.inventoryFingerprint,part.fingerprint);assert.equal(variant.headlines.length,15);assert.ok(variant.headlines.every(validHeadline));assert.ok(variant.descriptions.every(t=>Array.from(t).length<=90&&!restrictedCopy(t)));assert.ok(!JSON.stringify(variant).includes('warranty'));}
 assert.throws(()=>prepareCopyVariants({...part,eligible:false}));
});
test('high internal policy risk stops copy changes even after owner approval',()=>{
 assert.equal(nextCopyStep({...base,internalHighRisk:true}).action,'STOP_POLICY');assert.equal(nextCopyStep({...base,stockCurrent:false}).action,'STOP_STOCK');assert.equal(nextCopyStep({...base,scopeApproved:false}).action,'WAIT_FOR_OWNER');
});
test('no result or pending review cannot be mistaken for Google approval',()=>{
 assert.equal(nextCopyStep(base).action,'WAIT_FOR_GOOGLE');assert.equal(nextCopyStep({...base,feedback:{approvalStatus:'APPROVED',reviewStatus:'REVIEW_IN_PROGRESS',topics:[]}}).action,'WAIT_FOR_GOOGLE');
});
test('editorial feedback can prepare corrections; business restrictions and unknown issues stop',()=>{
 const feedback={approvalStatus:'DISAPPROVED',reviewStatus:'REVIEWED',topics:[{topic:'CAPITALIZATION',type:'PROHIBITED'}]};
 assert.equal(nextCopyStep({...base,feedback,attempts:1}).action,'PREPARE_CORRECTION');assert.equal(nextCopyStep({...base,feedback,attempts:3}).action,'STOP_REVIEW');
 for(const topic of ['THIRD_PARTY_TECHNICAL_SUPPORT','MISREPRESENTATION','CIRCUMVENTING_SYSTEMS'])assert.equal(nextCopyStep({...base,feedback:{...feedback,topics:[{topic,type:'PROHIBITED'}]}}).action,'STOP_POLICY');
 assert.equal(nextCopyStep({...base,feedback:{...feedback,topics:[{topic:'NEW_UNKNOWN_REASON',type:'PROHIBITED'}]}}).action,'STOP_REVIEW');
});
test('reviewed approval applies only to that ad; limited or new enum values require review',()=>{
 const feedback={approvalStatus:'APPROVED',reviewStatus:'REVIEWED',topics:[]};assert.equal(nextCopyStep({...base,feedback}).action,'REVIEW_ELIGIBLE');
 for(const type of ['LIMITED','FULLY_LIMITED','PROHIBITED','NEW_ENUM'])assert.equal(nextCopyStep({...base,feedback:{...feedback,topics:[{topic:'SOME_POLICY',type}]}}).action,'STOP_REVIEW');
});
