import {apiError} from '@/lib/server';
import {conversionDashboard} from '@/lib/conversion-dashboard';
import {IntegrationError} from '@/lib/integration-error';
import {conversionCsv} from '@/lib/conversion-csv';
export async function GET(request:Request){try{
 const {items,conversionName}=await conversionDashboard(new URL(request.url)),ready=items.filter(c=>c.ready);
 if(!ready.length)throw new IntegrationError('No verified conversions are ready in the selected date range.');
 const csv=conversionCsv(ready,conversionName);
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="gsmweb-conversions.csv"','Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}}

