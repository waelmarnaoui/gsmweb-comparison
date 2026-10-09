import {requireAdmin,apiError} from '@/lib/server';
import {autoMatch} from '@/lib/auto-match';
import {validateRequestOrigin} from '@/lib/connection-validation';
export async function POST(request:Request){try{
 const {client}=await requireAdmin();validateRequestOrigin(request.headers.get('origin'),new URL(process.env.APP_URL||request.url).origin);
 return Response.json(await autoMatch(client),{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
