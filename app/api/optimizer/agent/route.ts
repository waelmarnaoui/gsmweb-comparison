import {requireAdmin,apiError} from '@/lib/server';
import {readAgentContext} from '@/lib/agent-context';
import {refreshAdsObservation} from '@/lib/ads-monitor-server';
export async function GET(){try{
 await requireAdmin();
 const refresh=await refreshAdsObservation(),context=await readAgentContext();
 if(refresh.refreshError)context.alerts.push({key:'report-refresh-failed',level:'warning',message:refresh.refreshError});
 return Response.json(context,{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
