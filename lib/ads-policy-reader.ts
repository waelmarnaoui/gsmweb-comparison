import {ADS_REPORTING_VERSION} from './ads-monitor';
import {ControlProviderError,safeGoogleCodes} from './ads-control/google';
export type AdPolicyRecord={resourceName:string;campaignId:string;adGroupId:string;adId:string;status:string;approvalStatus:string;reviewStatus:string;topics:{topic:string;type:string}[];headlines:string[];descriptions:string[]};
export type AdPolicyReport={accountId:string;fetchedAt:string;ads:AdPolicyRecord[];source:'google_ads_api';complete:true};
type Options={accountId:string;loginCustomerId?:string;developerToken?:string;token:()=>Promise<string>;fetcher?:typeof fetch;now?:()=>number};
const validId=(value:unknown)=>typeof value==='string'&&/^\d{1,20}$/.test(value);
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
export function createAdPolicyReader(options:Options){
 if(!/^\d{10}$/.test(options.accountId)||options.loginCustomerId&&!/^\d{10}$/.test(options.loginCustomerId))throw new Error('Invalid Google Ads account.');
 return {async collect():Promise<AdPolicyReport>{
  const token=await options.token(),ads:AdPolicyRecord[]=[],resources=new Set<string>(),pages=new Set<string>(),deadline=AbortSignal.timeout(45000);let pageToken:string|undefined;
  for(let page=0;page<20;page++){
   const response=await (options.fetcher??fetch)(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${options.accountId}/googleAds:search`,{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.developerToken?{'developer-token':options.developerToken}:{}),...(options.loginCustomerId?{'login-customer-id':options.loginCustomerId}:{})},
    body:JSON.stringify({query:"SELECT campaign.id, ad_group.id, ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.policy_summary.policy_topic_entries FROM ad_group_ad WHERE campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND ad_group_ad.status != 'REMOVED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'",...(pageToken?{pageToken}:{})}),
    cache:'no-store',redirect:'error',signal:AbortSignal.any([deadline,AbortSignal.timeout(15000)])
   });
   if(!response.ok){let body:unknown;try{body=await response.json();}catch{}throw new ControlProviderError('google_policy_read_rejected',false,safeGoogleCodes(body),response.status);}
   const data=await response.json();if(data.error||data.partialFailureError||data.results!==undefined&&!Array.isArray(data.results))throw new Error('Incomplete Google policy report.');
   for(const row of data.results??[]){
    const item=row.adGroupAd,ad=item?.ad,summary=item?.policySummary,resource=item?.resourceName,campaignId=String(row.campaign?.id??''),adGroupId=String(row.adGroup?.id??''),adId=String(ad?.id??'');
    if(!validId(campaignId)||!validId(adGroupId)||!validId(adId)||resource!==`customers/${options.accountId}/adGroupAds/${adGroupId}~${adId}`||resources.has(resource))throw new Error('Invalid or duplicate ad identity.');
    resources.add(resource);
    const copy=(values:unknown,max:number)=>{
     if(values===undefined)return [];
     if(!Array.isArray(values)||values.length>15||values.some(v=>!v||!text(v.text,max)))throw new Error('Malformed Google ad copy.');
     return values.map(v=>v.text as string);
    };
    const entries=summary?.policyTopicEntries??[];
    if(!Array.isArray(entries)||entries.length>100||entries.some(t=>!text(t?.topic,200)||!text(t?.type,80)))throw new Error('Malformed Google policy topics.');
    const enumValue=(value:unknown)=>text(value,80)&&/^[A-Z_]+$/.test(value as string)?value as string:'UNKNOWN';
    ads.push({resourceName:resource,campaignId,adGroupId,adId,status:enumValue(item.status),approvalStatus:enumValue(summary?.approvalStatus),reviewStatus:enumValue(summary?.reviewStatus),topics:entries.map(t=>({topic:t.topic,type:t.type})),headlines:copy(ad?.responsiveSearchAd?.headlines,400),descriptions:copy(ad?.responsiveSearchAd?.descriptions,1000)});
    if(ads.length>1000)throw new Error('Policy report exceeds the supported ad limit; no partial report accepted.');
   }
   if(!data.nextPageToken)return {accountId:options.accountId,fetchedAt:new Date((options.now??Date.now)()).toISOString(),ads,source:'google_ads_api',complete:true};
   if(typeof data.nextPageToken!=='string'||pages.has(data.nextPageToken))throw new Error('Invalid Google policy pagination.');pages.add(data.nextPageToken);pageToken=data.nextPageToken;
  }
  throw new Error('Google policy pagination limit reached.');
 }};
}
