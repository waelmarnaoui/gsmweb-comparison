import {ADS_REPORTING_VERSION} from '../ads-monitor';
import {ControlProviderError,safeGoogleCodes} from '../ads-control/google';
import {normal,type Range,type Report,type Change,type Metrics} from './model';
type Options={account:string;token:()=>Promise<string>;login?:string;developerToken?:string;fetcher?:typeof fetch};
const metricFields='metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.conversions_value';
function metrics(m:any):Metrics{const values=[Number(m?.clicks??0),Number(m?.impressions??0),Number(m?.costMicros??0)/1e6,Number(m?.conversions??0),Number(m?.conversionsValue??0)];if(values.some(v=>!Number.isFinite(v))||values.slice(0,4).some(v=>v<0))throw new Error('Invalid report metrics.');return {clicks:values[0],impressions:values[1],cost:values[2],conversions:values[3],value:values[4]};}
export function keywordGoogle(o:Options){
 if(!/^\d{10}$/.test(o.account)||o.login&&!/^\d{10}$/.test(o.login))throw new Error('Invalid Ads destination.');
 async function request(path:string,body:unknown,writing=false){
  let r:Response;try{r=await(o.fetcher??fetch)(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${o.account}${path.startsWith(':')?'':'/'}${path}`,{method:'POST',headers:{Authorization:'Bearer '+await o.token(),'Content-Type':'application/json',...(o.login?{'login-customer-id':o.login}:{}),...(o.developerToken?{'developer-token':o.developerToken}:{})},body:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new ControlProviderError('keyword_transport_failed',writing);}
  let data;try{data=await r.json();}catch{throw new ControlProviderError('keyword_response_invalid',writing);}
  if(!r.ok||data.error||data.partialFailureError)throw new ControlProviderError('keyword_request_rejected',writing&&(r.ok||r.status>=500||r.status===408),safeGoogleCodes(data),r.status);
  return data;
 }
 async function search(query:string){const rows:any[]=[],tokens=new Set<string>();let pageToken:string|undefined;
  for(let page=0;page<10;page++){const d=await request('googleAds:search',{query,...(pageToken?{pageToken}:{})});if(d.results!==undefined&&!Array.isArray(d.results))throw new Error('Incomplete report.');rows.push(...(d.results??[]));if(rows.length>20000)throw new Error('Report limit reached. Narrow the date range.');if(!d.nextPageToken)return rows;if(typeof d.nextPageToken!=='string'||tokens.has(d.nextPageToken))throw new Error('Incomplete pagination.');tokens.add(d.nextPageToken);pageToken=d.nextPageToken;}throw new Error('Report limit reached. Narrow the date range.');
 }
 const catalogue=()=>search("SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.quality_info.quality_score, ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.search_predicted_ctr, ad_group_criterion.quality_info.post_click_quality_score, ad_group.id, ad_group.name, campaign.name FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'");
 return {
  async ideas(seeds:string[],country:'RO'|'ALL'){
   const geo=country==='RO'?await search("SELECT geo_target_constant.resource_name FROM geo_target_constant WHERE geo_target_constant.country_code = 'RO' AND geo_target_constant.target_type = 'Country' AND geo_target_constant.status = 'ENABLED'"):[];
   if(country==='RO'&&geo.length!==1)throw new Error('Romania targeting could not be verified.');
   const rows:any[]=[],tokens=new Set<string>();let pageToken:string|undefined;
   for(let page=0;page<5;page++){const d=await request(':generateKeywordIdeas',{keywordSeed:{keywords:seeds},keywordPlanNetwork:'GOOGLE_SEARCH',includeAdultKeywords:false,geoTargetConstants:geo.map(r=>r.geoTargetConstant.resourceName),pageSize:1000,...(pageToken?{pageToken}:{})});if(d.results!==undefined&&!Array.isArray(d.results))throw new Error('Incomplete keyword ideas.');rows.push(...(d.results??[]));if(!d.nextPageToken)return {country,coverage:'Google Search estimates, all languages. Not a complete list of searches.',fetchedAt:new Date().toISOString(),rows:rows.map(r=>({text:r.text,averageMonthlySearches:r.keywordIdeaMetrics?.avgMonthlySearches===undefined?null:Number(r.keywordIdeaMetrics.avgMonthlySearches),competition:r.keywordIdeaMetrics?.competition??'UNKNOWN',monthly:r.keywordIdeaMetrics?.monthlySearchVolumes??[]}))};if(typeof d.nextPageToken!=='string'||tokens.has(d.nextPageToken))throw new Error('Incomplete idea pagination.');tokens.add(d.nextPageToken);pageToken=d.nextPageToken;}
   throw new Error('Too many ideas. Use more specific topics.');
  },
  async collect(range:Range):Promise<Report>{
   const date=`segments.date BETWEEN '${range.from}' AND '${range.to}'`;
   const account=(await search('SELECT customer.id, customer.currency_code, customer.time_zone FROM customer LIMIT 1'))[0]?.customer;
   if(String(account?.id)!==o.account||!account.currencyCode||!account.timeZone)throw new Error('Account identity could not be verified.');
   // Sequential bounded reads stop immediately on quota failures; no polling or retries.
   const terms=await search(`SELECT search_term_view.search_term, search_term_view.status, ad_group.id, ad_group.name, campaign.name, ${metricFields} FROM search_term_view WHERE ${date}`);
   const keywords=await catalogue(),stats=await search(`SELECT ad_group_criterion.resource_name, ${metricFields} FROM keyword_view WHERE ${date}`),byResource=new Map(stats.map(r=>[r.adGroupCriterion?.resourceName,metrics(r.metrics)]));
   const campaigns=await search(`SELECT campaign.id, campaign.name, campaign.status, ${metricFields} FROM campaign WHERE ${date}`);
   const ads=await search(`SELECT ad_group_ad.resource_name, ad_group_ad.ad.id, ad_group_ad.status, ad_group.name, campaign.name, ${metricFields} FROM ad_group_ad WHERE ${date}`);
   const groups=await search("SELECT ad_group.id, ad_group.name, campaign.name FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED' AND campaign.advertising_channel_type = 'SEARCH'");
   return {account:o.account,currency:account.currencyCode,timeZone:account.timeZone,range,fetchedAt:new Date().toISOString(),terms:terms.map(r=>({term:String(r.searchTermView?.searchTerm??''),status:String(r.searchTermView?.status??''),groupId:String(r.adGroup?.id??''),group:String(r.adGroup?.name??''),campaign:String(r.campaign?.name??''),...metrics(r.metrics)})),keywords:keywords.map(r=>{const k=r.adGroupCriterion,q=k.qualityInfo;return {resource:k.resourceName,text:k.keyword.text,matchType:k.keyword.matchType,status:k.status,groupId:String(r.adGroup.id),group:r.adGroup.name,campaign:r.campaign.name,quality:Number.isInteger(q?.qualityScore)&&q.qualityScore>=1&&q.qualityScore<=10?q.qualityScore:null,expectedCtr:q?.searchPredictedCtr??'UNKNOWN',relevance:q?.creativeQualityScore??'UNKNOWN',landingPage:q?.postClickQualityScore??'UNKNOWN',...(byResource.get(k.resourceName)??metrics(null))};}),campaigns:campaigns.map(r=>({id:String(r.campaign.id),name:r.campaign.name,status:r.campaign.status,...metrics(r.metrics)})),ads:ads.map(r=>({id:r.adGroupAd.resourceName,name:r.campaign.name+' / '+r.adGroup.name+' / Ad '+r.adGroupAd.ad.id,status:r.adGroupAd.status,...metrics(r.metrics)})),groups:groups.map(r=>({id:String(r.adGroup.id),name:r.adGroup.name,campaign:r.campaign.name}))};
  },
  async plan(change:Change){
   const existing=await catalogue();
   if(change.kind==='create'){
    const groups=await search(`SELECT ad_group.id, ad_group.status, campaign.status, campaign.advertising_channel_type FROM ad_group WHERE ad_group.id = ${change.groupId}`);
    if(groups.length!==1||!['ENABLED','PAUSED'].includes(groups[0].adGroup?.status)||!['ENABLED','PAUSED'].includes(groups[0].campaign?.status)||groups[0].campaign?.advertisingChannelType!=='SEARCH')throw new Error('Choose an available Search ad group.');
    if(change.terms.some(t=>existing.some(r=>String(r.adGroup.id)===change.groupId&&normal(r.adGroupCriterion.keyword.text)===normal(t)&&r.adGroupCriterion.keyword.matchType===change.matchType)))throw new Error('A selected keyword already exists with this match type. Refresh and remove duplicates.');
    return change.terms.map(text=>({create:{adGroup:`customers/${o.account}/adGroups/${change.groupId}`,status:change.status,keyword:{text,matchType:change.matchType}}}));
   }
   if(change.resources.some(resource=>!resource.startsWith(`customers/${o.account}/adGroupCriteria/`)||!existing.some(r=>r.adGroupCriterion.resourceName===resource)))throw new Error('Keyword state changed or is outside this account. Refresh before changing it.');
   return change.resources.map(resource=>change.kind==='remove'?{remove:resource}:{update:{resourceName:resource,status:'PAUSED'},updateMask:'status'});
  },
  async mutate(operations:any[],validateOnly:boolean){const d=await request('adGroupCriteria:mutate',{operations,validateOnly,partialFailure:false},!validateOnly);if(!validateOnly&&(!Array.isArray(d.results)||d.results.length!==operations.length||d.results.some((r:any,i:number)=>{
   const op=operations[i],resource=r?.resourceName;if(typeof resource!=='string'||!new RegExp(`^customers/${o.account}/adGroupCriteria/\\d+~\\d+$`).test(resource))return true;
   return op.create?!resource.startsWith(op.create.adGroup.replace('/adGroups/','/adGroupCriteria/')+'~'):resource!==(op.remove||op.update?.resourceName);
  })))throw new ControlProviderError('keyword_receipt_unconfirmed',true);return {count:operations.length,resources:(d.results??[]).map((r:any)=>r.resourceName)};}
 };
}
