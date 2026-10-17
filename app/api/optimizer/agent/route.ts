import {requireAdmin,apiError} from '@/lib/server';
import {readAgentContext} from '@/lib/agent-context';
import {refreshAdsObservation} from '@/lib/ads-monitor-server';
import {readStockMonitor} from '@/lib/ai-ads/monitor-server';
import {stockWorkStatus} from '@/lib/ai-ads/monitor';
import {readControlAlerts} from '@/lib/ads-control/server';
export async function GET(){try{
 const {user}=await requireAdmin();
 const [refresh,stockWork]=await Promise.all([
  refreshAdsObservation(),
  readStockMonitor().then(stockWorkStatus).catch(()=>({state:'unavailable' as const,observedAt:null,qualifiedParts:null,draftCount:null,notice:'Saved stock status is unavailable. Open stock monitoring for a manual check.'}))
 ]);
 const [context,controlAlerts]=await Promise.all([readAgentContext(),readControlAlerts()]);
 context.alerts.push(...controlAlerts);
 if(refresh.refreshError)context.alerts.push({key:'report-refresh-failed',level:'warning',message:refresh.refreshError});
 if(stockWork.notice)context.alerts.push({key:'stock-monitor-unavailable',level:'warning',message:stockWork.notice});
 return Response.json({...context,stockWork},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
