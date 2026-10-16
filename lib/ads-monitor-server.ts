import 'server-only';
import {connectionToken} from './connections';
import {createAdsObserver} from './ads-monitor';
import {service} from './server';
import {IntegrationError} from './integration-error';

export async function collectAdsObservation(){
 const accountId=process.env.GOOGLE_ADS_CUSTOMER_ID;
 if(!accountId)throw new IntegrationError('Google Ads reporting account is not configured.',503);
 const observer=createAdsObserver({accountId,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  token:async()=>(await connectionToken('google_ads_management')).token});
 const observation=await observer.collect();
 // Concurrent collection is safe: one append per account and half-hour slot.
 const slot=new Date(Math.floor(Date.parse(observation.fetchedAt)/1800000)*1800000).toISOString();
 const {error}=await service().from('ga_ads_observations').upsert({account_id:accountId,slot,observation},{onConflict:'account_id,slot',ignoreDuplicates:true});
 if(error)throw new IntegrationError('Report was read but could not be saved. Install the reviewed observation migration.',503);
 return observation;
}
