// Reporting only: this module deliberately exposes no Google Ads mutate method.
export const ADS_REPORTING_VERSION = 'v26';
export const TARGET_CPC_RON = 3;
export type CampaignObservation = {
 id:string; name:string; status:string; strategy:string; clicks:number; costMicros:string;
 searchShare:number|null; topShare:number|null; absoluteTopShare:number|null;
 budgetLostShare:number|null; rankLostShare:number|null;
};
export type AdsObservation = {
 accountId:string; currency:string; timeZone:string; windowStart:string; windowEnd:string;
 fetchedAt:string; campaigns:CampaignObservation[]; requestIds:string[];
 today?:{date:string;costMicros:string;clicks:number};
};
type Row = Record<string, any>;
type Options = {accountId:string; loginCustomerId?:string; developerToken?:string; token:()=>Promise<string>; fetcher?:typeof fetch; now?:()=>number};
function id(value:string){if(!/^\d{10}$/.test(value))throw new Error('Use a ten-digit Google Ads customer ID without separators.');return value;}
function integer(value:unknown):string{
 const result=String(value??'0');
 if(!/^\d+$/.test(result)||BigInt(result)>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Invalid or unsupported Ads metric.');
 return result;
}
function share(value:unknown):number|null{
 if(value===undefined||value===null)return null;
 const n=Number(value);if(!Number.isFinite(n)||n<0||n>1)throw new Error('Invalid impression share.');
 // Google uses values just below/above reporting limits as censored estimates.
 // Do not display these as precise observations or use them for safeguards.
 return n===0.0999||n===0.9001?null:n;
}
function calendarDay(timestamp:number,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(timestamp);
 const get=(name:string)=>parts.find(p=>p.type===name)!.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function reportingWindow(now:number,timeZone:string){
 const today=calendarDay(now,timeZone),midnight=Date.parse(today+'T00:00:00Z');
 return {start:new Date(midnight-7*86400000).toISOString().slice(0,10),end:new Date(midnight-86400000).toISOString().slice(0,10)};
}
export function summarizeCampaign(campaign:CampaignObservation,currency:string){
 const cpc=campaign.clicks>0?Number(campaign.costMicros)/1e6/campaign.clicks:null;
 return {cpc,targetCpc:currency==='RON'?TARGET_CPC_RON:null,
 targetState:currency!=='RON'?'currency_mismatch':cpc===null?'no_clicks':cpc>TARGET_CPC_RON?'above_target':'within_target',
 // CPC is an observation, not a sufficient basis for cutting bids.
 executable:false as const};
}
export function createAdsObserver(options:Options){
 const customer=id(options.accountId),login=options.loginCustomerId?id(options.loginCustomerId):undefined;
 const fetcher=options.fetcher??fetch,now=options.now??Date.now;
 return {async collect():Promise<AdsObservation>{
  const token=await options.token(),requestIds:string[]=[];
  async function search(query:string){
   const rows:Row[]=[],seen=new Set<string>();let pageToken:string|undefined;
   for(let page=0;page<20;page++){
    const response=await fetcher(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${customer}/googleAds:search`,{
     method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(login?{'login-customer-id':login}:{}),...(options.developerToken?{'developer-token':options.developerToken}:{})},
     body:JSON.stringify({query,...(pageToken?{pageToken}:{})}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)
    });
    const requestId=response.headers.get('request-id');if(requestId)requestIds.push(requestId);
    // Never forward a provider body: it may contain sensitive account data.
    if(!response.ok)throw new Error(`Google Ads reporting failed (${response.status}). Check authorization and API access.`);
    const data=await response.json();
    if(data.error||data.partialFailureError||(data.results!==undefined&&!Array.isArray(data.results)))throw new Error('Incomplete Google Ads response.');
    rows.push(...(data.results??[]));
    if(!data.nextPageToken)return rows;
    if(typeof data.nextPageToken!=='string'||seen.has(data.nextPageToken))throw new Error('Invalid Google Ads pagination.');
    seen.add(data.nextPageToken);pageToken=data.nextPageToken;
   }
   throw new Error('Reporting page limit reached; no partial report was saved.');
  }
  const accountRows=await search('SELECT customer.id, customer.currency_code, customer.time_zone FROM customer LIMIT 1');
  const account=accountRows[0]?.customer;
  if(accountRows.length!==1||String(account?.id)!==customer||!account?.currencyCode||!account?.timeZone)throw new Error('Google Ads account identity could not be verified.');
  const window=reportingWindow(now(),account.timeZone);
  const rows=await search(`SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, metrics.clicks, metrics.cost_micros, metrics.search_impression_share, metrics.search_top_impression_share, metrics.search_absolute_top_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM campaign WHERE campaign.advertising_channel_type = 'SEARCH' AND campaign.status != 'REMOVED' AND segments.date BETWEEN '${window.start}' AND '${window.end}'`);
  const seen=new Set<string>();
  const campaigns=rows.map(row=>{
   const c=row.campaign,m=row.metrics;
   if(!c?.id||!m||seen.has(String(c.id)))throw new Error('Incomplete or duplicate campaign report.');
   seen.add(String(c.id));
   return {id:String(c.id),name:String(c.name??''),status:String(c.status??'UNKNOWN'),strategy:String(c.biddingStrategyType??'UNKNOWN'),
    clicks:Number(integer(m.clicks)),costMicros:integer(m.costMicros),searchShare:share(m.searchImpressionShare),topShare:share(m.searchTopImpressionShare),
    absoluteTopShare:share(m.searchAbsoluteTopImpressionShare),budgetLostShare:share(m.searchBudgetLostImpressionShare),rankLostShare:share(m.searchRankLostImpressionShare)};
  });
  const day=calendarDay(now(),account.timeZone);
  const todayRows=await search(`SELECT customer.id, metrics.cost_micros, metrics.clicks FROM customer WHERE segments.date = '${day}'`);
  if(todayRows.length>1||todayRows.some(row=>String(row.customer?.id)!==customer||!row.metrics))throw new Error('Incomplete intraday account report.');
  const today={date:day,costMicros:integer(todayRows[0]?.metrics?.costMicros),clicks:Number(integer(todayRows[0]?.metrics?.clicks))};
  if(calendarDay(now(),account.timeZone)!==day)throw new Error('Account calendar changed during collection. Collect again.');
  return {accountId:customer,currency:account.currencyCode,timeZone:account.timeZone,windowStart:window.start,windowEnd:window.end,fetchedAt:new Date(now()).toISOString(),campaigns,requestIds,today};
 }};
}
