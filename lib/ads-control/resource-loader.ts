import {ControlProviderError} from './google';
import {IntegrationError} from '../integration-error';
export function resourceReadError(error:unknown){
 if(error instanceof ControlProviderError)return `Google account read failed: ${error.code}${error.httpStatus?' (HTTP '+error.httpStatus+')':''}${error.diagnostics.length?' — '+error.diagnostics.join(', '):''}. Check Google Ads management access and account configuration.`;
 if(error instanceof IntegrationError)return error.message;
 return 'Google did not return a verified complete result. Check management authorization and retry this read.';
}
export async function loadControlResources<A,C>(readAds:()=>Promise<{ads:A[];fetchedAt:string}>,readCampaigns:()=>Promise<C[]>){
 const [ads,campaigns]=await Promise.allSettled([Promise.resolve().then(readAds),Promise.resolve().then(readCampaigns)]);
 return {ads:ads.status==='fulfilled'?ads.value.ads:[],campaigns:campaigns.status==='fulfilled'?campaigns.value:[],fetchedAt:ads.status==='fulfilled'?ads.value.fetchedAt:null,
  adsComplete:ads.status==='fulfilled',campaignsComplete:campaigns.status==='fulfilled',
  errors:[...(ads.status==='rejected'?[{section:'ads',message:resourceReadError(ads.reason)}]:[]),...(campaigns.status==='rejected'?[{section:'campaigns',message:resourceReadError(campaigns.reason)}]:[])]};
}
