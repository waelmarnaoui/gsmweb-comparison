import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInventory,defaultInventoryRules} from '../lib/ai-ads/inventory';
import {prepareSearchOpportunities,type SearchReport} from '../lib/ai-ads/search-growth';
import {makePublicationPlan,creationOperations,publicationSpendProblem,publicationStockProblem,googleCleared,localPublicationScope,type PublicationFeedback} from '../lib/ai-ads/publishing';
import {createPublicationEngine,type PublicationRow} from '../lib/ai-ads/publishing-engine';
import {createPublishingGoogle} from '../lib/ai-ads/publishing-google';
import {ControlProviderError} from '../lib/ads-control/google';
import {feedbackFresh} from '../lib/ai-ads/intervention-policy';
import {quotaWait} from '../lib/ai-ads/quota-policy';
const now=Date.parse('2026-10-17T10:00:00Z'),stamp=new Date(now).toISOString(),account='2050434247';
const part=normalizeInventory('dmjunqbncyrinykbbmfk',[{id:'part1',name:'Battery',sku:'b1',brand:'Apple',partCode:null,partType:'battery',compatibleModels:['Apple iPhone 14'],modelId:null,category:'PART',quality:'new',active:true,minStock:1,recommendedPrice:100,updatedAt:stamp}],[{id:'lot1',productId:'part1',quantityAvailable:3,unitCost:50,costIncludesVat:true,updatedAt:stamp}],[],defaultInventoryRules,now)[0];
const report:SearchReport={accountId:account,currency:'USD',timeZone:'Europe/Bucharest',fetchedAt:stamp,windowStart:'2026-10-11',windowEnd:'2026-10-17',campaigns:[{id:'1',name:'Local',status:'ENABLED',startDate:null,endDate:null,schedule:[]}],terms:[{campaignId:'1',adGroupId:'2',term:'baterie iphone 14',impressions:12,clicks:2,costMicros:'1000'}],privacyFiltered:0,complete:true,termsCollected:true};
const opportunity=prepareSearchOpportunities(report,[part],now)[0],plan=makePublicationPlan(opportunity,part,report,'MANUAL_CPC',now);
const feedback:PublicationFeedback={groupResource:`customers/${account}/adGroups/100`,adResource:`customers/${account}/adGroupAds/100~200`,groupStatus:'PAUSED',adStatus:'ENABLED',approval:'APPROVED',review:'REVIEWED',topics:[]};
function fixture(state='prepared'){
 let row:PublicationRow={id:plan.key,account_id:account,plan,state,version:0,pending_operation:null,group_resource:state==='prepared'?null:feedback.groupResource,ad_resource:state==='prepared'?null:feedback.adResource,google_feedback:null,error_code:null,request_id:null,checked_at:null};
 let auth=true,problem:string|null=null,live:PublicationFeedback|null=state==='prepared'?null:{...feedback};const trace:string[]=[],writes:string[]=[];
 const google={localTargeting:async()=>true,campaign:async()=> 'MANUAL_CPC',inspect:async()=>live,create:async(p:typeof plan,validate:boolean)=>{trace.push(validate?'validate_create':'create');if(!validate){assert.equal(row.state,'creating');assert.equal(row.pending_operation,'create');writes.push('create');live={...feedback,approval:'UNKNOWN',review:'REVIEW_IN_PROGRESS'};}return 'request';},groupStatus:async(group:string,status:'ENABLED'|'PAUSED',validate:boolean)=>{assert.equal(group,feedback.groupResource);trace.push(validate?'validate_group':status);if(!validate){assert.ok(row.pending_operation);writes.push(status);live={...live!,groupStatus:status};}return 'request';}};
 const options={google,store:{save:async(before:PublicationRow,patch:Partial<PublicationRow>)=>{assert.equal(before.version,row.version);row={...row,...patch,version:row.version+1};trace.push('saved:'+row.state);return row;},fence:async()=>{trace.push('fence');}},authorized:async()=>auth,guard:async()=>problem,now:()=>now};
 return {engine:createPublicationEngine(options),options,google,trace,writes,get:()=>row,setAuth:(v:boolean)=>{auth=v;},setProblem:(v:string|null)=>{problem=v;},setLive:(v:PublicationFeedback|null)=>{live=v;},setRow:(p:Partial<PublicationRow>)=>{row={...row,...p};}};
}
test('new ads are Enabled while their new model-specific groups start Paused; no original resource update exists',()=>{
 const ops=creationOperations(plan);assert.equal((ops[0] as any).adGroupOperation.create.status,'PAUSED');assert.equal((ops.at(-1) as any).adGroupAdOperation.create.status,'ENABLED');assert.equal((ops[0] as any).adGroupOperation.create.cpcBidMicros,'632911');assert.match(plan.groupName,/iPhone Batteries.*Apple iPhone 14/);assert.ok(!JSON.stringify(ops).includes('updateMask'));assert.equal(plan.key,makePublicationPlan(opportunity,part,report,'MANUAL_CPC',now+1000).key);
 const ad=(ops.at(-1) as any).adGroupAdOperation.create.ad;assert.equal(ad.responsiveSearchAd.headlines.filter((h:any)=>h.pinnedField==='HEADLINE_1').length,1);assert.match(ad.responsiveSearchAd.descriptions.find((d:any)=>d.pinnedField==='DESCRIPTION_1').text,/Nu se vinde separat/);
});
test('fresh stock, verified search evidence, compatibility and campaign hours are mandatory',()=>{
 assert.throws(()=>makePublicationPlan(opportunity,{...part,eligible:false},report,'MANUAL_CPC',now));assert.throws(()=>makePublicationPlan(opportunity,part,{...report,terms:[]},'MANUAL_CPC',now));assert.throws(()=>makePublicationPlan(opportunity,part,{...report,fetchedAt:new Date(now-300001).toISOString()},'MANUAL_CPC',now));assert.equal(publicationStockProblem(plan,{...part,available:0,eligible:false},now),'stock_unavailable');assert.equal(publicationStockProblem(plan,{...part,quality:'used'},now),'stock_details_changed');assert.equal(publicationStockProblem(plan,{...part,available:2,fingerprint:'changed'},now),null);
});

