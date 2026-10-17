import {timingSafeEqual} from 'node:crypto';
import {collectAdsObservation} from '@/lib/ads-monitor-server';
import {ADS_WEB_ONLY} from '@/lib/ads-web-mode';
export async function GET(request:Request){
 const secret=process.env.ADS_MONITOR_CRON_SECRET,received=request.headers.get('authorization')??'';
 if(!secret||secret.length<32)return Response.json({error:'Scheduler is not configured.'},{status:503});
 const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(received);
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return Response.json({error:'Unauthorized'},{status:401});
 if(ADS_WEB_ONLY)return Response.json({collected:false,skipped:true,mode:'web_only'},{headers:{'Cache-Control':'no-store'}});
 try{const report=await collectAdsObservation();return Response.json({collected:true,fetchedAt:report.fetchedAt},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Scheduled collection failed. Check reporting authorization and storage.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
