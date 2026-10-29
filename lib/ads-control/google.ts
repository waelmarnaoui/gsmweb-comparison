import {ADS_REPORTING_VERSION} from '../ads-monitor';
import {resourceFor,actionKey,type Kind} from './rules';
export class ControlProviderError extends Error{constructor(public readonly code:string,public readonly uncertain=false,public readonly diagnostics:string[]=[],public readonly httpStatus?:number){super(code);}}
export function isGoogleQuotaError(error:unknown){return error instanceof ControlProviderError&&(error.httpStatus===429||error.diagnostics.some(code=>['RESOURCE_EXHAUSTED','RESOURCE_TEMPORARILY_EXHAUSTED','EXCESSIVE_SHORT_TERM_QUERY_RESOURCE_CONSUMPTION','EXCESSIVE_LONG_TERM_QUERY_RESOURCE_CONSUMPTION'].includes(code)));}
export function safeGoogleCodes(body:unknown){
 const data=body as {error?:{status?:unknown;details?:{errors?:{errorCode?:Record<string,unknown>}[]}[]}};
 const codes=new Set<string>(),add=(v:unknown)=>{if(typeof v==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(v))codes.add(v);};
 add(data?.error?.status);
 for(const detail of Array.isArray(data?.error?.details)?data.error.details.slice(0,10):[])for(const error of Array.isArray(detail?.errors)?detail.errors.slice(0,10):[]){
  for(const key of ['queryError','authenticationError','authorizationError','requestError','quotaError','internalError','fieldError','policyFindingError','policyValidationParameterError','adGroupAdError','adError','adGroupError','adGroupCriterionError','campaignError','campaignCriterionError','assetError','assetGroupError','assetGroupAssetError','assetGroupSignalError','customConversionGoalError','conversionGoalCampaignConfigError','biddingError','stringLengthError'])add(error?.errorCode?.[key]);
 }
 return [...codes].slice(0,8);
}
export type ResourceState={value:string;campaignId:string;approvalStatus?:string;reviewStatus?:string;topics?:number;budgetShared?:boolean;evidenceHash?:string};
export type ControlGoogle={read:(kind:Kind,resource:string)=>Promise<ResourceState>;mutate:(kind:Kind,resource:string,value:string,validateOnly?:boolean)=>Promise<{requestId:string|null}>};
type Options={accountId:string;developerToken?:string;loginCustomerId?:string;token:()=>Promise<string>;fetcher?:typeof fetch};
export type ControlCampaign={resourceName:string;name:string;status:string;budgetResource:string|null;budgetMicros:string|null;budgetEditable:boolean;shared:boolean};
export function createControlGoogle(o:Options):ControlGoogle&{campaigns:()=>Promise<ControlCampaign[]>}{
 resourceFor('campaign_pause',o.accountId,`customers/${o.accountId}/campaigns/1`);
 // Since 2026-09-09, access is attached to the OAuth Cloud project. The
 // deprecated developer-token header is optional and must not block control.
 if(o.loginCustomerId&&!/^\d{10}$/.test(o.loginCustomerId))throw new ControlProviderError('google_manager_account_invalid');
 async function request(path:string,body:unknown,writing=false){
  const token=await o.token();let response:Response;
  try{response=await(o.fetcher??fetch)(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${o.accountId}/${path}`,{method:'POST',headers:{Authorization:'Bearer '+token,...(o.developerToken?{'developer-token':o.developerToken}:{}),'Content-Type':'application/json',...(o.loginCustomerId?{'login-customer-id':o.loginCustomerId}:{})},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});}
  catch{throw new ControlProviderError('google_transport_failed',writing);}
  if(!response.ok){let body:unknown;try{body=await response.json();}catch{}throw new ControlProviderError(response.status===429?'google_rate_limited':response.status>=500?'google_unavailable':'google_request_rejected',writing&&response.status>=500,safeGoogleCodes(body),response.status);}
  let data;try{data=await response.json();}catch{throw new ControlProviderError('google_response_invalid',writing);}
  if(data.error||data.partialFailureError)throw new ControlProviderError('google_operation_rejected',writing);
  return {data,requestId:response.headers.get('request-id')};
 }
 return {
  async campaigns(){
   const {data}=await request('googleAds:search',{query:"SELECT campaign.resource_name, campaign.name, campaign.status, campaign.campaign_budget, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.reference_count FROM campaign WHERE campaign.status != 'REMOVED' AND campaign.advertising_channel_type = 'SEARCH' LIMIT 1001"});
   if(data.nextPageToken||data.results!==undefined&&!Array.isArray(data.results)||(data.results?.length??0)>1000)throw new ControlProviderError('campaign_scope_incomplete');
   const seen=new Set<string>();
   return (data.results??[]).map((row:{campaign?:{resourceName?:string;name?:string;status?:string;campaignBudget?:string};campaignBudget?:{amountMicros?:string;explicitlyShared?:boolean;referenceCount?:string}})=>{
    const c=row.campaign,b=row.campaignBudget;if(!c?.resourceName||seen.has(c.resourceName))throw new ControlProviderError('campaign_scope_incomplete');
    resourceFor('campaign_pause',o.accountId,c.resourceName);if(c.campaignBudget)resourceFor('budget_decrease',o.accountId,c.campaignBudget);seen.add(c.resourceName);
    if(!['PAUSED','ENABLED'].includes(c.status??''))throw new ControlProviderError('campaign_scope_incomplete');
    const amount=b?.amountMicros===undefined?null:String(b.amountMicros);
    if(amount!==null&&!/^\d{1,15}$/.test(amount))throw new ControlProviderError('campaign_budget_invalid');
    const shared=b?.explicitlyShared===true||String(b?.referenceCount)!=='1';
    return {resourceName:c.resourceName,name:String(c.name??''),status:c.status!,budgetResource:c.campaignBudget??null,budgetMicros:amount,budgetEditable:!!c.campaignBudget&&amount!==null&&BigInt(amount)>0n&&!shared,shared};
   });
  },
  async read(kind,resource){
   resourceFor(kind,o.accountId,resource);
   const field=kind==='ad_status'?'ad_group_ad':kind==='campaign_pause'?'campaign':'campaign_budget';
   const fields=kind==='ad_status'?'ad_group_ad.resource_name, ad_group_ad.status, campaign.id, campaign.advertising_channel_type, ad_group_ad.ad.type, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.final_urls, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.policy_summary.policy_topic_entries':kind==='campaign_pause'?'campaign.resource_name, campaign.status, campaign.id':'campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.reference_count';
   const {data}=await request('googleAds:search',{query:`SELECT ${fields} FROM ${field} WHERE ${field}.resource_name = '${resource}'`});
   if(data.nextPageToken||!Array.isArray(data.results)||data.results.length!==1)throw new ControlProviderError('google_resource_unconfirmed');
   const row=data.results[0],entity=kind==='ad_status'?row.adGroupAd:kind==='campaign_pause'?row.campaign:row.campaignBudget;
   if(entity?.resourceName!==resource)throw new ControlProviderError('google_identity_mismatch');
   if(kind==='ad_status'&&(entity.ad?.type!=='RESPONSIVE_SEARCH_AD'||row.campaign?.advertisingChannelType!=='SEARCH'))throw new ControlProviderError('google_resource_outside_scope');
   const value=String(kind==='budget_decrease'?entity.amountMicros:entity.status);
   if(kind==='budget_decrease'?!/^[1-9]\d{0,14}$/.test(value):!['ENABLED','PAUSED'].includes(value))throw new ControlProviderError('google_state_unsupported');
   return {value,campaignId:String(row.campaign?.id??''),approvalStatus:entity.policySummary?.approvalStatus,reviewStatus:entity.policySummary?.reviewStatus,topics:entity.policySummary?.policyTopicEntries?.length??0,evidenceHash:kind==='ad_status'?actionKey({resource,ad:entity.ad,policy:entity.policySummary}):undefined,budgetShared:kind==='budget_decrease'&&(entity.explicitlyShared===true||String(entity.referenceCount)!=='1')};
  },
  async mutate(kind,resource,value,validateOnly=false){
   resourceFor(kind,o.accountId,resource);
   if(kind==='budget_decrease'?!/^[1-9]\d{0,14}$/.test(value):!['ENABLED','PAUSED'].includes(value))throw new Error('Invalid change value.');
   const path=kind==='ad_status'?'adGroupAds':kind==='campaign_pause'?'campaigns':'campaignBudgets';
   const field=kind==='budget_decrease'?'amount_micros':'status';
   const {data,requestId}=await request(path+':mutate',{operations:[{update:{resourceName:resource,...(kind==='budget_decrease'?{amountMicros:value}:{status:value})},updateMask:field}],partialFailure:false,validateOnly},!validateOnly);
   if(!validateOnly&&(!Array.isArray(data.results)||data.results.length!==1||data.results[0]?.resourceName!==resource))throw new ControlProviderError('google_mutation_unconfirmed',true);
   return {requestId};
  }
 };
}
