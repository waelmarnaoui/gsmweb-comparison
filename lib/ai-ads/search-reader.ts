import {ADS_REPORTING_VERSION} from '../ads-monitor';
import {ControlProviderError,safeGoogleCodes} from '../ads-control/google';
import {campaignOpen,safeSearchTerm,type SearchReport,type SearchCampaign,type Schedule,type SearchTerm} from './search-growth';
type Options={accountId:string;loginCustomerId?:string;developerToken?:string;token:()=>Promise<string>;fetcher?:typeof fetch;now?:()=>number};
const numeric=(v:unknown)=>typeof v==='string'&&/^\d{1,20}$/.test(v);
const metric=(v:unknown)=>{const s=String(v??'0');if(!/^\d+$/.test(s)||!Number.isSafeInteger(Number(s)))throw new Error('Invalid search metric.');return s;};
export function createSearchReader(o:Options){
 if(!/^\d{10}$/.test(o.accountId)||o.loginCustomerId&&!/^\d{10}$/.test(o.loginCustomerId))throw new Error('Invalid search reporting account.');
 return {async collect():Promise<SearchReport>{
  const token=await o.token(),deadline=AbortSignal.timeout(55000),now=o.now??Date.now;
  async function search(query:string){
   const rows:Record<string,any>[]=[],pages=new Set<string>();let pageToken:string|undefined;
   for(let page=0;page<10;page++){
    const r=await(o.fetcher??fetch)(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${o.accountId}/googleAds:search`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(o.developerToken?{'developer-token':o.developerToken}:{}),...(o.loginCustomerId?{'login-customer-id':o.loginCustomerId}:{})},body:JSON.stringify({query,...(pageToken?{pageToken}:{})}),redirect:'error',cache:'no-store',signal:AbortSignal.any([deadline,AbortSignal.timeout(12000)])});
    if(!r.ok){let body;try{body=await r.json();}catch{}throw new ControlProviderError('google_search_read_rejected',false,safeGoogleCodes(body),r.status);}
    const data=await r.json();if(data.error||data.partialFailureError||data.results!==undefined&&!Array.isArray(data.results))throw new Error('Incomplete search report.');
    rows.push(...(data.results??[]));if(rows.length>5000)throw new Error('Search reporting limit exceeded.');
    if(!data.nextPageToken)return rows;
    if(typeof data.nextPageToken!=='string'||pages.has(data.nextPageToken))throw new Error('Invalid search pagination.');pages.add(data.nextPageToken);pageToken=data.nextPageToken;
   }throw new Error('Search pagination limit exceeded.');
  }
  const identity=await search('SELECT customer.id, customer.currency_code, customer.time_zone FROM customer LIMIT 1'),account=identity[0]?.customer;
  if(identity.length!==1||String(account?.id)!==o.accountId||!/^\w{3}$/.test(account?.currencyCode??'')||typeof account.timeZone!=='string')throw new Error('Search reporting identity is unverified.');
  const date=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:account.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now()),get=(k:string)=>p.find(x=>x.type===k)!.value;return `${get('year')}-${get('month')}-${get('day')}`;};
  const end=date(),start=new Date(Date.parse(end+'T00:00:00Z')-6*86400000).toISOString().slice(0,10);
  const campaignRows=await search("SELECT campaign.id, campaign.name, campaign.status, campaign.start_date_time, campaign.end_date_time FROM campaign WHERE campaign.advertising_channel_type = 'SEARCH' AND campaign.status != 'REMOVED'");
  const campaigns:SearchCampaign[]=[],ids=new Set<string>();
  for(const row of campaignRows){const c=row.campaign,id=String(c?.id??'');if(!numeric(id)||ids.has(id)||!['ENABLED','PAUSED'].includes(c?.status))throw new Error('Invalid campaign identity.');ids.add(id);
   const calendar=(v:unknown)=>{if(v===undefined)return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)||!Number.isFinite(Date.parse(v.replace(' ','T')+'Z'))||new Date(v.replace(' ','T')+'Z').toISOString().slice(0,19).replace('T',' ')!==v)throw new Error('Invalid campaign dates.');return v;};
   campaigns.push({id,name:String(c.name??'').slice(0,200),status:c.status,startDate:calendar(c.startDateTime),endDate:calendar(c.endDateTime),schedule:[]});
  }
  const scheduleRows=await search("SELECT campaign.id, campaign_criterion.ad_schedule.day_of_week, campaign_criterion.ad_schedule.start_hour, campaign_criterion.ad_schedule.start_minute, campaign_criterion.ad_schedule.end_hour, campaign_criterion.ad_schedule.end_minute FROM campaign_criterion WHERE campaign_criterion.type = 'AD_SCHEDULE' AND campaign_criterion.status != 'REMOVED' AND campaign.advertising_channel_type = 'SEARCH' AND campaign.status != 'REMOVED'");
  const minute=(v:unknown)=>{const values:Record<string,number>={ZERO:0,FIFTEEN:15,THIRTY:30,FORTY_FIVE:45};if(typeof v!=='string'||values[v]===undefined)throw new Error('Unknown schedule minute.');return values[v];};
  for(const row of scheduleRows){const campaign=campaigns.find(c=>c.id===String(row.campaign?.id)),s=row.campaignCriterion?.adSchedule;if(!campaign||!s||!['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].includes(s.dayOfWeek))throw new Error('Campaign schedule incomplete.');
   const sh=Number(s.startHour??0),eh=Number(s.endHour??0);if(!Number.isInteger(sh)||!Number.isInteger(eh)||sh<0||sh>23||eh<0||eh>24)throw new Error('Invalid campaign schedule.');
   const schedule:Schedule={day:s.dayOfWeek,start:sh*60+minute(s.startMinute??'ZERO'),end:eh*60+minute(s.endMinute??'ZERO')};if(schedule.end<=schedule.start||schedule.end>1440)throw new Error('Invalid campaign schedule.');campaign.schedule.push(schedule);
  }
  const active=campaigns.filter(c=>campaignOpen(c,account.timeZone,now())),terms:SearchTerm[]=[];let privacyFiltered=0;
  if(active.length){
   const rows=await search(`SELECT campaign.id, ad_group.id, search_term_view.resource_name, search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros FROM search_term_view WHERE segments.date BETWEEN '${start}' AND '${end}' AND campaign.advertising_channel_type = 'SEARCH' AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'`),seen=new Set<string>();
   for(const row of rows){const campaignId=String(row.campaign?.id??''),adGroupId=String(row.adGroup?.id??''),term=row.searchTermView?.searchTerm,resource=row.searchTermView?.resourceName;
    if(!ids.has(campaignId)||!numeric(adGroupId)||typeof resource!=='string'||!resource.startsWith(`customers/${o.accountId}/searchTermViews/${campaignId}~${adGroupId}~`)||seen.has(resource))throw new Error('Search row identity incomplete.');seen.add(resource);
    if(!safeSearchTerm(term)){privacyFiltered++;continue;}
    terms.push({campaignId,adGroupId,term,clicks:Number(metric(row.metrics?.clicks)),impressions:Number(metric(row.metrics?.impressions)),costMicros:metric(row.metrics?.costMicros)});
   }
  }
  if(date()!==end)throw new Error('Account date changed during search collection.');
  return {accountId:o.accountId,currency:account.currencyCode,timeZone:account.timeZone,fetchedAt:new Date(now()).toISOString(),windowStart:start,windowEnd:end,campaigns,terms,privacyFiltered,complete:true,termsCollected:active.length>0};
 }};
}
