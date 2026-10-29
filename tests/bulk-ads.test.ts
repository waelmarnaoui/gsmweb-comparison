import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BULK_FAMILIES,BULK_SERVICES} from '../lib/bulk-ads/catalog';
import {prepareBulkDraft,assertBulkDraft,bulkCreateOperations,observedModel,serviceIntent} from '../lib/bulk-ads/drafts';
import {bulkGoogle} from '../lib/bulk-ads/google';
import {submitBulkGroup,type BulkRow} from '../lib/bulk-ads/engine';
import {ControlProviderError} from '../lib/ads-control/google';
import {validHeadline,headlineFallback,replacementKeyword} from '../lib/ai-ads/copy-rules';
import type {SearchReport} from '../lib/ai-ads/search-growth';
const account='2050434247',actor='owner';
function draft(){return prepareBulkDraft({family:'iphone',service:'battery',models:['iPhone 15 Pro Max','iPhone 15'],includeSuggestions:true},null);}
test('all 45 service/family combinations generate 3 valid ads with exact paired model keywords',()=>{
 for(const service of BULK_SERVICES)for(const family of BULK_FAMILIES){
  const d=prepareBulkDraft({family:family.id,service:service.id,models:[...family.models],includeSuggestions:true},null);assertBulkDraft(d);
  assert.equal(d.ads.length,3);assert.equal(d.uncoveredModels.length,0);assert.equal(d.keywords.length,family.models.length*2);assert.equal(new Set(d.ads.map(a=>JSON.stringify(a.headlines))).size,3);
  for(const ad of d.ads){assert.equal(ad.headlines.length,15);assert.ok(ad.headlines.every(validHeadline));assert.equal(new Set(ad.headlines.map(h=>headlineFallback(h).toLowerCase())).size,15);assert.ok(ad.headlines[0].startsWith('{KeyWord:'));assert.ok(ad.descriptions.every(d=>d.length<=90));}
  assert.ok(d.keywords.every(k=>k.matchType==='EXACT'&&replacementKeyword(k.text)&&family.models.includes(k.model as never)));
 }
});
test('no invented search evidence and no S/Pro/Max/A family leakage',()=>{
 assert.equal(observedModel('baterie iphone15 pro max'),'iPhone 15 Pro Max');assert.equal(observedModel('display samsung s23 ultra'),'Samsung Galaxy S23 Ultra');assert.equal(observedModel('display samsung a55'),'Samsung Galaxy A55');
 for(const term of ['display iphone 15 pro max si iphone 14','baterie 15','display iphone 15 0722123456','display iphone 15 ultra'])assert.equal(observedModel(term),null);
 assert.equal(serviceIntent('schimbare sticla display iphone 15'),'glass');assert.equal(serviceIntent('display iphone 15'),'display');assert.equal(serviceIntent('folie sticla iphone 15'),null);assert.equal(serviceIntent('baterie camera iphone 15'),null);
 const d=prepareBulkDraft({...draft().selection,includeSuggestions:false},null);assert.equal(d.keywords.length,0);assert.equal(d.uncoveredModels.length,2);assert.throws(()=>assertBulkDraft(d));
 assert.throws(()=>prepareBulkDraft({...draft().selection,models:['Samsung Galaxy A55']},null));
});
test('reported searches are ranked by real clicks, aggregated, and stay paired to the model/service',()=>{
 const terms=[{campaignId:'1',adGroupId:'2',term:'inlocuire baterie iphone 15 pro max',clicks:3,impressions:20,costMicros:'100'},{campaignId:'1',adGroupId:'3',term:'inlocuire baterie iphone 15 pro max',clicks:2,impressions:10,costMicros:'100'},{campaignId:'1',adGroupId:'2',term:'display iphone 15',clicks:10,impressions:100,costMicros:'100'},{campaignId:'1',adGroupId:'2',term:'baterie iphone 15',clicks:100,impressions:1000,costMicros:'100'}];
 const report={complete:true,termsCollected:true,terms,windowStart:'2026-09-20',windowEnd:'2026-10-19',fetchedAt:'2026-10-19T08:00:00Z'} as SearchReport;
 const d=prepareBulkDraft({...draft().selection,includeSuggestions:false},report);assert.equal(d.keywords.length,1);assert.equal(d.keywords[0].clicks,5);assert.equal(d.keywords[0].impressions,30);assert.equal(d.keywords[0].source,'google_search');assert.deepEqual(d.uncoveredModels,['iPhone 15']);
 const glass=prepareBulkDraft({family:'iphone',service:'glass',models:['iPhone 15'],includeSuggestions:true},null);assert.match(glass.ads[0].descriptions[0],/daca panoul si functia tactila/);assert.ok(!JSON.stringify(glass.ads).includes('mai ieftin'));assert.ok(!JSON.stringify(glass.ads).includes('original garantat'));
});
test('atomic Google payload creates one enabled group and at most three ads with EXACT keywords, never updates existing objects',()=>{
 const d=draft(),ops=bulkCreateOperations(account,'1',d,'MAXIMIZE_CONVERSIONS');assert.equal((ops[0] as any).adGroupOperation.create.status,'ENABLED');assert.equal(ops.filter(o=>'adGroupAdOperation' in o).length,3);assert.equal(ops.filter(o=>'adGroupCriterionOperation' in o).length,d.keywords.length);assert.doesNotMatch(JSON.stringify(ops),/updateMask|BROAD|PHRASE/);
 assert.throws(()=>bulkCreateOperations(account,'1',d,'MANUAL_CPC'));assert.equal((bulkCreateOperations(account,'1',d,'MANUAL_CPC','1000000')[0] as any).adGroupOperation.create.cpcBidMicros,'1000000');
 assert.throws(()=>bulkCreateOperations(account,'1',{...d,keywords:d.keywords.map(k=>({...k,matchType:'BROAD' as any}))},'MAXIMIZE_CONVERSIONS'));
});
function fixture(){
 let row={id:'group',account_id:account,actor,campaign_id:'1',family:'iphone',service:'battery',draft:draft(),content_hash:'hash',cpc_micros:null,state:'draft',version:0,result:null,error_code:null,created_at:''} as BulkRow;
 let fail:unknown=null,guard=0,writes=0,validations=0;const states:string[]=[];
 const input={actor,hash:'hash',confirmed:true,guard:async()=>{guard++;},uncertain:(e:unknown)=>e instanceof ControlProviderError&&e.uncertain,errorCode:()=> 'safe',quota:async()=>{},store:{lock:async()=> 'lock',unlock:async()=>{},fence:async()=>{},load:async()=>row,transition:async(before:BulkRow,state:string,patch={})=>{assert.equal(row.version,before.version);row={...row,...patch,state,version:row.version+1};states.push(state);return row;}},google:{validate:async()=>{validations++;},create:async()=>{assert.equal(row.state,'submitting');writes++;if(fail)throw fail;return {group:'new'};}}};
 return {input,states,get:()=>row,set:(patch:Partial<BulkRow>)=>{row={...row,...patch};},fail:(error:unknown)=>{fail=error;},counts:()=>({guard,writes,validations})};
}
test('only exact saved owner-approved preview may publish; duplicate press never resends',async()=>{
 const f=fixture();await submitBulkGroup(f.input);assert.deepEqual(f.states,['validating','submitting','submitted']);await submitBulkGroup(f.input);assert.equal(f.counts().writes,1);assert.equal(f.counts().guard,2);
 for(const patch of [{actor:'other'},{hash:'changed'},{confirmed:false}])await assert.rejects(submitBulkGroup({...fixture().input,...patch}));
});
test('uncertain writes remain reserved and cannot be automatically or manually replayed',async()=>{
 const f=fixture();f.fail(new ControlProviderError('timeout',true));await assert.rejects(submitBulkGroup(f.input));assert.equal(f.get().state,'uncertain');await submitBulkGroup(f.input);assert.equal(f.counts().writes,1);
 const rejected=fixture();rejected.fail(new ControlProviderError('quota',false,['RESOURCE_EXHAUSTED'],429));await assert.rejects(submitBulkGroup(rejected.input));assert.equal(rejected.get().state,'rejected');await assert.rejects(submitBulkGroup(rejected.input));assert.equal(rejected.counts().writes,1);
 const blocked=fixture();await assert.rejects(submitBulkGroup({...blocked.input,guard:async()=>{throw Error('paused');}}));assert.equal(blocked.counts().writes,0);
});
test('a missing final receipt preserves the durable intent, and a lost lease cannot write',async()=>{
 const f=fixture(),transition=f.input.store.transition;
 f.input.store.transition=async(row,state,patch)=>{if(state==='submitted')throw Error('storage unavailable');return transition(row,state,patch);};
 await assert.rejects(submitBulkGroup(f.input));assert.equal(f.get().state,'submitting');await submitBulkGroup(f.input);assert.equal(f.counts().writes,1);
 const lost=fixture();lost.input.store.fence=async()=>{throw Error('lease expired');};await assert.rejects(submitBulkGroup(lost.input));assert.equal(lost.counts().writes,0);
});
test('long observed keywords retain their exact text but never fall back to another model',()=>{
 const selection={family:'samsung-s' as const,service:'battery' as const,models:['Samsung Galaxy S20','Samsung Galaxy S23 Ultra'],includeSuggestions:true};
 const d=prepareBulkDraft(selection,null);assert.ok(d.keywords.some(k=>k.text==='inlocuire baterie Samsung Galaxy S23 Ultra'));
 for(const ad of d.ads)assert.equal(ad.headlines[0],'{KeyWord:Schimbare Baterie GSMWEB}');
 assert.equal(d.groupName,'AI Samsung S series batteries');
});
test('replacement intent is mandatory and enforced again on saved drafts before any Google operation',()=>{
 for(const word of ['inlocuire','schimbare','înlocuire'])assert.equal(replacementKeyword(word+' display iPhone 15'),true);
 for(const word of ['display iPhone 15','montaj display iPhone 15','pret display iPhone 15','inlocuiredisplay iPhone 15','vand display inlocuire iPhone 15'])assert.equal(replacementKeyword(word),false);
 const d=draft(),bad={...d,keywords:[{...d.keywords[0],text:'display iPhone 15'}]};
 assert.throws(()=>assertBulkDraft(bad),/inlocuire or schimbare/);
 assert.throws(()=>bulkCreateOperations(account,'1',bad,'MAXIMIZE_CONVERSIONS'));
 assert.throws(()=>assertBulkDraft({...d,version:'bulk-model-services-v1'}),/Review current/);
});
test('transport validates exact assets before one atomic write and returns only verified resources',async()=>{
 const requests:any[]=[];let phase=0;const row=fixture().get();
 const google=bulkGoogle({account,token:async()=> 'test',fetcher:async(_url,init)=>{const body=JSON.parse(String(init?.body));requests.push(body);if(body.query?.includes('FROM campaign'))return Response.json({results:[{campaign:{id:'1',status:'ENABLED',advertisingChannelType:'SEARCH',biddingStrategyType:'MAXIMIZE_CONVERSIONS'}}]});if(body.query)return Response.json({results:[]});if(body.validateOnly)return Response.json({});phase++;return Response.json({mutateOperationResponses:[{adGroupResult:{resourceName:`customers/${account}/adGroups/20`}},...row.draft.keywords.map(()=>({adGroupCriterionResult:{}})),...row.draft.ads.map((_,i)=>({adGroupAdResult:{resourceName:`customers/${account}/adGroupAds/20~${i+1}`}}))]});}});
 await google.validate(row);const receipt=await google.create(row);assert.equal(phase,1);assert.equal(receipt.groupStatus,'ENABLED');assert.deepEqual(requests.at(-1).mutateOperations,requests.at(-2).mutateOperations);assert.equal(requests.at(-1).partialFailure,false);
});
test('endpoint remains admin-only and same-origin, with no browser privileged keys',()=>{
 const api=readFileSync('app/api/ai-ads/bulk/route.ts','utf8'),server=readFileSync('lib/bulk-ads/server.ts','utf8'),client=readFileSync('components/bulk-ads-workspace.tsx','utf8');assert.match(api,/requireAdmin/);assert.match(api,/sameOrigin/);assert.match(api,/confirmed===true/);assert.doesNotMatch(server,/if\(config.global_paused\)|adsReadWait\(/);assert.match(server,/controlStore/);assert.match(client,/Publish this group/);assert.doesNotMatch(client,/SUPABASE_SERVICE|connectionToken|googleads.googleapis/);
});
