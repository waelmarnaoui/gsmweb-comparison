import {ADS_ACCOUNT_ID,ADS_CONVERSION_ID} from './google-ads-events';
export function providerUploadStatus(value:unknown){
 const data=value as {requestStatusPerDestination?:{destination?:{operatingAccount?:{accountId?:string;accountType?:string};productDestinationId?:string};requestStatus?:string;errorInfo?:{errorCounts?:{reason?:string}[]};warningInfo?:{warningCounts?:unknown[]}}[]};
 const destinations=data?.requestStatusPerDestination;
 if(!Array.isArray(destinations))throw new Error('Google returned an invalid status.');
 const destination=destinations.find(item=>item.destination?.operatingAccount?.accountId===ADS_ACCOUNT_ID&&item.destination.productDestinationId===ADS_CONVERSION_ID);
 if(!destination)throw new Error('Google returned status for a different destination.');
 const states:Record<string,string>={SUCCESS:'success',FAILED:'failed',PARTIAL_SUCCESS:'partial',PROCESSING:'submitted',REQUEST_STATUS_UNKNOWN:'submitted'};
 const state=states[destination.requestStatus||''];if(!state)throw new Error('Google returned an unknown status.');
 const codes=(destination.errorInfo?.errorCounts||[]).flatMap(error=>typeof error.reason==='string'&&/^[A-Z_]{1,160}$/.test(error.reason)?[error.reason]:[]);
 return {state,errorCodes:codes,warning:Boolean(destination.warningInfo?.warningCounts?.length)};
}
