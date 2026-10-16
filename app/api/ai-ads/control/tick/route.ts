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
  const report=await refreshAdsObservation();
  const stock=await runStockControlTick(false,laptop??undefined);
  return Response.json({...stock,reportingAvailable:!report.refreshError},{headers:{'Cache-Control':'no-store'}});
 }catch{try{await markControlWorkerFailed(false,laptop??undefined);}catch{/* A failed write leaves health stale. */}return Response.json({error:'Control worker could not complete. Review account-control health and pending actions.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
