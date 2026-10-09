import {requireAdmin,apiError} from '@/lib/server';
import {configuredProvider,getConnection} from '@/lib/connections';
export async function GET(){try{
 await requireAdmin();const items=[];
 for(const id of ['supabase_calls','supabase_crm','google'] as const){
 const ready=configuredProvider(id);let saved=null,error='';
 if(ready){try{saved=await getConnection(id);}catch(e){error=e instanceof Error?e.message:'Connection unavailable';}}
 items.push({id,ready:ready&&!error,authorized:Boolean(saved),selected:saved?.metadata||{},error});
 }
 return Response.json({items,primaryRef:new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0],pickerReady:Boolean(process.env.GOOGLE_PICKER_API_KEY&&process.env.GOOGLE_CLOUD_PROJECT_NUMBER)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
