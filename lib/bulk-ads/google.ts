import {ADS_REPORTING_VERSION} from '../ads-monitor';
import {ControlProviderError,safeGoogleCodes} from '../ads-control/google';
import {bulkCreateOperations} from './drafts';
import type {BulkRow} from './engine';
type Options={account:string;token:()=>Promise<string>;loginCustomerId?:string;developerToken?:string;fetcher?:typeof fetch};
export function bulkGoogle(o:Options){
 if(!/^\d{10}$/.test(o.account)||o.loginCustomerId&&!/^\d{10}$/.test(o.loginCustomerId))throw new Error('Invalid Google account.');
 const plans=new Map<string,ReturnType<typeof bulkCreateOperations>>();
 async function request(path:string,body:unknown,writing=false){
  const token=await o.token();let r:Response;
  try{r=await(o.fetcher??fetch)(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${o.account}/${path}`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(o.loginCustomerId?{'login-customer-id':o.loginCustomerId}:{}),...(o.developerToken?{'developer-token':o.developerToken}:{})},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new ControlProviderError('google_bulk_transport_failed',writing);}
  let data;try{data=await r.json();}catch{throw new ControlProviderError('google_bulk_response_invalid',writing);}
  if(!r.ok||data.error||data.partialFailureError)throw new ControlProviderError('google_bulk_rejected',writing&&(r.status>=500||r.status===408||r.ok),safeGoogleCodes(data),r.status);
  return {data,requestId:r.headers.get('request-id')};
 }
 async function search(query:string){const r=await request('googleAds:search',{query});if(r.data.nextPageToken||r.data.results!==undefined&&!Array.isArray(r.data.results))throw new Error('Incomplete Google response.');return r.data.results??[];}
 return {
  async validate(row:BulkRow){
   if(row.account_id!==o.account||!/^\d{1,20}$/.test(row.campaign_id))throw new Error('Destination changed.');
   const rows=await search(`SELECT campaign.id, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type FROM campaign WHERE campaign.id = ${row.campaign_id} LIMIT 2`),c=rows[0]?.campaign;
   if(rows.length!==1||String(c?.id)!==row.campaign_id||c.advertisingChannelType!=='SEARCH'||!['ENABLED','PAUSED'].includes(c.status))throw new Error('Choose an available Search campaign.');
   const escaped=row.draft.groupName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
   const groups=await search(`SELECT ad_group.id FROM ad_group WHERE campaign.id = ${row.campaign_id} AND ad_group.name = '${escaped}' AND ad_group.status != 'REMOVED' LIMIT 2`);
   if(groups.length)throw new Error('An ad group with this name already exists. It was not changed.');
   const operations=bulkCreateOperations(o.account,row.campaign_id,row.draft,c.biddingStrategyType,row.cpc_micros);
   await request('googleAds:mutate',{mutateOperations:operations,partialFailure:false,validateOnly:true});plans.set(row.id,operations);
  },
  async create(row:BulkRow){
   const operations=plans.get(row.id);if(!operations)throw new Error('Validation is required.');plans.delete(row.id);
   const {data,requestId}=await request('googleAds:mutate',{mutateOperations:operations,partialFailure:false,validateOnly:false},true),responses=data.mutateOperationResponses;
   const group=responses?.[0]?.adGroupResult?.resourceName,ads=responses?.slice(-row.draft.ads.length).map((v:any)=>v.adGroupAdResult?.resourceName);
   if(!Array.isArray(responses)||responses.length!==operations.length||typeof group!=='string'||!new RegExp(`^customers/${o.account}/adGroups/\\d+$`).test(group)||ads.some((ad:unknown)=>typeof ad!=='string'||!ad.startsWith(`customers/${o.account}/adGroupAds/${group.split('/').at(-1)}~`)||!/^\d+$/.test(ad.split('~')[1])))throw new ControlProviderError('google_bulk_receipt_unconfirmed',true);
   return {groupResource:group,adResources:ads,requestId,groupStatus:'PAUSED',googleReview:'PENDING',notice:'Submitted to Google in a paused group. No spending was enabled.'};
  }
 };
}
