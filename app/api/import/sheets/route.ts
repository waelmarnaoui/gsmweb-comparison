import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {autoMatch} from '@/lib/auto-match';
import {matchingHealth,MATCHING_PENDING} from '@/lib/matching-state';
import {syncClickSheet} from '@/lib/sync-click-sheet';
import {IntegrationError} from '@/lib/integration-error';
export async function POST(request:Request){try{
 const {client,user}=await requireAdmin();sameOrigin(request);
 if(!(await matchingHealth(client)).configured)throw new IntegrationError(MATCHING_PENDING,503);
 const source=await syncClickSheet(client,true);
 let attribution;try{attribution=await autoMatch(client);}catch{attribution={configured:true,confirmed:0,error:'Clicks were imported, but automatic attribution failed. Refresh to retry.'};}
 return Response.json({...source,importedBy:user.id,attribution},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error)}}
