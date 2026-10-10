import {apiError} from '@/lib/server';
import {conversionDashboard} from '@/lib/conversion-dashboard';
import {IntegrationError} from '@/lib/integration-error';
import {formatRomanianTimestamp} from '@/lib/timestamps';
export async function GET(request:Request){try{
 const {items,conversionName}=await conversionDashboard(new URL(request.url)),ready=items.filter(c=>c.ready);
 if(!ready.length)throw new IntegrationError('No verified conversions are ready in the selected date range.');
 const rows=[['Parameters:TimeZone=Europe/Bucharest'],['Google Click ID','Conversion Name','Conversion Time','Conversion Value','Conversion Currency','Order ID'],...ready.map(c=>[c.gclid,conversionName,formatRomanianTimestamp(c.conversionTime),c.amount.toFixed(2),'RON',c.paymentId])];
 const csv=rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="gsmweb-conversions.csv"','Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}}

