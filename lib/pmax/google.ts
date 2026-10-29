import {ADS_REPORTING_VERSION} from '../ads-monitor';
import {ControlProviderError,safeGoogleCodes} from '../ads-control/google';
import {pmaxOperations,type PmaxRow,type PmaxDraft} from './model';
export function pmaxGoogle(o:{account:string;token:()=>Promise<string>;login?:string;developerToken?:string;fetcher?:typeof fetch}){
 if(!/^\d{10}$/.test(o.account)||o.login&&!/^\d{10}$/.test(o.login))throw new Error('Invalid Google account.');
 async function request(path:string,body:unknown,write=false){
  let response:Response;try{response=await(o.fetcher??fetch)(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${o.account}/${path}`,{method:'POST',headers:{Authorization:'Bearer '+await o.token(),'Content-Type':'application/json',...(o.login?{'login-customer-id':o.login}:{}),...(o.developerToken?{'developer-token':o.developerToken}:{})},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new ControlProviderError('pmax_transport_unconfirmed',write);}
  let data;try{data=await response.json();}catch{throw new ControlProviderError('pmax_response_unconfirmed',write);}
  if(!response.ok||data.error||data.partialFailureError)throw new ControlProviderError('pmax_google_rejected',write&&(response.status>=500||response.status===408||response.ok),safeGoogleCodes(data),response.status);
  return {data,requestId:response.headers.get('request-id')};
 }
 async function search(query:string){const {data}=await request('googleAds:search',{query});if(data.nextPageToken||data.results!==undefined&&!Array.isArray(data.results))throw new Error('Google report is incomplete.');return data.results||[];}
 async function catalogue(){
  const customer=(await search('SELECT customer.id, customer.currency_code FROM customer LIMIT 1'))[0]?.customer;
  if(String(customer?.id)!==o.account||customer.currencyCode!=='USD')throw new Error('This workspace requires the verified USD Google Ads account.');
  const assets=await search("SELECT asset.resource_name, asset.name, asset.image_asset.full_size.url, asset.image_asset.full_size.width_pixels, asset.image_asset.full_size.height_pixels FROM asset WHERE asset.type = 'IMAGE' LIMIT 501");
  if(assets.length>500)throw new Error('Too many images. Narrow the account asset library before loading.');
  const locations=await search("SELECT geo_target_constant.resource_name, geo_target_constant.canonical_name, geo_target_constant.country_code, geo_target_constant.target_type FROM geo_target_constant WHERE geo_target_constant.country_code = 'RO' AND geo_target_constant.status = 'ENABLED' AND geo_target_constant.name REGEXP_MATCH '(?i).*(taberei|sector(ul)?[ ]*6)([^0-9].*)?' LIMIT 51");
  if(locations.length>50)throw new Error('Location results are incomplete. No partial selection was returned.');
  return {account:o.account,currency:'USD',assets:assets.map((r:any)=>({id:r.asset.resourceName,name:r.asset.name||r.asset.resourceName,width:Number(r.asset.imageAsset?.fullSize?.widthPixels),height:Number(r.asset.imageAsset?.fullSize?.heightPixels),url:r.asset.imageAsset?.fullSize?.url||''})),locations:locations.map((r:any)=>({id:r.geoTargetConstant.resourceName,name:r.geoTargetConstant.canonicalName,type:r.geoTargetConstant.targetType}))};
 }
 function imageFits(width:number,height:number,kind:string){if(!Number.isFinite(width)||!Number.isFinite(height))return false;const ratio=width/height;return kind==='landscape'?width>=600&&height>=314&&Math.abs(ratio-1.91)<.02:width>=(kind==='logo'?128:300)&&height>=(kind==='logo'?128:300)&&Math.abs(ratio-1)<.01;}
 async function validate(draft:PmaxDraft,id:string){
  const current=await catalogue(),s=draft.settings;
  const location=current.locations.find((v:any)=>v.id===s.location&&v.name===s.locationLabel);if(!location)throw new Error('Selected Romanian location changed or is unavailable.');
  for(const kind of ['landscape','square','logo'] as const){const image=current.assets.find((a:any)=>a.id===s[kind]);if(!image||!imageFits(image.width,image.height,kind))throw new Error('Select valid '+kind+' image dimensions.');}
  const conversion=(await search(`SELECT conversion_action.id, conversion_action.status, conversion_action.type FROM conversion_action WHERE conversion_action.id = ${s.conversionId} LIMIT 2`))[0]?.conversionAction;
  if(String(conversion?.id)!==s.conversionId||conversion.status!=='ENABLED'||conversion.type!=='UPLOAD_CLICKS')throw new Error('CRM conversion action is unavailable or incompatible.');
  const operations=pmaxOperations(o.account,draft,id);await request('googleAds:mutate',{mutateOperations:operations,partialFailure:false,validateOnly:true});return operations;
 }
 return {catalogue,validate,async create(row:PmaxRow,operations:Record<string,unknown>[]){
  const {data,requestId}=await request('googleAds:mutate',{mutateOperations:operations,partialFailure:false,validateOnly:false},true),results=data.mutateOperationResponses;
  if(!Array.isArray(results)||results.length!==operations.length)throw new ControlProviderError('pmax_receipt_unconfirmed',true);
  const campaign=results.find((r:any)=>r.campaignResult)?.campaignResult?.resourceName;
  if(typeof campaign!=='string'||!new RegExp(`^customers/${o.account}/campaigns/\\d+$`).test(campaign))throw new ControlProviderError('pmax_receipt_unconfirmed',true);
  let live;try{live=(await search(`SELECT campaign.resource_name, campaign.status FROM campaign WHERE campaign.resource_name = '${campaign}' LIMIT 1`))[0]?.campaign;}catch{throw new ControlProviderError('pmax_enabled_state_unconfirmed',true);}
  if(live?.resourceName!==campaign||live.status!=='ENABLED')throw new ControlProviderError('pmax_enabled_state_unconfirmed',true);
  return {campaign,status:'ENABLED',requestId,policyReview:'Pending or unknown; Google determines eligibility',dailyUsd:row.draft!.settings.dailyUsd};
 }};
}
