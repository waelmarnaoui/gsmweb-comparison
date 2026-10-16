import {apiError,requireAdmin} from '@/lib/server';
import {sameOrigin,connectionToken} from '@/lib/connections';
import {uploadHistory,recordUpload} from '@/lib/ads-ledger';
import {adsRequest} from '@/lib/ads-provider';
import {providerUploadStatus} from '@/lib/ads-status';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=60;
export async function POST(request:Request){
 try{
  const {client}=await requireAdmin();sameOrigin(request);
  const history=await uploadHistory(client);
  if(!history.configured)throw new IntegrationError('Upload history is not installed. Run the approved attribution database setup first.',503);
  const text=await request.text();let batchId='';
  if(text){let body;try{body=JSON.parse(text);}catch{throw new IntegrationError('Invalid status request.');}if(typeof body?.batchId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.batchId))throw new IntegrationError('Choose a valid upload batch.');batchId=body.batchId;}
  const records=history.records.filter(row=>row.request_id&&(!batchId||row.batch_id===batchId)).sort((a,b)=>a.updated_at.localeCompare(b.updated_at));
  const batches=[...new Map(records.map(row=>[row.batch_id,row])).values()].slice(0,batchId?1:3);
  if(batchId&&!batches.length)throw new IntegrationError('No saved Google receipt for this batch. No retry was attempted.',409);
  if(!batches.length)return Response.json({message:history.records.length?'No pending Google requests. Uncertain requests remain locked against resending.':'No conversions have been sent yet. Review consent, then use Send to Google; Check Google status does not upload.'},{headers:{'Cache-Control':'no-store'}});
  const {token}=await connectionToken('google_ads');
  const diagnostics=[];
  for(const row of batches){const result=providerUploadStatus(await adsRequest(token,'requestStatus:retrieve?requestId='+encodeURIComponent(row.request_id!)));await recordUpload(row.batch_id,result.state,row.request_id!,result.warning,result.errorCodes);diagnostics.push({batchId:row.batch_id,requestId:row.request_id,...result});}
  return Response.json({message:'Google processing status rechecked for '+batches.length+' batches. No conversions were uploaded. Successful ingestion does not guarantee attribution.',count:batches.length,diagnostics},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
