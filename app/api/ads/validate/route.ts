import {apiError,requireAdmin} from '@/lib/server';
import {sameOrigin,connectionToken} from '@/lib/connections';
import {conversionDashboard} from '@/lib/conversion-dashboard';
import {validationPayload} from '@/lib/google-ads-events';
import {IntegrationError} from '@/lib/integration-error';
import {parseManifest,selectReviewed} from '@/lib/ads-review';
import {uploadHistory} from '@/lib/ads-ledger';
import {adsRequest} from '@/lib/ads-provider';
import {recordAdsValidation} from '@/lib/ads-connection';

export async function POST(request:Request){
 try{
  const {client}=await requireAdmin();sameOrigin(request);
  const manifest=parseManifest(await request.json());
  const dashboard=await conversionDashboard(new URL(request.url),{client}),history=await uploadHistory(client);
  if(!history.configured)throw new IntegrationError('Install the approved Google upload tracking setup first.',503);
  const locked=new Set(history.records.map(row=>row.payment_id));
  const payload=validationPayload(selectReviewed(dashboard.items.map(row=>({...row,ready:row.ready&&!locked.has(row.paymentId)})),manifest));
  const {token}=await connectionToken('google_ads');
  const result=await adsRequest(token,'events:ingest',payload);
  if(result.fieldWarnings?.length)throw new IntegrationError('Google returned validation warnings. Upload remains disabled pending review.',502);
  await recordAdsValidation(token);
  return Response.json({validated:true,count:payload.events.length,message:'Google accepted validation. No conversions were uploaded.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