test('publication keeps the selected 15 Pro Max display model and the braces in Google assets',()=>{
 const display={...part,partType:'display',models:['iPhone 14','iPhone 15 Pro Max']};
 const search={...report,terms:[{...report.terms[0],term:'display iphone 15 pro max'}]};
 const match=prepareSearchOpportunities(search,[display],now)[0];assert.equal(match.model,'iPhone 15 Pro Max');
 const selected=makePublicationPlan(match,display,search,'MANUAL_CPC',now);
 const assets=(creationOperations(selected).at(-1) as any).adGroupAdOperation.create.ad.responsiveSearchAd.headlines;
 assert.ok(assets.some((h:any)=>h.text==='{KeyWord:Display iPhone 15 Pro Max}'));
 assert.ok(selected.keywords.every(k=>k.includes('iPhone 15 Pro Max')));
 assert.ok(!assets.some((h:any)=>h.text.includes('iPhone 14')));
 const longModel='Unusually Long Manufacturer Phone 2026 Pro Max Ultra';
 assert.throws(()=>makePublicationPlan({...opportunity,model:longModel},{...part,models:[longModel]},report,'MANUAL_CPC',now),/model_keyword_headline_missing/);
});
test('actual prior-day allowance and dated RON spend guard activation; missing is not zero',()=>{
 const context={accountId:account,businessDate:'2026-10-17',allowance:{ready:true,allowanceBani:15000},ronObservation:{accountId:account,currency:'RON',fetchedAt:stamp,today:{date:'2026-10-17',costMicros:'58590000'}}};assert.equal(publicationSpendProblem(context,account,now),null);assert.equal(publicationSpendProblem({...context,allowance:{ready:false,allowanceBani:null}},account,now),'daily_allowance_unavailable');assert.equal(publicationSpendProblem({...context,ronObservation:{...context.ronObservation,today:{...context.ronObservation.today,costMicros:'150000000'}}},account,now),'daily_allowance_reached');assert.equal(publicationSpendProblem({...context,ronObservation:null},account,now),'spend_unverified');
});
test('creation records intent before writing and confirms the actual enabled-ad/paused-group result',async()=>{const f=fixture(),r=await f.engine.create(f.get());assert.equal(r.state,'submitted');assert.deepEqual(f.writes,['create']);assert.ok(f.trace.indexOf('saved:creating')<f.trace.indexOf('create'));assert.equal(r.group_resource,feedback.groupResource);});
test('unapproved workflow, changed stock or scope during validation prevents publication',async()=>{
 for(const problem of ['stock_unavailable','outside_campaign_schedule','search_monitoring_stale']){const f=fixture();f.setProblem(problem);await f.engine.create(f.get());assert.equal(f.writes.length,0);}
 const f=fixture();const original=f.google.create;f.google.create=async(...args)=>{const r=await original(...args);if(args[1])f.setAuth(false);return r;};await f.engine.create(f.get());assert.equal(f.writes.length,0);
});
test('existing group with matching name is not adopted or changed by a new intent',async()=>{const f=fixture();f.setLive(feedback);const r=await f.engine.create(f.get());assert.equal(r.error_code,'publication_group_already_exists');assert.equal(f.writes.length,0);});
test('timed-out creation stays uncertain and is reconciled by reads without a duplicate create',async()=>{const f=fixture();f.google.create=async(p,v)=>{if(!v)throw new ControlProviderError('google_publication_transport_failed',true);return 'validation';};let r=await f.engine.create(f.get());assert.equal(r.state,'uncertain');await f.engine.create(r);assert.equal(f.writes.length,0);f.setLive({...feedback,approval:'UNKNOWN',review:'REVIEW_IN_PROGRESS'});r=await f.engine.monitor(f.get());assert.equal(r.state,'submitted');assert.equal(f.writes.length,0);});
test('only exact reviewed unrestricted approval allows activation; pending, limited and business rejection remain held',async()=>{
 for(const value of [{...feedback,review:'REVIEW_IN_PROGRESS'},{...feedback,approval:'APPROVED_LIMITED'},{...feedback,approval:'DISAPPROVED',topics:[{topic:'THIRD_PARTY_TECHNICAL_SUPPORT',type:'PROHIBITED'}]},{...feedback,approval:'APPROVED',topics:[{topic:'UNKNOWN',type:'LIMITED'}]}]){assert.equal(googleCleared(value),false);const f=fixture('submitted');f.setLive(value);await f.engine.monitor(f.get());assert.equal(f.writes.length,0);}
 const f=fixture('submitted');const r=await f.engine.monitor(f.get());assert.equal(r.state,'active');assert.deepEqual(f.writes,['ENABLED']);
});
test('Google approval or budget changing during validation prevents opening the group',async()=>{const f=fixture('submitted');const original=f.google.groupStatus;f.google.groupStatus=async(...args)=>{const r=await original(...args);if(args[2])f.setProblem('daily_allowance_reached');return r;};await f.engine.monitor(f.get());assert.equal(f.writes.length,0);});
test('only the confirmed new group is paused when stock is exhausted or allowance reached',async()=>{for(const problem of ['stock_unavailable','daily_allowance_reached','outside_campaign_schedule']){const f=fixture('active');f.setLive({...feedback,groupStatus:'ENABLED'});f.setProblem(problem);const r=await f.engine.monitor(f.get());assert.equal(r.state,'paused');assert.deepEqual(f.writes,['PAUSED']);}});
test('owner pause and global automation pause are respected',async()=>{const f=fixture('active');await f.engine.monitor(f.get());assert.equal(f.get().error_code,'owner_paused_group');assert.equal(f.writes.length,0);const g=fixture('submitted');g.setAuth(false);await g.engine.monitor(g.get());assert.equal(g.writes.length,0);});
test('provider validation errors do not create an ad and are stored as safe codes',async()=>{const f=fixture();f.google.create=async()=>{throw new ControlProviderError('google_publication_rejected',false,['POLICY_FINDING']);};const r=await f.engine.create(f.get());assert.equal(r.state,'failed');assert.match(r.error_code!,/POLICY_FINDING/);assert.equal(f.writes.length,0);});
test('REST adapter atomically validates the create-only plan and redacts provider body',async()=>{
 const calls:any[]=[];const g=createPublishingGoogle({accountId:account,token:async()=>'TEST_TOKEN',fetcher:async(url,init)=>{assert.match(String(url),/googleAds:mutate$/);const body=JSON.parse(String(init?.body));calls.push(body);return Response.json({});}});await g.create(plan,true);assert.equal(calls[0].partialFailure,false);assert.equal(calls[0].validateOnly,true);assert.equal(calls[0].mutateOperations.length,plan.keywords.length+2);
 const bad=createPublishingGoogle({accountId:account,token:async()=>'TEST_TOKEN',fetcher:async()=>Response.json({error:{message:'SECRET_BODY',status:'PERMISSION_DENIED'}},{status:403})});await assert.rejects(bad.create(plan,false),e=>{assert.doesNotMatch(String(e),/SECRET_BODY|TEST_TOKEN/);return true;});
});

