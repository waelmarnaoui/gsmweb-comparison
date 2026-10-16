import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {collectAdsObservation} from '@/lib/ads-monitor-server';
export async function POST(request:Request){try{
 await requireAdmin();sameOrigin(request);
 const observation=await collectAdsObservation();
 return Response.json({collected:true,fetchedAt:observation.fetchedAt},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
