import {requireAdmin,apiError} from '@/lib/server';
import {readAgentContext} from '@/lib/agent-context';
import {refreshAdsObservation} from '@/lib/ads-monitor-server';
import {collectStockMonitor} from '@/lib/ai-ads/monitor-server';
import {stockWorkStatus} from '@/lib/ai-ads/monitor';
export async function GET(){try{
 const {user}=await requireAdmin();
 const [refresh,stockWork]=await Promise.all([
  refreshAdsObservation(),
  collectStockMonitor(user.id).then(stockWorkStatus).catch(()=>({state:'unavailable' as const,observedAt:null,qualifiedParts:null,draftCount:null,notice:'Stock monitoring could not start. Open stock monitoring to check storage and the saved inventory connection.'}))
 ]);
 const context=await readAgentContext();
 if(refresh.refreshError)context.alerts.push({key:'report-refresh-failed',level:'warning',message:refresh.refreshError});
 if(stockWork.notice)context.alerts.push({key:'stock-monitor-unavailable',level:'warning',message:stockWork.notice});
 return Response.json({...context,stockWork},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
