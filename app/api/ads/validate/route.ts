import {apiError,requireAdmin} from '@/lib/server';
import {sameOrigin,connectionToken} from '@/lib/connections';
import {conversionDashboard} from '@/lib/conversion-dashboard';
import {validationPayload} from '@/lib/google-ads-events';
import {IntegrationError} from '@/lib/integration-error';

export async function POST(request:Request){
 try{
  await requireAdmin();sameOrigin(request);
  const dashboard=await conversionDashboard(new URL(request.url));
  const payload=validationPayload(dashboard.items);
  const {token}=await connectionToken('google_ads');
  const response=await fetch('https://datamanager.googleapis.com/v1/events:ingest',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(20000)});
  // Never return provider error bodies, which may echo customer identifiers.
  if(!response.ok)throw new IntegrationError('Google validation rejected the request (HTTP '+response.status+'). Check API access, conversion destination and enhanced-conversion eligibility.',502);
  const result=await response.json();
  if(result.fieldWarnings?.length)throw new IntegrationError('Google returned validation warnings. Upload remains disabled pending review.',502);
  return Response.json({validated:true,count:payload.events.length,message:'Google accepted validation. No conversions were uploaded.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
