import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInventory,defaultInventoryRules} from '../lib/ai-ads/inventory';
import {prepareSearchOpportunities,type SearchReport} from '../lib/ai-ads/search-growth';
import {makePublicationPlan,creationOperations,type PublicationFeedback} from '../lib/ai-ads/publishing';
import {correctionAllowed,makeEditorialCorrection,correctionParentMatches} from '../lib/ai-ads/corrections';
const now=Date.parse('2026-10-17T10:00:00Z'),stamp=new Date(now).toISOString(),account='2050434247';
const part=normalizeInventory('dmjunqbncyrinykbbmfk',[{id:'part1',name:'Battery',sku:'b1',brand:'Apple',partCode:null,partType:'battery',compatibleModels:['Apple iPhone 14'],modelId:null,category:'PART',quality:'new',active:true,minStock:1,recommendedPrice:100,updatedAt:stamp}],[{id:'lot1',productId:'part1',quantityAvailable:3,unitCost:50,costIncludesVat:true,updatedAt:stamp}],[],defaultInventoryRules,now)[0];
const report:SearchReport={accountId:account,currency:'USD',timeZone:'Europe/Bucharest',fetchedAt:stamp,windowStart:'2026-10-11',windowEnd:'2026-10-17',campaigns:[{id:'1',name:'Local',status:'ENABLED',startDate:null,endDate:null,schedule:[]}],terms:[{campaignId:'1',adGroupId:'2',term:'baterie iphone 14',impressions:12,clicks:2,costMicros:'1000'}],privacyFiltered:0,complete:true,termsCollected:true};
const opportunity=prepareSearchOpportunities(report,[part],now)[0],plan=makePublicationPlan(opportunity,part,report,'MANUAL_CPC',now);
const feedback:PublicationFeedback={groupResource:`customers/${account}/adGroups/100`,adResource:`customers/${account}/adGroupAds/100~200`,groupStatus:'PAUSED',adStatus:'ENABLED',approval:'APPROVED',review:'REVIEWED',topics:[]};

const rejected={...feedback,approval:'DISAPPROVED',topics:[{topic:'CAPITALIZATION',type:'PROHIBITED'}]};
test('only completed disapproved editorial results qualify; eligible, limited, pending and business cases never retry',()=>{
 assert.equal(correctionAllowed(rejected),true);
 for(const f of [{...rejected,approval:'APPROVED'},{...rejected,approval:'APPROVED_LIMITED'},{...rejected,review:'REVIEW_IN_PROGRESS'},{...rejected,groupStatus:'ENABLED'},{...rejected,adStatus:'PAUSED'},{...rejected,topics:[]},...['THIRD_PARTY_CONSUMER_TECHNICAL_SUPPORT','MISREPRESENTATION','COUNTERFEIT','EDITORIAL','UNKNOWN'].map(topic=>({...rejected,topics:[{topic,type:'PROHIBITED'}]}))])assert.equal(correctionAllowed(f),false);
 assert.equal(correctionAllowed({...rejected,topics:[...rejected.topics,{topic:'MISREPRESENTATION',type:'PROHIBITED'}]}),false);
});
test('one factual correction preserves mandatory disclosure, keywords and landing page without changing the parent',()=>{
 const before=JSON.stringify(plan),fixed=makeEditorialCorrection(plan,rejected,part,now)!;assert.ok(fixed);assert.equal(JSON.stringify(plan),before);
 assert.notEqual(fixed.key,plan.key);assert.equal(fixed.correction?.parentId,plan.key);assert.equal(fixed.correction?.attempt,1);assert.equal(fixed.draft.headlines.length,15);assert.equal(fixed.draft.descriptions.length,4);assert.equal(fixed.draft.landingUrl,plan.draft.landingUrl);assert.deepEqual(fixed.keywords,plan.keywords);
 assert.match(fixed.draft.pinnedHeadlines![0].text,/cu montaj in magazin/i);assert.match(fixed.draft.pinnedDescriptions![0].text,/numai cu montaj.*nu se vinde separat/i);
 assert.equal(makeEditorialCorrection(fixed,rejected,part,now),null);assert.equal(makeEditorialCorrection(plan,rejected,{...part,eligible:false},now),null);
 assert.equal(makeEditorialCorrection(plan,rejected,part,now)!.key,fixed.key);
 const ops=creationOperations(fixed);assert.ok(!JSON.stringify(ops).includes('updateMask'));assert.equal((ops[0] as any).adGroupOperation.create.status,'PAUSED');
 assert.equal(makeEditorialCorrection(plan,{...rejected,topics:[{topic:'SPACING',type:'PROHIBITED'}]},part,now),null,'no changed spacing means no pointless resubmission');
});
test('a correction cannot claim or mutate an original ad and is held when its parent evidence changes',()=>{
 const child=makeEditorialCorrection(plan,rejected,part,now)!,parent={id:plan.key,account_id:account,plan,group_resource:feedback.groupResource,ad_resource:feedback.adResource,pending_operation:null,state:'submitted',error_code:null};
 assert.equal(correctionParentMatches(child,parent,rejected),true);
 for(const p of [{...parent,id:'original'},{...parent,ad_resource:null},{...parent,account_id:'0000000000'},{...parent,pending_operation:'create'},{...parent,state:'failed'},{...parent,error_code:'owner_paused_group'}])assert.equal(correctionParentMatches(child,p,rejected),false);
 assert.equal(correctionParentMatches(child,parent,feedback),false);assert.equal(correctionParentMatches(child,parent,{...rejected,adResource:'different'}),false);
});
