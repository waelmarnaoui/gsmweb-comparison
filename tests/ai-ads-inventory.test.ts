import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInventory,defaultInventoryRules,inventorySafeguard,type ProductRow,type LotRow} from '../lib/ai-ads/inventory';
import {generateRepairDraft,assertPublicationAllowed} from '../lib/ai-ads/policy';
const now=Date.parse('2026-10-16T12:00:00Z'),stamp=new Date(now).toISOString();
const product:ProductRow={id:'p1',name:'Display',sku:'SKU1',brand:'Recorded brand',partCode:null,partType:'display',compatibleModels:['Recorded Model'],modelId:null,category:'PART',quality:'used',active:true,minStock:1,recommendedPrice:'150.00',updatedAt:stamp};
const lot:LotRow={id:'l1',productId:'p1',quantityAvailable:2,unitCost:'50.00',costIncludesVat:true,updatedAt:stamp};
function read(p:Partial<ProductRow>={},l:Partial<LotRow>={}){return normalizeInventory('dmjunqbncyrinykbbmfk',[{...product,...p}],[{...lot,...l}],[],defaultInventoryRules,now)[0];}
test('net stock uses lot availability without deducting repair allocations again',()=>{assert.equal(read().available,2);assert.equal(read().eligible,true);});
test('zero stock and minimum stock thresholds exclude parts',()=>{assert.ok(read({}, {quantityAvailable:0}).reasons.includes('out_of_stock'));assert.ok(read({minStock:3}).reasons.includes('below_minimum_stock'));});
test('catalog entries without lots cannot advertise',()=>{assert.equal(normalizeInventory('dmjunqbncyrinykbbmfk',[product],[],[],defaultInventoryRules,now)[0].eligible,false);});
test('unknown VAT basis leaves cost and profit unavailable',()=>{assert.equal(read({}, {costIncludesVat:null}).weightedUnitCostBani,null);assert.equal(read().repairPriceBani,null);});
test('invalid quantity and non-part inventory fail qualification',()=>{assert.equal(read({}, {quantityAvailable:-1}).eligible,false);assert.equal(read({category:'ACCESSORY'}).eligible,false);});
test('compatibility is never inferred from product name',()=>{assert.equal(read({name:'Display for imagined model',compatibleModels:[]}).eligible,false);const draft=generateRepairDraft(read(),null,now);assert.ok(draft.keywords.every(k=>k.text.includes('Recorded Model')));assert.equal(draft.searchVolume,null);});
test('duplicate lots abort rather than double count',()=>{assert.throws(()=>normalizeInventory('dmjunqbncyrinykbbmfk',[product],[lot,lot],[],defaultInventoryRules,now),/Duplicate/);});
test('stock changes invalidate evidence and require pause review',()=>{const before=read(),after=read({}, {quantityAvailable:0});assert.notEqual(before.fingerprint,after.fingerprint);assert.equal(inventorySafeguard(before,after).action,'REVIEW_PAUSE');});
test('repeated draft generation is idempotent and retains stock evidence',()=>{const part=read(),a=generateRepairDraft(part,null,now),b=generateRepairDraft(part,null,now+1000);assert.equal(a.id,b.id);assert.equal(a.stockAtGeneration,2);assert.equal(a.repairPriceBani,null);});
test('policy prevents publication even with exact owner approval',()=>{const current=read(),draft=generateRepairDraft(current,null,now);assert.throws(()=>assertPublicationAllowed({globalPaused:false,approvedHash:draft.contentHash,draft,current,now}),/policy/);assert.throws(()=>assertPublicationAllowed({globalPaused:true,approvedHash:draft.contentHash,draft,current,now}),/paused/);});
