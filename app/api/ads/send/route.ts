import {apiError,requireAdmin} from '@/lib/server';
import {sameOrigin,connectionToken} from '@/lib/connections';
import {conversionDashboard} from '@/lib/conversion-dashboard';
import {claimUpload,recordUpload,uploadHistory} from '@/lib/ads-ledger';
import {parseManifest} from '@/lib/ads-review';
import {uploadReviewed} from '@/lib/ads-upload-flow';
import {adsRequest} from '@/lib/ads-provider';
import {IntegrationError} from '@/lib/integration-error';
import {recordAdsValidation} from '@/lib/ads-connection';
export const maxDuration=60;
export async function POST(request:Request){
 try{
  const {client,user}=await requireAdmin();sameOrigin(request);
  const manifest=parseManifest(await request.json()),{token}=await connectionToken('google_ads');
  const result=await uploadReviewed(manifest,{
   read:async()=>{const dashboard=await conversionDashboard(new URL(request.url),{client}),history=await uploadHistory(client);if(!history.configured)throw new IntegrationError('Install the approved Google upload tracking setup first.',503);const locked=new Set(history.records.map(record=>record.payment_id));return dashboard.items.map(row=>({...row,ready:row.ready&&!locked.has(row.paymentId)}));},
   validate:async payload=>{const result=await adsRequest(token,'events:ingest',payload);if(result.fieldWarnings?.length)throw new IntegrationError('Google returned validation warnings. Nothing was uploaded.',502);await recordAdsValidation(token);},
   claim:(rows,items)=>claimUpload(user.id,rows,items),
   submit:async payload=>{const result=await adsRequest(token,'events:ingest',payload);if(typeof result.requestId!=='string'||!result.requestId||result.requestId.length>512)throw new Error('Google returned no receipt.');return {requestId:result.requestId,warnings:Boolean(result.fieldWarnings?.length)};},
   record:recordUpload
  });
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(error instanceof Error&&['Confirm the reviewed upload first.','Invalid reviewed conversions.','Conversion data or consent changed. Refresh and review again.'].includes(error.message))return apiError(new IntegrationError(error.message,409));
  return apiError(error);
 }
}
