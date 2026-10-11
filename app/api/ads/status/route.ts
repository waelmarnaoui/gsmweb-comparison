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
  const pending=history.records.filter(row=>row.request_id&&row.state==='submitted').sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const batches=[...new Map(pending.map(row=>[row.batch_id,row])).values()].slice(0,3);
  if(!batches.length)return Response.json({message:history.records.length?'No pending Google requests. Uncertain requests remain locked against resending.':'No conversions have been sent yet. Review consent, then use Send to Google; Check Google status does not upload.'},{headers:{'Cache-Control':'no-store'}});
  const {token}=await connectionToken('google_ads');
  for(const row of batches){const result=providerUploadStatus(await adsRequest(token,'requestStatus:retrieve?requestId='+encodeURIComponent(row.request_id!)));await recordUpload(row.batch_id,result.state,row.request_id!,row.warning||result.warning,result.errorCodes);}
  return Response.json({message:'Google processing status refreshed. Successful ingestion does not guarantee attribution.',count:batches.length},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
