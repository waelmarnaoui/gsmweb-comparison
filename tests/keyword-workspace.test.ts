import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ratios,suggestions,advice,canonicalChange,rangeSchema,previousRange,organicTrendRows,monthlyTrend,type Report} from '../lib/keywords/model';
import {keywordGoogle} from '../lib/keywords/google';
const account='2050434247',resource=`customers/${account}/adGroupCriteria/1~2`;
test('organic missing prior rows and absent monthly volumes are not invented zeros',()=>{
 assert.equal(organicTrendRows([{keys:['new query'],clicks:5,impressions:20,ctr:.25,position:3}],[])[0].clickChange,null);
 assert.equal(monthlyTrend([{year:2026,month:'SEPTEMBER'}]).last,null);
 assert.equal(monthlyTrend([{year:2026,month:'SEPTEMBER',monthlySearches:'120'},{year:2026,month:'AUGUST',monthlySearches:'100'}]).change,20);
});
test('ranked keyword candidates require repair intent and real conversions, never fabricate volumes',()=>{
 const metric={clicks:20,impressions:200,cost:50,conversions:2,value:200};
 const r={terms:[{...metric,term:'schimbare baterie iphone',groupId:'1',status:'NONE'},{...metric,term:'display iphone',groupId:'1',status:'NONE'},{...metric,term:'inlocuire ecran samsung',groupId:'1',status:'NONE',conversions:0}],keywords:[]} as unknown as Report;
 assert.equal(suggestions(r).length,1);r.keywords=[{text:'schimbare baterie iphone',groupId:'1',matchType:'EXACT'} as any];assert.equal(suggestions(r).length,0);
 assert.equal(ratios({...metric,clicks:0,conversions:0}).cpa,null);
});
test('date ranges reject invalid calendars and compare equal-length previous periods',()=>{
 assert.equal(rangeSchema.safeParse({from:'2026-02-30',to:'2026-03-01'}).success,false);
 assert.equal(rangeSchema.safeParse({from:'2026-10-20',to:'2026-10-01'}).success,false);
 assert.deepEqual(previousRange({from:'2026-10-01',to:'2026-10-10'}),{from:'2026-09-21',to:'2026-09-30'});
});
test('manual keyword plans support all three match types and deduplicate exact input',()=>{
 for(const matchType of ['EXACT','PHRASE','BROAD'])assert.equal(canonicalChange({kind:'create',groupId:'1',matchType,status:'PAUSED',terms:['  Schimbare baterie ','schimbare baterie']}).kind,'create');
 assert.throws(()=>canonicalChange({kind:'create',groupId:"1' OR TRUE",matchType:'EXACT',status:'ENABLED',terms:['x']}));
});
test('expensive converting keywords are not automatically called waste and missing QS stays missing',()=>{
 const notes=advice({clicks:100,cost:1000,conversions:8,quality:null,expectedCtr:'UNKNOWN',relevance:'UNKNOWN',landingPage:'UNKNOWN'} as any);
 assert.match(notes[0],/Converting/);assert.match(notes.join(' '),/not supplied/);
});
function api(respond:(body:any,path:string)=>unknown){const calls:any[]=[];return {calls,google:keywordGoogle({account,token:async()=>'not-real',fetcher:async(url,init)=>{const body=JSON.parse(String(init?.body));calls.push({body,url:String(url)});return Response.json(respond(body,String(url)));}})};}
const catalogueRow={adGroupCriterion:{resourceName:resource,keyword:{text:'old keyword',matchType:'EXACT'},status:'ENABLED'},adGroup:{id:'1'}};
test('create/pause/remove target only reviewed account resources; create-only supports each match type',async()=>{
 const {google,calls}=api(body=>body.query?{results:body.query.includes('FROM ad_group WHERE')?[{adGroup:{id:'1',status:'ENABLED'},campaign:{status:'ENABLED',advertisingChannelType:'SEARCH'}}]:[catalogueRow]}:{results:[{resourceName:resource}]});
 for(const matchType of ['EXACT','PHRASE','BROAD'] as const){const ops=await google.plan({kind:'create',groupId:'1',matchType,status:'PAUSED',terms:['new repair']});assert.equal((ops[0] as any).create.keyword.matchType,matchType);assert.equal((ops[0] as any).create.status,'PAUSED');}
 await assert.rejects(google.plan({kind:'create',groupId:'1',matchType:'EXACT',status:'ENABLED',terms:['old keyword']}),/already exists/);
 const pause=await google.plan({kind:'pause',resources:[resource]});assert.equal((pause[0] as any).updateMask,'status');
 assert.deepEqual(await google.plan({kind:'remove',resources:[resource]}),[{remove:resource}]);
 await assert.rejects(google.plan({kind:'remove',resources:[resource.replace(account,'9999999999')]}),/outside/);
 await google.mutate(pause,true);assert.equal(calls.at(-1).body.validateOnly,true);assert.equal(calls.at(-1).body.partialFailure,false);
});
test('quota failure is sanitized and never retries or mutates',async()=>{
 let n=0;const g=keywordGoogle({account,token:async()=>'token',fetcher:async()=>{n++;return Response.json({error:{status:'RESOURCE_EXHAUSTED',message:'secret'}},{status:429});}});
 await assert.rejects(g.collect({from:'2026-10-01',to:'2026-10-10'}),(e:any)=>e.httpStatus===429&&!e.message.includes('secret'));assert.equal(n,1);
});
test('unconfirmed write receipts remain uncertain and provider rejection is never retried',async()=>{
 const bad=api(()=>({results:[{resourceName:'customers/9999999999/adGroupCriteria/1~2'}]}));
 await assert.rejects(bad.google.mutate([{update:{resourceName:resource,status:'PAUSED'},updateMask:'status'}],false),(e:any)=>e.uncertain===true);
 let calls=0;const g=keywordGoogle({account,token:async()=>'token',fetcher:async()=>{calls++;return Response.json({error:{status:'INVALID_ARGUMENT'}},{status:400});}});
 await assert.rejects(g.mutate([{remove:resource}],false),(e:any)=>e.uncertain===false);assert.equal(calls,1);
});
test('Keyword Planner uses Google Search and monthly estimates without implying full coverage',async()=>{
 const {google,calls}=api(()=>({results:[{text:'service gsm',keywordIdeaMetrics:{avgMonthlySearches:'100',monthlySearchVolumes:[{year:'2026',month:'SEPTEMBER',monthlySearches:'110'}]}}]}));
 const r=await google.ideas(['service gsm'],'ALL');assert.equal(r.rows[0].averageMonthlySearches,100);assert.equal(calls[0].body.keywordPlanNetwork,'GOOGLE_SEARCH');assert.match(calls[0].url,/customers\/2050434247:generateKeywordIdeas$/);assert.match(r.coverage,/Not a complete/);
});
