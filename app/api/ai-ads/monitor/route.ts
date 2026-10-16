import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readStockMonitor,collectStockMonitor} from '@/lib/ai-ads/monitor-server';
export const dynamic='force-dynamic';
export async function GET(){try{await requireAdmin();return Response.json(await readStockMonitor(),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);
 return Response.json(await collectStockMonitor(user.id),{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
