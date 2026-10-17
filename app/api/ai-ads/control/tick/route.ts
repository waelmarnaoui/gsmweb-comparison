import {checkActionRuntime} from '@/lib/agent-runtime-check';
import {claimControlRequests,finishControlRequests,runSourceJob} from '@/lib/agent-jobs-server';
import {recordAdvisorReadiness} from '@/lib/advisor-settings-server';
import {agentAccount} from '@/lib/agent-context';
import {runPublishingTick,publishingQuotaWait,recordPublishingQuota} from '@/lib/ai-ads/publishing-server';
import {isGoogleQuotaError,ControlProviderError} from '@/lib/ads-control/google';
import {collectGrowthMonitor} from '@/lib/ai-ads/growth-server';
import {controlSchedulerAuthorized} from '@/lib/ads-control/scheduler-auth';
import {runStockControlTick,markControlWorkerFailed} from '@/lib/ads-control/server';
import {refreshAdsObservation} from '@/lib/ads-monitor-server';
import {authorizeLaptopTick} from '@/lib/ads-control/pairing-server';
import {ADS_WEB_ONLY} from '@/lib/ads-web-mode';
export const maxDuration=300;
export async function POST(request:Request){
 let laptop:string|null=null;
 if(!controlSchedulerAuthorized(request.headers.get('authorization'),process.env.ADS_CONTROL_CRON_SECRET)){
  try{laptop=await authorizeLaptopTick(request.headers.get('authorization'));}catch{/* No capability means no work. */}
  if(!laptop)return Response.json({error:'Unauthorized or scheduler not configured.'},{status:401});
 }
 if(ADS_WEB_ONLY)return Response.json({checked:false,mode:'web_only',notice:'Laptop ticks are disabled. No jobs were claimed or Ads calls made.'},{status:410,headers:{'Cache-Control':'no-store'}});
 const started=Date.now();let jobs:string[]=[];
 try{
  const wait=await publishingQuotaWait();if(wait)return Response.json({error:'Google Ads API quota cooldown. No jobs were claimed or ads changed.',retryAfter:wait},{status:429,headers:{'Retry-After':String(wait),'Cache-Control':'no-store'}});
  try{await recordAdvisorReadiness(agentAccount());}catch{/* Chat readiness must not prevent stock and ad safety checks. */}
  const report=await refreshAdsObservation();
  if('quotaLimited' in report&&report.quotaLimited){await recordPublishingQuota();throw new ControlProviderError('google_rate_limited',false,['RESOURCE_EXHAUSTED'],429);}
  try{jobs=await claimControlRequests();}catch{/* Existing account safety work must continue if a new job table is unavailable. */}
  const stock=await runStockControlTick(false,laptop??undefined);
  const growth=await collectGrowthMonitor();const publication=await runPublishingTick();
  if('quotaPaused' in publication&&publication.quotaPaused)throw new Error('Quota cooldown started during this cycle.');
  if(!publication.checked)throw new Error('Publication check is busy; cycle completion is unconfirmed.');
  await finishControlRequests(jobs,true);
  if(Date.now()-started<30000)try{await checkActionRuntime();}catch{/* A read-only agent check must never block safety work. */}
  if(Date.now()-started<90000)try{await runSourceJob();}catch{/* Code job state remains observable and never blocks Ads safety checks. */}
  return Response.json({...stock,searchMonitoringAvailable:growth.reliable,reportingAvailable:!report.refreshError},{headers:{'Cache-Control':'no-store'}});
 }catch(error){try{await finishControlRequests(jobs,false);}catch{}try{await markControlWorkerFailed(false,laptop??undefined);}catch{/* A failed write leaves health stale. */}const quota=isGoogleQuotaError(error);return Response.json({error:quota?'Google Ads API quota limit. No automatic action replay.':'Control worker could not complete. Review account-control health and pending actions.'},{status:quota?429:503,headers:{'Cache-Control':'no-store',...(quota?{'Retry-After':'900'}:{})}});}
}
