import {validationPayload} from './google-ads-events';
import {selectReviewed,type AdsRow,type ManifestEntry} from './ads-review';
type Payload=ReturnType<typeof validationPayload>;
export type UploadPorts={read:()=>Promise<AdsRow[]>;validate:(payload:Payload)=>Promise<void>;claim:(rows:AdsRow[],manifest:ManifestEntry[])=>Promise<string>;submit:(payload:Omit<Payload,'validateOnly'>&{validateOnly:false})=>Promise<{requestId:string;warnings:boolean}>;record:(batch:string,state:'submitted'|'unknown',requestId:string,warning:boolean)=>Promise<void>};
export async function uploadReviewed(manifest:ManifestEntry[],ports:UploadPorts){
 const initial=selectReviewed(await ports.read(),manifest);
 await ports.validate(validationPayload(initial));
 // Re-read after the provider round-trip: consent, profit and matching can change.
 const latest=selectReviewed(await ports.read(),manifest),payload=validationPayload(latest);
 const batch=await ports.claim(latest,manifest);
 let accepted:{requestId:string;warnings:boolean};
 try{accepted=await ports.submit({...payload,validateOnly:false});}
 catch{await ports.record(batch,'unknown','',false);return {batch,state:'unknown' as const,count:latest.length,message:'Google upload outcome is uncertain. These payments are locked against resending; check upload history.'};}
 try{await ports.record(batch,'submitted',accepted.requestId,accepted.warnings);}
 catch{return {batch,state:'unknown' as const,count:latest.length,message:'Google accepted the request, but saving its receipt failed. These payments remain locked. Contact support before any retry.'};}
 return {batch,state:'submitted' as const,count:latest.length,message:'Submitted to Google for processing. Refresh upload status to check the result. Submission does not guarantee advertising attribution.'};
}
