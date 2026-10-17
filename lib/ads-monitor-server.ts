import 'server-only';
import {connectionToken} from './connections';
import {createAdsObserver} from './ads-monitor';
import {service} from './server';
import {IntegrationError} from './integration-error';
import {createAdsRefreshGate} from './ads-refresh';
import {ADS_WEB_ONLY} from './ads-web-mode';
import {lowRequestAdsRead} from './ads-read-server';

const refreshGate=createAdsRefreshGate();
export async function refreshAdsObservation(){
 if(ADS_WEB_ONLY)return {refreshError:null,mode:'saved_only'};
 const account=process.env.GOOGLE_ADS_CUSTOMER_ID;
 if(!account)return {refreshError:'Google Ads reporting account is not configured.'};
 return refreshGate(account,async()=>{
  const {data,error}=await service().from('ga_ads_observations').select('observation').eq('account_id',account).order('slot',{ascending:false}).limit(1).maybeSingle();
  if(error)throw new IntegrationError('Observation storage is unavailable. Install the reviewed observation migration.',503);
  return typeof data?.observation?.fetchedAt==='string'?data.observation.fetchedAt:null;
 },collectAdsObservation);
}

export async function collectAdsObservation(){
 const account=process.env.GOOGLE_ADS_CUSTOMER_ID;if(!account)throw new IntegrationError('Reporting account is not configured.',503);
 if(ADS_WEB_ONLY)return lowRequestAdsRead(account,'report',collectAdsObservationRaw);
 return collectAdsObservationRaw();
}
async function collectAdsObservationRaw(){
 const accountId=process.env.GOOGLE_ADS_CUSTOMER_ID;
 if(!accountId)throw new IntegrationError('Google Ads reporting account is not configured.',503);
 const deadline=AbortSignal.timeout(45000);
 const observer=createAdsObserver({accountId,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,fetcher:(url,init)=>fetch(url,{...init,signal:AbortSignal.any([deadline,...(init?.signal?[init.signal]:[])])}),
  developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  token:async()=>(await connectionToken('google_ads_management')).token});
 const observation=await observer.collect();
 // Concurrent collection is safe: one append per account and five-minute slot.
 const slot=new Date(Math.floor(Date.parse(observation.fetchedAt)/300000)*300000).toISOString();
 const {error}=await service().from('ga_ads_observations').upsert({account_id:accountId,slot,observation},{onConflict:'account_id,slot',ignoreDuplicates:true});
 if(error)throw new IntegrationError('Report was read but could not be saved. Install the reviewed observation migration.',503);
 return observation;
}
