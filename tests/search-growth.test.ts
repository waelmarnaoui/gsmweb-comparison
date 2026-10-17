import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInventory,defaultInventoryRules} from '../lib/ai-ads/inventory';
import {campaignOpen,searchStockMatch,prepareSearchOpportunities,safeSearchTerm,type SearchReport,type SearchCampaign} from '../lib/ai-ads/search-growth';
import {createSearchReader} from '../lib/ai-ads/search-reader';
const now=Date.parse('2026-10-17T09:00:00Z'),stamp=new Date(now).toISOString(),account='2050434247';
function part(model='iPhone 15 Pro Max',quantity=2){return normalizeInventory('dmjunqbncyrinykbbmfk',[{id:model,name:'Display',sku:'s1',brand:'Apple',partCode:null,partType:'display',compatibleModels:[model],modelId:null,category:'PART',quality:'used',active:true,minStock:1,recommendedPrice:'100',updatedAt:stamp}],[{id:'lot',productId:model,quantityAvailable:quantity,unitCost:'50',costIncludesVat:true,updatedAt:stamp}],[],defaultInventoryRules,now)[0];}
const campaign:SearchCampaign={id:'1',name:'Local',status:'ENABLED',startDate:null,endDate:null,schedule:[{day:'SATURDAY',start:660,end:1140}]};
function report():SearchReport{return {accountId:account,currency:'USD',timeZone:'Europe/Bucharest',fetchedAt:stamp,windowStart:'2026-10-11',windowEnd:'2026-10-17',campaigns:[campaign],terms:[{campaignId:'1',adGroupId:'2',term:'inlocuire disolay iphone 15 pro max',impressions:10,clicks:2,costMicros:'1500000'}],privacyFiltered:0,complete:true,termsCollected:true};}
test('reported misspelling matches verified model and part, never a different variant',()=>{
 assert.equal(searchStockMatch('inlocuire disolay iphone 15 pro max',[part()])?.model,'iPhone 15 Pro Max');
 assert.equal(searchStockMatch('display iphone 15 pro max',[part('iPhone 15 Pro')]),null);
 assert.equal(searchStockMatch('display iphone 15 pro',[part()]),null);
 assert.equal(searchStockMatch('display iphone15 pro max',[part('Apple iPhone 15 Pro Max')])?.model,'Apple iPhone 15 Pro Max');
 assert.equal(searchStockMatch('display Samsung A14 5G',[part('Samsung A14')]),null);
 assert.equal(searchStockMatch('display iphone 15 SE',[part('iPhone 15')]),null);
 assert.equal(searchStockMatch('display iphone 15 pro max si iphone 14',[part(),part('iPhone 14')]),null);
});
test('zero stock, wrong part, irrelevant or sensitive search terms do not qualify',()=>{
 for(const q of ['baterie iphone 15 pro max','display baterie iphone 15 pro max','manual display iphone 15 pro max','display iphone 15 pro max 0722123456'])assert.equal(searchStockMatch(q,[part()]),null);
 assert.equal(searchStockMatch('display iphone 15 pro max',[part(undefined,0)]),null);
 assert.equal(searchStockMatch('display iphone 15 pro max',[{...part(),eligible:false,reasons:['below_minimum_stock']}]),null);
 assert.equal(safeSearchTerm('email@example.com'),false);
});
test('campaign working time uses account zone, exact boundaries and campaign dates',()=>{
 assert.equal(campaignOpen(campaign,'Europe/Bucharest',now),true);
 assert.equal(campaignOpen(campaign,'Europe/Bucharest',Date.parse('2026-10-17T16:00:00Z')),false);
 assert.equal(campaignOpen({...campaign,status:'PAUSED'},'Europe/Bucharest',now),false);
 assert.equal(campaignOpen({...campaign,startDate:'2026-10-17 12:01:00'},'Europe/Bucharest',now),false);
 assert.equal(campaignOpen({...campaign,endDate:'2026-10-17 11:59:59'},'Europe/Bucharest',now),false);
 assert.equal(campaignOpen({...campaign,schedule:[]},'Europe/Bucharest',now),true);
});
test('duplicate model evidence creates one factual blocked draft, no invented metrics',()=>{
 const r=report();r.terms.push({...r.terms[0],term:'display iphone 15 pro max'});const rows=prepareSearchOpportunities(r,[part()],now);assert.equal(rows.length,1);assert.equal(rows[0].clicks,4);assert.equal(rows[0].costMicros,'3000000');assert.equal(rows[0].draft.headlines.length,15);assert.equal(rows[0].draft.descriptions.length,4);assert.equal(rows[0].draft.policy.publishAllowed,false);assert.equal(rows[0].draft.searchVolume,null);assert.ok(rows[0].draft.keywords.every(k=>k.text.includes('iPhone 15 Pro Max')));
 assert.equal(prepareSearchOpportunities(r,[{...part(),observedAt:new Date(now-300001).toISOString()}],now).length,0);
 assert.throws(()=>prepareSearchOpportunities({...r,fetchedAt:new Date(now-900001).toISOString()},[part()],now),/stale/);
 assert.equal(prepareSearchOpportunities({...r,campaigns:[{...campaign,status:'PAUSED'}]},[part()],now).length,0);
});
function readerFixture(outside=false,fail=false){
 const queries:string[]=[];const fetcher:typeof fetch=async(url,init)=>{assert.match(String(url),/googleAds:search$/);assert.equal(init?.method,'POST');const query=JSON.parse(String(init?.body)).query;queries.push(query);assert.doesNotMatch(query,/mutate|INSERT|UPDATE|DELETE/);
 if(fail)return Response.json({error:{message:'DO_NOT_LEAK_TOKEN',details:[]}},{status:403});
 if(query.includes('FROM customer'))return Response.json({results:[{customer:{id:account,currencyCode:'USD',timeZone:'Europe/Bucharest'}}]});
 if(query.includes('FROM campaign_criterion'))return Response.json({results:[{campaign:{id:'1'},campaignCriterion:{adSchedule:{dayOfWeek:'SATURDAY',startHour:11,startMinute:'ZERO',endHour:19,endMinute:'ZERO'}}}]});
 if(query.includes('FROM campaign WHERE')){assert.match(query,/campaign.start_date_time/);return Response.json({results:[{campaign:{id:'1',name:'Local',status:outside?'PAUSED':'ENABLED',startDateTime:'2026-01-01 00:00:00',endDateTime:'2037-12-30 23:59:59'}}]});}
 return Response.json({results:[{campaign:{id:'1'},adGroup:{id:'2'},searchTermView:{resourceName:`customers/${account}/searchTermViews/1~2~term`,searchTerm:'display iphone 15 pro max'},metrics:{clicks:'2',impressions:'10',costMicros:'100'}}]});};return {queries,reader:createSearchReader({accountId:account,token:async()=>'test-token',fetcher,now:()=>now})};
}
test('Google reader uses only verified read operations and supported date-time fields',async()=>{const f=readerFixture(),r=await f.reader.collect();assert.equal(f.queries.length,4);assert.equal(r.terms.length,1);assert.equal(r.termsCollected,true);assert.equal(r.windowStart,'2026-10-11');});
test('no search-term fetch outside enabled campaign working time',async()=>{const f=readerFixture(true),r=await f.reader.collect();assert.equal(f.queries.length,3);assert.equal(r.termsCollected,false);assert.equal(r.terms.length,0);});
test('provider failure is not success and does not expose response text',async()=>{await assert.rejects(readerFixture(false,true).reader.collect(),e=>{assert.doesNotMatch(String(e),/DO_NOT_LEAK_TOKEN/);return true;});});
