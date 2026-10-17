import {ADS_REPORTING_VERSION} from '../ads-monitor';
import {ControlProviderError,safeGoogleCodes} from '../ads-control/google';
import {creationOperations,localPublicationScope,type PublicationPlan,type PublicationFeedback} from './publishing';
type Options={accountId:string;token:()=>Promise<string>;developerToken?:string;loginCustomerId?:string;fetcher?:typeof fetch;signal?:AbortSignal};
export function createPublishingGoogle(o:Options){
 if(!/^\d{10}$/.test(o.accountId)||o.loginCustomerId&&!/^\d{10}$/.test(o.loginCustomerId))throw new Error('publishing_account_invalid');
 async function request(path:string,body:unknown,writing=false){
  let r:Response;try{r=await(o.fetcher??fetch)(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${o.accountId}/${path}`,{method:'POST',headers:{Authorization:'Bearer '+await o.token(),'Content-Type':'application/json',...(o.developerToken?{'developer-token':o.developerToken}:{}),...(o.loginCustomerId?{'login-customer-id':o.loginCustomerId}:{})},body:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.any([AbortSignal.timeout(12000),...(o.signal?[o.signal]:[])])});}catch{throw new ControlProviderError('google_publication_transport_failed',writing);}
  let data;try{data=await r.json();}catch{throw new ControlProviderError('google_publication_response_invalid',writing);}
  if(!r.ok||data.error||data.partialFailureError)throw new ControlProviderError('google_publication_rejected',writing&&(r.status>=500||r.status===408||r.ok),safeGoogleCodes(data),r.status);
  return {data,requestId:r.headers.get('request-id')};
 }
 async function search(query:string){const {data}=await request('googleAds:search',{query});if(data.nextPageToken||data.results!==undefined&&!Array.isArray(data.results))throw new Error('publication_read_incomplete');return data.results??[];}
 const resource=(value:unknown,kind:'adGroups'|'adGroupAds')=>{if(typeof value!=='string'||!new RegExp(`^customers/${o.accountId}/${kind}/${kind==='adGroups'?'[0-9]{1,20}':'[0-9]{1,20}~[0-9]{1,20}'}$`).test(value))throw new Error('publication_resource_invalid');return value;};
 return {
  async campaign(id:string){if(!/^\d{1,20}$/.test(id))throw new Error('campaign_identity_invalid');const rows=await search(`SELECT campaign.id, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type FROM campaign WHERE campaign.id = ${id} LIMIT 2`);const c=rows[0]?.campaign;if(rows.length!==1||String(c?.id)!==id||c.advertisingChannelType!=='SEARCH'||c.status!=='ENABLED')throw new Error('campaign_unavailable');return String(c.biddingStrategyType??'UNKNOWN');},
  async localTargeting(id:string){
   if(!/^\d{1,20}$/.test(id))throw new Error('campaign_identity_invalid');
   const campaign=await search(`SELECT campaign.geo_target_type_setting.positive_geo_target_type FROM campaign WHERE campaign.id = ${id} LIMIT 2`);if(campaign.length!==1)return false;
   const rows=await search(`SELECT campaign_criterion.type, campaign_criterion.negative, campaign_criterion.location.geo_target_constant, campaign_criterion.proximity.address.street_address, campaign_criterion.proximity.address.city_name, campaign_criterion.proximity.radius, campaign_criterion.proximity.radius_units FROM campaign_criterion WHERE campaign.id = ${id} AND campaign_criterion.status = 'ENABLED' AND campaign_criterion.type IN ('LOCATION','PROXIMITY','LOCATION_GROUP') LIMIT 1001`);
   if(rows.length>1000)return false;const scopes=rows.filter((r:any)=>!r.campaignCriterion?.negative).map((r:any)=>r.campaignCriterion),locations=scopes.filter((s:any)=>s.type==='LOCATION').map((s:any)=>s.location?.geoTargetConstant);
   if(locations.some((r:unknown)=>typeof r!=='string'||!/^geoTargetConstants\/\d+$/.test(r)))return false;
   const names=locations.length?await search(`SELECT geo_target_constant.resource_name, geo_target_constant.name, geo_target_constant.country_code FROM geo_target_constant WHERE geo_target_constant.resource_name IN (${locations.map((n:string)=>`'${n}'`).join(',')}) LIMIT 1001`):[];
   if(names.length!==new Set(locations).size)return false;
   return localPublicationScope(campaign[0]?.campaign?.geoTargetTypeSetting?.positiveGeoTargetType??'UNKNOWN',scopes.map((s:any)=>{const l=names.find((n:any)=>n.geoTargetConstant?.resourceName===s.location?.geoTargetConstant)?.geoTargetConstant;return {type:s.type,name:l?.name,country:l?.countryCode,street:s.proximity?.address?.streetAddress,city:s.proximity?.address?.cityName,radius:Number(s.proximity?.radius),units:s.proximity?.radiusUnits};}));
  },
  async inspect(p:PublicationPlan):Promise<PublicationFeedback|null>{
   if(p.account!==o.accountId||!/^[a-f0-9]{64}$/.test(p.key))throw new Error('publication_identity_invalid');
   const name=p.groupName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
   const rows=await search(`SELECT ad_group.resource_name, ad_group.name, ad_group.status, ad_group.campaign FROM ad_group WHERE ad_group.name = '${name}' AND ad_group.status != 'REMOVED' LIMIT 2`);
   if(!rows.length)return null;const g=rows[0]?.adGroup;if(rows.length!==1||g?.name!==p.groupName||g.campaign!==`customers/${o.accountId}/campaigns/${p.campaignId}`)throw new Error('publication_group_conflict');const group=resource(g.resourceName,'adGroups');
   const ads=await search(`SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.policy_summary.policy_topic_entries FROM ad_group_ad WHERE ad_group.resource_name = '${group}' AND ad_group_ad.status != 'REMOVED' LIMIT 2`);
   if(ads.length!==1)throw new Error('publication_ad_conflict');const a=ads[0]?.adGroupAd,ad=resource(a?.resourceName,'adGroupAds');if(ad.split('/').pop()!.split('~')[0]!==group.split('/').pop())throw new Error('publication_ad_conflict');
   const expected=(texts:string[],pins:{text:string;field:string}[]|undefined)=>texts.map(text=>({text,pinnedField:pins?.find(p=>p.text===text)?.field??'UNSPECIFIED'}));
   const actual=(assets:{text:string;pinnedField?:string}[])=>assets?.map(x=>({text:x.text,pinnedField:x.pinnedField??'UNSPECIFIED'}));
   if(JSON.stringify(a.ad?.finalUrls)!==JSON.stringify([p.draft.landingUrl])||JSON.stringify(actual(a.ad?.responsiveSearchAd?.headlines))!==JSON.stringify(expected(p.draft.headlines,p.draft.pinnedHeadlines))||JSON.stringify(actual(a.ad?.responsiveSearchAd?.descriptions))!==JSON.stringify(expected(p.draft.descriptions,p.draft.pinnedDescriptions)))throw new Error('publication_copy_changed');
   const criteria=await search(`SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.negative, ad_group_criterion.status FROM ad_group_criterion WHERE ad_group.resource_name = '${group}' AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED' LIMIT 20`);
   if(criteria.length!==p.keywords.length||criteria.some((x:any)=>x.adGroupCriterion?.negative||x.adGroupCriterion?.status!=='ENABLED'||x.adGroupCriterion?.keyword?.matchType!=='EXACT')||JSON.stringify(criteria.map((x:any)=>x.adGroupCriterion.keyword.text).sort())!==JSON.stringify([...p.keywords].sort()))throw new Error('publication_keywords_changed');
   const policy=a.policySummary;return {groupResource:group,adResource:ad,groupStatus:g.status,adStatus:a.status,approval:policy?.approvalStatus??'UNKNOWN',review:policy?.reviewStatus??'UNKNOWN',topics:(policy?.policyTopicEntries??[]).map((t:any)=>({topic:typeof t.topic==='string'?t.topic.slice(0,100):'UNKNOWN',type:typeof t.type==='string'?t.type.slice(0,50):'UNKNOWN'}))};
  },
  async create(p:PublicationPlan,validateOnly:boolean){if(p.account!==o.accountId)throw new Error('publication_identity_invalid');const operations=creationOperations(p),r=await request('googleAds:mutate',{mutateOperations:operations,partialFailure:false,validateOnly},!validateOnly);if(!validateOnly){const rows=r.data.mutateOperationResponses;if(!Array.isArray(rows)||rows.length!==operations.length)throw new ControlProviderError('google_publication_unconfirmed',true);resource(rows[0]?.adGroupResult?.resourceName,'adGroups');resource(rows.at(-1)?.adGroupAdResult?.resourceName,'adGroupAds');}return r.requestId;},
  async groupStatus(group:string,status:'ENABLED'|'PAUSED',validateOnly:boolean){resource(group,'adGroups');const r=await request('adGroups:mutate',{operations:[{update:{resourceName:group,status},updateMask:'status'}],partialFailure:false,validateOnly},!validateOnly);if(!validateOnly&&(r.data.results?.length!==1||r.data.results[0].resourceName!==group))throw new ControlProviderError('google_group_change_unconfirmed',true);return r.requestId;}
 };
}
