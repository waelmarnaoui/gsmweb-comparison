import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createControlEngine,type ControlStore} from '../lib/ads-control/engine';
import {ControlProviderError,createControlGoogle,type ControlGoogle} from '../lib/ads-control/google';
import {CONTROL_VERSION,validAction,stockNeedsPause,stockControlReady,recoveryReady,type Action,type ControlSettings,type Mapping} from '../lib/ads-control/rules';
import {controlSchedulerAuthorized} from '../lib/ads-control/scheduler-auth';
const now=Date.parse('2026-10-16T12:00:00Z'),account='2050434247';
function fixture(overrides:Partial<Action>={}){
 let a:Action={id:'00000000-0000-0000-0000-000000000001',account_id:account,kind:'ad_status',resource_name:`customers/${account}/adGroupAds/1~2`,before_value:'ENABLED',after_value:'PAUSED',source:'owner',product_id:null,inventory_fingerprint:null,google_fingerprint:null,reason:'test',state:'approved',created_by:'owner',approved_by:'owner',created_at:new Date(now-1000).toISOString(),expires_at:new Date(now+600000).toISOString(),started_at:null,recovery_due_at:null,request_id:null,error_code:null,idempotency_key:'a'.repeat(64),...overrides};
 const settings:ControlSettings={account_id:account,stock_enabled:true,global_paused:false,protect_existing_ads:false,version:CONTROL_VERSION,approved_by:'owner',approved_at:new Date(now).toISOString()};
 const trace:string[]=[],writes:string[]=[],states:string[]=[];let value=a.before_value,time=now,locked=false,healthy=true;
 const store:ControlStore={lock:async()=>{if(locked)return null;locked=true;return 'lease';},unlock:async()=>{locked=false;},fence:async()=>{trace.push('fence');},settings:async()=>settings,action:async()=>({...a}),transition:async(before,state,patch={})=>{assert.equal(before.state,a.state);a={...a,...patch,state};trace.push('stored:'+state);states.push(state);return {...a};}};
 const google:ControlGoogle={read:async()=>({value,campaignId:'1',approvalStatus:'APPROVED',reviewStatus:'REVIEWED',topics:0,budgetShared:false}),mutate:async(kind,resource,next,validate)=>{trace.push(validate?'validate':'mutate');if(!validate){writes.push(next);value=next;}return {requestId:'google-request'};}};
 const options={store,google,preflight:async()=>{trace.push('preflight');},recoveryHealthy:async()=>healthy,now:()=>time};
 return {engine:createControlEngine(options),options,store,google,settings,trace,writes,states,get:()=>a,setValue:(v:string)=>{value=v;},setTime:(v:number)=>{time=v;},setHealthy:(v:boolean)=>{healthy=v;},lock:()=>{locked=true;}};
}
test('exact approval is durably claimed before an absolute mutation and read back',async()=>{
 const f=fixture();const a=await f.engine.execute(f.get().id);assert.equal(a.state,'confirmed');assert.equal(a.request_id,'google-request');assert.deepEqual(f.writes,['PAUSED']);assert.ok(f.trace.indexOf('stored:executing')<f.trace.indexOf('mutate'));assert.equal(f.trace.filter(t=>t==='preflight').length,2);
 await assert.rejects(f.engine.execute(a.id),/approval/);assert.equal(f.writes.length,1);
});
test('unapproved, expired, globally paused and unapproved stock actions never mutate',async()=>{
 for(const overrides of [{state:'proposed' as const},{expires_at:new Date(now-1).toISOString()}]){const f=fixture(overrides);try{await f.engine.execute(f.get().id);}catch{}assert.equal(f.writes.length,0);}
 const paused=fixture();paused.settings.global_paused=true;assert.equal((await paused.engine.execute(paused.get().id)).error_code,'automation_paused');assert.equal(paused.writes.length,0);
 const stock=fixture({source:'stock',approved_by:null});stock.settings.stock_enabled=false;assert.equal((await stock.engine.execute(stock.get().id)).state,'failed');assert.equal(stock.writes.length,0);
});
test('concurrent account actions cannot both enter the executor',async()=>{const f=fixture();f.lock();await assert.rejects(f.engine.execute(f.get().id),/Another/);assert.equal(f.writes.length,0);});
test('changed live state invalidates approval and does not claim success',async()=>{const f=fixture();f.setValue('PAUSED');const a=await f.engine.execute(f.get().id);assert.equal(a.state,'conflict');assert.equal(f.writes.length,0);});
test('a pause switch or stock sale during validation is checked before live mutation',async()=>{
 const f=fixture();const original=f.google.mutate;f.google.mutate=async(...args)=>{const r=await original(...args);f.settings.global_paused=true;return r;};assert.equal((await f.engine.execute(f.get().id)).state,'failed');assert.equal(f.writes.length,0);
 const s=fixture();let calls=0;s.options.preflight=async()=>{if(++calls===2)throw new Error('inventory_changed');};const engine=createControlEngine(s.options);assert.equal((await engine.execute(s.get().id)).error_code,'inventory_changed');assert.equal(s.writes.length,0);
});
test('lost fencing lease or unavailable durable intent prevents a live write',async()=>{
 const f=fixture();f.store.fence=async()=>{throw new Error('expired');};assert.equal((await f.engine.execute(f.get().id)).state,'failed');assert.equal(f.writes.length,0);
 const s=fixture();const transition=s.store.transition;s.store.transition=async(a,state,patch)=>{if(state==='executing')throw new Error('database down');return transition(a,state,patch);};await s.engine.execute(s.get().id);assert.equal(s.writes.length,0);
});
test('an ambiguous timeout remains uncertain and is reconciled without replay',async()=>{
 const f=fixture();f.google.mutate=async(kind,resource,next,validate)=>{if(validate)return {requestId:null};f.writes.push(next);f.setValue(next);throw new ControlProviderError('google_transport_failed',true);};
 const a=await f.engine.execute(f.get().id);assert.equal(a.state,'uncertain');assert.equal((await f.engine.reconcile(a.id)).state,'confirmed');assert.equal(f.writes.length,1);
});
test('provider rejection is failed and raw provider details are not stored',async()=>{
 const f=fixture();f.google.mutate=async()=>{throw new ControlProviderError('google_request_rejected');};const a=await f.engine.execute(f.get().id);assert.equal(a.state,'failed');assert.equal(a.error_code,'google_request_rejected');assert.equal(f.writes.length,0);
});
test('verification failure after an acknowledged mutation stays uncertain and recoverable',async()=>{
 const f=fixture({kind:'campaign_pause',resource_name:`customers/${account}/campaigns/1`}),read=f.google.read;
 f.google.read=async(...args)=>{if(f.writes.length)throw new ControlProviderError('google_request_rejected');return read(...args);};
 const a=await f.engine.execute(f.get().id);assert.equal(a.state,'uncertain');assert.ok(a.recovery_due_at);
 f.google.read=read;f.setTime(now+480001);assert.equal((await f.engine.recover(a.id)).state,'recovered');
});
test('new campaign pauses require a healthy independent recovery worker',async()=>{
 const f=fixture({kind:'campaign_pause',resource_name:`customers/${account}/campaigns/1`});f.setHealthy(false);const a=await f.engine.execute(f.get().id);assert.equal(a.error_code,'independent_recovery_unavailable');assert.equal(f.writes.length,0);
});
test('temporary campaign pause has a durable eight-minute deadline and recovers with automation off',async()=>{
 const f=fixture({kind:'campaign_pause',resource_name:`customers/${account}/campaigns/1`});const a=await f.engine.execute(f.get().id);assert.equal(Date.parse(a.recovery_due_at!),now+480000);assert.equal((await f.engine.recover(a.id)).state,'confirmed');
 f.settings.global_paused=true;f.settings.stock_enabled=false;f.setTime(now+480001);assert.equal((await f.engine.recover(a.id)).state,'recovered');assert.deepEqual(f.writes,['PAUSED','ENABLED']);
});
test('uncertain pause is recoverable and failed recovery stays visible for another recovery attempt',async()=>{
 const f=fixture({kind:'campaign_pause',resource_name:`customers/${account}/campaigns/1`,state:'uncertain',started_at:new Date(now-600000).toISOString(),recovery_due_at:new Date(now-120000).toISOString()});f.setValue('PAUSED');const read=f.google.read;f.google.read=async()=>{throw new Error('down');};assert.equal((await f.engine.recover(f.get().id)).error_code,'recovery_failed');f.google.read=read;assert.equal((await f.engine.recover(f.get().id)).state,'recovered');
});
test('ad restoration requires actual Google policy clearance',async()=>{
 const f=fixture({before_value:'PAUSED',after_value:'ENABLED'});f.google.read=async()=>({value:'PAUSED',campaignId:'1',approvalStatus:'APPROVED_LIMITED',reviewStatus:'REVIEWED',topics:1});assert.equal((await f.engine.execute(f.get().id)).error_code,'google_policy_not_clear');assert.equal(f.writes.length,0);
});
test('a reviewed restoration succeeds only while the exact ad evidence remains unchanged',async()=>{
 const hash='b'.repeat(64),f=fixture({before_value:'PAUSED',after_value:'ENABLED',google_fingerprint:hash});
 f.google.read=async()=>({value:f.writes.length?'ENABLED':'PAUSED',campaignId:'1',approvalStatus:'APPROVED',reviewStatus:'REVIEWED',topics:0,evidenceHash:hash});
 assert.equal((await f.engine.execute(f.get().id)).state,'confirmed');assert.deepEqual(f.writes,['ENABLED']);
 const changed=fixture({before_value:'PAUSED',after_value:'ENABLED',google_fingerprint:hash});let reads=0;
 changed.google.read=async()=>({value:'PAUSED',campaignId:'1',approvalStatus:'APPROVED',reviewStatus:'REVIEWED',topics:0,evidenceHash:++reads===1?hash:'c'.repeat(64)});
 assert.equal((await changed.engine.execute(changed.get().id)).error_code,'google_ad_changed');assert.equal(changed.writes.length,0);
});
test('only budget reductions, own-account resources and automatic ad pauses are accepted',()=>{
 const good=fixture().get();assert.throws(()=>validAction({...good,resource_name:'customers/9999999999/adGroupAds/1~2'}));assert.throws(()=>validAction({...good,source:'stock',before_value:'PAUSED',after_value:'ENABLED'}));
 const budget={...good,kind:'budget_decrease' as const,resource_name:`customers/${account}/campaignBudgets/3`,before_value:'50000000',after_value:'40000000'};validAction(budget);assert.throws(()=>validAction({...budget,after_value:'60000000'}));assert.throws(()=>validAction({...budget,after_value:'0'}));
});
test('shared budget mutation is blocked',async()=>{
 const f=fixture({kind:'budget_decrease',resource_name:`customers/${account}/campaignBudgets/3`,before_value:'50000000',after_value:'40000000'});f.google.read=async()=>({value:'50000000',campaignId:'',budgetShared:true});assert.equal((await f.engine.execute(f.get().id)).error_code,'shared_budget_not_supported');assert.equal(f.writes.length,0);
});
test('ordinary sales do not pause stock-qualified ads; material price/model/condition changes do',()=>{
 const p={eligible:true,partPriceBani:10000,quality:'new',models:['iPhone 13'],partType:'display'};
 const m:Mapping={account_id:account,resource_name:`customers/${account}/adGroupAds/1~2`,campaign_id:'1',product_id:'product',fingerprint:'a'.repeat(64),active:true,evidence:{...p}};assert.equal(stockNeedsPause(m,p),false);assert.equal(stockNeedsPause(m,{...p,partPriceBani:10999}),false);assert.equal(stockNeedsPause(m,{...p,partPriceBani:11000}),true);assert.equal(stockNeedsPause(m,{...p,eligible:false}),true);assert.equal(stockNeedsPause(m,{...p,quality:'used'}),true);assert.equal(stockNeedsPause(m,null),true);
});
test('health requires this release, the expected deployment identity and recent successful checks',()=>{
 const beats=[{role:'recovery' as const,deployment_id:'separate-host',version:CONTROL_VERSION,checked_at:new Date(now).toISOString(),ok:true}];assert.equal(recoveryReady(beats,'separate-host',now),true);assert.equal(recoveryReady(beats,'other',now),false);assert.equal(recoveryReady(beats,'separate-host',now+90001),false);
 assert.ok(stockControlReady(fixture().settings,[],undefined,true,now).length>0);
});
test('scheduler authentication rejects missing, short and wrong bearer secrets',()=>{
 const key='a'.repeat(40);assert.equal(controlSchedulerAuthorized('Bearer '+key,key),true);assert.equal(controlSchedulerAuthorized(key,key),false);assert.equal(controlSchedulerAuthorized('Bearer '+key,'short'),false);assert.equal(controlSchedulerAuthorized(null,key),false);
});
test('REST adapter uses narrow masks and validateOnly; never returns malformed success',async()=>{
 const calls:{url:string;body:Record<string,unknown>}[]=[];
 const google=createControlGoogle({accountId:account,developerToken:'test',token:async()=>'test',fetcher:async(url,init)=>{const body=JSON.parse(String(init?.body));calls.push({url:String(url),body});return Response.json(body.validateOnly?{}:{results:[{resourceName:`customers/${account}/adGroupAds/1~2`}]},{headers:{'request-id':'id'}});}});
 await google.mutate('ad_status',`customers/${account}/adGroupAds/1~2`,'PAUSED',true);await google.mutate('ad_status',`customers/${account}/adGroupAds/1~2`,'PAUSED');
 assert.equal(calls[0].body.validateOnly,true);assert.equal(calls[1].body.partialFailure,false);assert.deepEqual(calls[1].body.operations,[{update:{resourceName:`customers/${account}/adGroupAds/1~2`,status:'PAUSED'},updateMask:'status'}]);
 const malformed=createControlGoogle({accountId:account,developerToken:'test',token:async()=>'test',fetcher:async()=>Response.json({})});await assert.rejects(malformed.mutate('ad_status',`customers/${account}/adGroupAds/1~2`,'PAUSED'),e=>e instanceof ControlProviderError&&e.uncertain);
});
test('live ad reads enforce responsive Search scope and bind policy plus exact copy evidence',async()=>{
 const resource=`customers/${account}/adGroupAds/1~2`;
 const row={campaign:{id:'1',advertisingChannelType:'SEARCH'},adGroupAd:{resourceName:resource,status:'PAUSED',ad:{type:'RESPONSIVE_SEARCH_AD',responsiveSearchAd:{headlines:[{text:'Verified display'}],descriptions:[{text:'In-store installation'}]},finalUrls:['https://gsmweb.site/']},policySummary:{approvalStatus:'APPROVED',reviewStatus:'REVIEWED'}}};
 const provider=createControlGoogle({accountId:account,developerToken:'test',token:async()=>'test',fetcher:async()=>Response.json({results:[row]})});
 const state=await provider.read('ad_status',resource);assert.equal(state.approvalStatus,'APPROVED');assert.match(state.evidenceHash!,/^[a-f0-9]{64}$/);
 row.adGroupAd.ad.responsiveSearchAd.headlines[0].text='Changed copy';assert.notEqual((await provider.read('ad_status',resource)).evidenceHash,state.evidenceHash);
 row.campaign.advertisingChannelType='PERFORMANCE_MAX';await assert.rejects(provider.read('ad_status',resource),e=>e instanceof ControlProviderError&&e.code==='google_resource_outside_scope');
});

test('existing ad protection defaults closed and blocks every existing-resource mutation',async()=>{
 for(const protection of [true,undefined])for(const kind of ['ad_status','campaign_pause','budget_decrease'] as const){
  const extra=kind==='budget_decrease'?{resource_name:`customers/${account}/campaignBudgets/3`,before_value:'2000000',after_value:'1000000'}:kind==='campaign_pause'?{resource_name:`customers/${account}/campaigns/1`}:{};
  const f=fixture({kind,...extra});f.settings.protect_existing_ads=protection;const r=await f.engine.execute(f.get().id);assert.equal(r.error_code,'existing_ads_protected');assert.equal(f.writes.length,0);assert.equal(f.trace.includes('validate'),false);
 }
});
test('protection enabled during validation blocks the live write',async()=>{const f=fixture();const original=f.google.mutate;f.google.mutate=async(...args)=>{const r=await original(...args);if(args[3])f.settings.protect_existing_ads=true;return r;};const r=await f.engine.execute(f.get().id);assert.equal(r.error_code,'existing_ads_protected');assert.equal(f.writes.length,0);});
