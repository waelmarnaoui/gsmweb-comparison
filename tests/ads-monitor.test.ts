import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdsObserver,reportingWindow,summarizeCampaign,type CampaignObservation} from '../lib/ads-monitor';
const campaign:CampaignObservation={id:'1',name:'Repairs',status:'ENABLED',strategy:'MANUAL_CPC',clicks:10,costMicros:'40000000',searchShare:null,topShare:null,absoluteTopShare:null,budgetLostShare:null,rankLostShare:null};
test('CPC target applies only in RON; zero clicks never reports free traffic',()=>{
 assert.equal(summarizeCampaign(campaign,'RON').targetState,'above_target');
 assert.equal(summarizeCampaign(campaign,'USD').targetState,'currency_mismatch');
 assert.equal(summarizeCampaign({...campaign,clicks:0},'RON').cpc,null);
 assert.equal(summarizeCampaign({...campaign,costMicros:'30000000'},'RON').targetState,'within_target');
 assert.equal(summarizeCampaign(campaign,'RON').executable,false);
});
test('report window follows account calendar across DST and UTC midnight',()=>{
 assert.deepEqual(reportingWindow(Date.parse('2026-10-25T23:30:00Z'),'Europe/Bucharest'),{start:'2026-10-19',end:'2026-10-25'});
 assert.deepEqual(reportingWindow(Date.parse('2026-10-25T23:30:00Z'),'America/Los_Angeles'),{start:'2026-10-18',end:'2026-10-24'});
});
function fixture(pages:unknown[]){
 const calls:{url:string;body:any}[]=[];
 const observer=createAdsObserver({accountId:'2050434247',loginCustomerId:'1234567890',token:async()=>'test-secret',now:()=>Date.parse('2026-10-16T12:00:00Z'),fetcher:async(url,init)=>{
  calls.push({url:String(url),body:JSON.parse(String(init?.body))});
  assert.equal(new Headers(init?.headers).get('login-customer-id'),'1234567890');
  return Response.json(pages.shift(),{headers:{'request-id':'test-request'}});
 }});
 return {observer,calls};
}
const account={results:[{customer:{id:'2050434247',currencyCode:'RON',timeZone:'Europe/Bucharest'}}]};
const row={campaign:{id:'1',name:'Repairs'},metrics:{clicks:'10',costMicros:'40000000',searchImpressionShare:0.0999,searchTopImpressionShare:0.65}};
test('collector follows pagination and only calls search, preserving missing/censored shares',async()=>{
 const {observer,calls}=fixture([account,{results:[row],nextPageToken:'next'},{results:[{...row,campaign:{id:'2'}}]},{results:[{customer:{id:'2050434247'},metrics:{costMicros:'12000000',clicks:'4'}}]}]);
 const report=await observer.collect();
 assert.equal(report.campaigns.length,2);assert.equal(report.campaigns[0].searchShare,null);assert.equal(report.campaigns[0].topShare,0.65);
 assert.equal(report.campaigns[0].rankLostShare,null);assert.equal(report.windowEnd,'2026-10-15');
 assert.ok(calls.every(c=>c.url.endsWith('/googleAds:search')));assert.equal(calls[2].body.pageToken,'next');
 assert.deepEqual(report.today,{date:'2026-10-16',costMicros:'12000000',clicks:4});
});
test('wrong account, repeated pages, duplicates and invalid metrics reject the entire report',async()=>{
 await assert.rejects(fixture([{results:[{customer:{id:'0000000000'}}]}]).observer.collect(),/identity/);
 await assert.rejects(fixture([account,{results:[row],nextPageToken:'x'},{nextPageToken:'x'}]).observer.collect(),/pagination/);
 await assert.rejects(fixture([account,{results:[row,row]}]).observer.collect(),/duplicate/);
 await assert.rejects(fixture([account,{results:[{...row,metrics:{clicks:'-1'}}]}]).observer.collect(),/metric/);
 await assert.rejects(fixture([account,{results:[{...row,metrics:{searchImpressionShare:1.1}}]}]).observer.collect(),/share/);
});
test('provider errors redact response content and no retry can mutate ads',async()=>{
 const observer=createAdsObserver({accountId:'2050434247',token:async()=>'secret',fetcher:async()=>new Response('private token',{status:403})});
 await assert.rejects(observer.collect(),error=>error instanceof Error&&error.message.includes('403')&&!error.message.includes('private token'));
 assert.throws(()=>createAdsObserver({accountId:'2050434247/other',token:async()=>''}),/ten-digit/);
});
