import {requireAdmin,apiError} from '@/lib/server';
import {autoMatch} from '@/lib/auto-match';
import {validateRequestOrigin} from '@/lib/connection-validation';
import {matchingHealth} from '@/lib/matching-state';
import {syncClickSheet} from '@/lib/sync-click-sheet';
export async function POST(request:Request){try{
 const {client}=await requireAdmin();validateRequestOrigin(request.headers.get('origin'),new URL(process.env.APP_URL||request.url).origin);
 if(!(await matchingHealth(client)).configured)return Response.json({configured:false,confirmed:0},{headers:{'Cache-Control':'no-store'}});
 const source=await syncClickSheet(client);
 return Response.json({...await autoMatch(client),source},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
