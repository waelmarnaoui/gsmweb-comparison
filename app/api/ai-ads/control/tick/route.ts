import {checkActionRuntime} from '@/lib/agent-runtime-check';
import {claimControlRequests,finishControlRequests,runSourceJob} from '@/lib/agent-jobs-server';
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
 const started=Date.now();let jobs:string[]=[];
 try{
  try{jobs=await claimControlRequests();}catch{/* Existing account safety work must continue if a new job table is unavailable. */}
  try{await recordAdvisorReadiness(agentAccount());}catch{/* Chat readiness must not prevent stock and ad safety checks. */}
  const report=await refreshAdsObservation();
  const stock=await runStockControlTick(false,laptop??undefined);
  const growth=await collectGrowthMonitor();await runPublishingTick();
  await finishControlRequests(jobs,true);
  if(Date.now()-started<30000)try{await checkActionRuntime();}catch{/* A read-only agent check must never block safety work. */}
  if(Date.now()-started<90000)try{await runSourceJob();}catch{/* Code job state remains observable and never blocks Ads safety checks. */}
  return Response.json({...stock,searchMonitoringAvailable:growth.reliable,reportingAvailable:!report.refreshError},{headers:{'Cache-Control':'no-store'}});
 }catch{try{await finishControlRequests(jobs,false);}catch{}try{await markControlWorkerFailed(false,laptop??undefined);}catch{/* A failed write leaves health stale. */}return Response.json({error:'Control worker could not complete. Review account-control health and pending actions.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