test('activation requires presence-based local targeting and refuses countrywide or interest-only scope',()=>{
 assert.equal(localPublicationScope('PRESENCE',[{type:'LOCATION',name:'Sector 6',country:'RO'}]),true);
 assert.equal(localPublicationScope('PRESENCE',[{type:'LOCATION',name:'Romania',country:'RO'}]),false);
 assert.equal(localPublicationScope('PRESENCE_OR_INTEREST',[{type:'LOCATION',name:'Sector 6',country:'RO'}]),false);
 assert.equal(localPublicationScope('PRESENCE',[]),false);
 assert.equal(localPublicationScope('PRESENCE',[{type:'PROXIMITY',street:'Drumul Taberei 138',city:'Bucuresti',radius:2,units:'KILOMETERS'}]),true);
 assert.equal(localPublicationScope('PRESENCE',[{type:'PROXIMITY',street:'Drumul Taberei 138',city:'Bucuresti',radius:20,units:'KILOMETERS'}]),false);
});

test('policy-only restriction leaves eligible groups untouched even when paused or a stock/spend hold exists',async()=>{
 for(const state of ['active','paused','submitted'])for(const status of ['ENABLED','PAUSED']){
  const f=fixture(state);f.setLive({...feedback,groupStatus:status});f.setProblem('daily_allowance_reached');
  const engine=createPublicationEngine({...f.options,policyOnly:async()=>true});const result=await engine.monitor(f.get());
  assert.deepEqual(f.writes,[]);assert.equal(result.error_code,state==='active'&&status==='PAUSED'?'owner_paused_group':null);assert.equal(result.google_feedback?.groupStatus,status);assert.equal(feedbackFresh(result.google_feedback,now),true);
 }
});
test('policy-only monitoring never mutates limited, disapproved or pending-review groups',async()=>{
 for(const approval of ['DISAPPROVED','APPROVED_LIMITED','UNKNOWN']){
  const f=fixture('active');f.setLive({...feedback,approval,groupStatus:'ENABLED'});
  await createPublicationEngine({...f.options,policyOnly:async()=>true}).monitor(f.get());assert.deepEqual(f.writes,[]);
 }
});
test('policy-only restriction blocks unrelated new publications and rechecks before a status write',async()=>{
 const f=fixture();await createPublicationEngine({...f.options,policyOnly:async()=>true}).create(f.get());assert.deepEqual(f.trace,['saved:prepared']);assert.deepEqual(f.writes,[]);
 const g=fixture('submitted');let restricted=false;const original=g.google.groupStatus;
 g.google.groupStatus=async(...args)=>{const r=await original(...args);if(args[2])restricted=true;return r;};
 await createPublicationEngine({...g.options,policyOnly:async()=>restricted}).monitor(g.get());assert.deepEqual(g.writes,[]);
});
test('read-only policy checks retain owner-paused protection for later cycles',async()=>{
 const f=fixture('paused');f.setRow({error_code:'owner_paused_group'});await createPublicationEngine({...f.options,policyOnly:async()=>true}).monitor(f.get());
 assert.equal(f.get().error_code,'owner_paused_group');await f.engine.monitor(f.get());assert.deepEqual(f.writes,[]);
});
test('failed reads never renew cached policy evidence; quota failure stops the tick and preserves uncertainty',async()=>{
 const f=fixture('active'),old={...feedback,observedAt:new Date(now-3600000).toISOString()};f.setRow({google_feedback:old});
 f.google.inspect=async()=>{throw new ControlProviderError('google_publication_rejected',false,['RESOURCE_EXHAUSTED'],429);};
 await assert.rejects(f.engine.monitor(f.get()),ControlProviderError);assert.equal(feedbackFresh(f.get().google_feedback,now),false);assert.equal(f.get().google_feedback?.observedAt,old.observedAt);assert.deepEqual(f.writes,[]);
 assert.equal(feedbackFresh(feedback,now),false);assert.equal(feedbackFresh({...feedback,observedAt:new Date(now+60000).toISOString()},now),false);
 const g=fixture();g.google.create=async(_,validate)=>{if(!validate)throw new ControlProviderError('google_publication_rejected',true,['RESOURCE_EXHAUSTED'],429);return 'validation';};
 await assert.rejects(g.engine.create(g.get()),ControlProviderError);assert.equal(g.get().state,'uncertain');assert.equal(g.get().pending_operation,'create');
});
test('legacy publishing quota records no longer impose a site cooldown',()=>{
 assert.equal(quotaWait('google_ads_quota_cooldown',stamp,now),0);assert.equal(quotaWait('google_ads_quota_cooldown',stamp,now+1),0);assert.equal(quotaWait('publication_tick_incomplete',stamp,now),0);assert.equal(quotaWait('google_ads_quota_cooldown','invalid',now),0);
});
