import {apiError,requireAdmin} from '@/lib/server';
import {conversionDashboard} from '@/lib/conversion-dashboard';
import {uploadHistory} from '@/lib/ads-ledger';
import {reviewedManifest} from '@/lib/ads-review';
import {ADS_ACCOUNT_ID,ADS_CONVERSION_ID} from '@/lib/google-ads-events';
export async function GET(request:Request){
 try{
  const {client}=await requireAdmin(),dashboard=await conversionDashboard(new URL(request.url),{client}),history=await uploadHistory(client);
  const locked=new Set(history.records.map(record=>record.payment_id));
  const rows=dashboard.items.filter(item=>item.ready&&!locked.has(item.paymentId));
  return Response.json({configured:history.configured,manifest:history.configured?reviewedManifest(rows):[],history:history.records.sort((a,b)=>b.created_at.localeCompare(a.created_at)),accountId:ADS_ACCOUNT_ID,conversionId:ADS_CONVERSION_ID},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
