import {requireAdmin,apiError} from '@/lib/server';
import {CALLS_VISIBLE_FROM_UTC} from '@/lib/call-visibility';
import {readCrmComparison} from '@/lib/crm-reader';
export async function GET(){try{
 const {client}=await requireAdmin();
 const {data,error}=await client.from('ga_calls').select('id,phone,started_at').gte('started_at',CALLS_VISIBLE_FROM_UTC).lte('started_at',new Date().toISOString()).order('started_at',{ascending:false}).limit(501);
 if(error)throw error;
 return Response.json({items:await readCrmComparison((data||[]).slice(0,500)),limited:(data||[]).length>500},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}}

