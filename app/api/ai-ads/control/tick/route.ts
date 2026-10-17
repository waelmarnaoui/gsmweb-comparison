import {recordAdvisorReadiness} from '@/lib/advisor-settings-server';
import {agentAccount} from '@/lib/agent-context';
import {runPublishingTick} from '@/lib/ai-ads/publishing-server';
import {collectGrowthMonitor} from '@/lib/ai-ads/growth-server';
import {controlSchedulerAuthorized} from '@/lib/ads-control/scheduler-auth';
import {runStockControlTick,markControlWorkerFailed} from '@/lib/ads-control/server';
import {refreshAdsObservation} from '@/lib/ads-monitor-server';
import {authorizeLaptopTick} from '@/lib/ads-control/pairing-server';
export const maxDuration=300;
export async function POST(request:Request){
 let laptop:string|null=null;
 if(!controlSchedulerAuthorized(request.headers.get('authorization'),process.env.ADS_CONTROL_CRON_SECRET)){
  try{laptop=await authorizeLaptopTick(request.headers.get('authorization'));}catch{/* No capability means no work. */}
  if(!laptop)return Response.json({error:'Unauthorized or scheduler not configured.'},{status:401});
 }
 try{
  try{await recordAdvisorReadiness(agentAccount());}catch{/* Chat readiness must not prevent stock and ad safety checks. */}
  const report=await refreshAdsObservation();
  const stock=await runStockControlTick(false,laptop??undefined);
  const growth=await collectGrowthMonitor();await runPublishingTick();
  return Response.json({...stock,searchMonitoringAvailable:growth.reliable,reportingAvailable:!report.refreshError},{headers:{'Cache-Control':'no-store'}});
 }catch{try{await markControlWorkerFailed(false,laptop??undefined);}catch{/* A failed write leaves health stale. */}return Response.json({error:'Control worker could not complete. Review account-control health and pending actions.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
