import 'server-only';
import {configuredProvider,getConnection} from './connections';
import {service} from './server';
import {ADS_ACCOUNT_ID,ADS_CONVERSION_ID} from './google-ads-events';
export async function adsConnectionStatus(){
 const saved=await getConnection('google_ads'),ready=configuredProvider('google_ads');
 const validated=saved?.metadata.ads_account_id===ADS_ACCOUNT_ID&&saved.metadata.ads_conversion_id===ADS_CONVERSION_ID&&Boolean(saved.metadata.ads_validated_at);
 return {ready,authorized:Boolean(saved),validated:Boolean(validated),validatedAt:validated?saved!.metadata.ads_validated_at:null,accountId:ADS_ACCOUNT_ID,conversionId:ADS_CONVERSION_ID};
}
export async function recordAdsValidation(){
 const saved=await getConnection('google_ads');if(!saved)return;
 const {error}=await service().from('ga_connections').update({metadata:{...saved.metadata,ads_account_id:ADS_ACCOUNT_ID,ads_conversion_id:ADS_CONVERSION_ID,ads_validated_at:new Date().toISOString()}}).eq('id','google_ads').eq('encrypted_credentials',saved.sealed);
 if(error)throw new Error('Could not save Google destination validation. No upload was attempted.');
}
