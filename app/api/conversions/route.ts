import {apiError} from '@/lib/server';
import {conversionDashboard} from '@/lib/conversion-dashboard';
import {requireAdmin} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
export async function GET(request:Request){try{return Response.json(await conversionDashboard(new URL(request.url)),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{const {client}=await requireAdmin();sameOrigin(request);return Response.json(await conversionDashboard(new URL(request.url),{prepare:true,client}),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}

