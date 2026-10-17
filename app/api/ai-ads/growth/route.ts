import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readGrowthMonitor,collectGrowthMonitor} from '@/lib/ai-ads/growth-server';
export const maxDuration=120;
export async function GET(){try{await requireAdmin();return Response.json(await readGrowthMonitor(),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{await requireAdmin();sameOrigin(request);return Response.json(await collectGrowthMonitor(),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
