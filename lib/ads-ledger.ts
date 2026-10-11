import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {service} from './server';
import {IntegrationError} from './integration-error';
import {ADS_ACCOUNT_ID,ADS_CONVERSION_ID} from './google-ads-events';
import type {AdsRow,ManifestEntry} from './ads-review';
export type UploadRecord={payment_id:string;batch_id:string;state:string;request_id:string|null;warning:boolean;created_at:string;updated_at:string;error_codes:string[]};
export async function uploadHistory(client:SupabaseClient){
 const records:UploadRecord[]=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await client.from('ga_ads_uploads').select('payment_id,batch_id,state,request_id,warning,created_at,updated_at,error_codes').eq('account_id',ADS_ACCOUNT_ID).eq('conversion_id',ADS_CONVERSION_ID).order('payment_id').range(offset,offset+499);
  if(error){if(['42P01','PGRST205'].includes(error.code))return {configured:false,records};throw new IntegrationError('Google upload history could not be read.',503);}
  records.push(...(data||[]) as UploadRecord[]);if((data||[]).length<500)return {configured:true,records};
 }
 throw new IntegrationError('Upload history is too large; partial data cannot be used for sending.',503);
}
export async function claimUpload(userId:string,rows:AdsRow[],manifest:ManifestEntry[]){
 const {data,error}=await service().rpc('ga_claim_ads_upload',{p_actor:userId,p_items:manifest.map(entry=>({payment_id:entry.paymentId,payload_hash:entry.fingerprint,consent_id:rows.find(row=>row.paymentId===entry.paymentId)!.consent!.id}))});
 if(error)throw new IntegrationError(error.code==='23505'?'Some payments are already reserved or uploaded. Refresh the review.':'Upload tracking is unavailable or consent changed. Install the approved setup and refresh.',409);
 if(typeof data!=='string')throw new IntegrationError('Upload reservation returned no receipt. Nothing was sent.',503);
 return data;
}
export async function recordUpload(batch:string,state:string,requestId:string,warning:boolean,errorCodes:string[]=[]){
 const {data,error}=await service().from('ga_ads_uploads').update({state,request_id:requestId||null,warning,error_codes:errorCodes,updated_at:new Date().toISOString()}).eq('batch_id',batch).eq('account_id',ADS_ACCOUNT_ID).eq('conversion_id',ADS_CONVERSION_ID).select('payment_id');
 if(error||!data?.length)throw new IntegrationError('Could not record Google upload status. Do not resend.',503);
}
