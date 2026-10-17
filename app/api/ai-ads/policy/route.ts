import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {agentAccount} from '@/lib/agent-context';
import {webAdsResources} from '@/lib/ads-web-server';
export const maxDuration=90;
async function result(refresh:boolean){
 const saved=await webAdsResources(refresh),stamp=Date.parse(saved.fetchedAt??'');
 return Response.json({report:saved.adsComplete?{accountId:agentAccount(),fetchedAt:saved.fetchedAt,ads:saved.ads,source:'google_ads_api',complete:true}:null,stale:!Number.isFinite(stamp)||Date.now()-stamp>900000,mode:'web_only'},{headers:{'Cache-Control':'no-store'}});
}
export async function GET(){try{await requireAdmin();return await result(false);}catch(e){return apiError(e);}}
export async function POST(request:Request){try{await requireAdmin();sameOrigin(request);return await result(true);}catch(e){return apiError(e);}}
