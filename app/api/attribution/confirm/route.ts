import {requireAdmin,apiError} from '@/lib/server';
import {matchingHealth,MATCHING_PENDING} from '@/lib/matching-state';
import {IntegrationError} from '@/lib/integration-error';
import {sameOrigin} from '@/lib/connections';
export async function POST(request:Request){try{
 const {client}=await requireAdmin();sameOrigin(request);
 if(!(await matchingHealth(client)).configured)throw new IntegrationError(MATCHING_PENDING,503);
 const {call_id,click_id}=await request.json();
 if(typeof call_id!=='string'||typeof click_id!=='string'||![call_id,click_id].every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw new Error('Invalid IDs');
 const {data,error}=await client.rpc('ga_confirm_match',{p_call:call_id,p_click:click_id});
 if(error)throw new IntegrationError('This attribution is no longer a unique, settled first-call match. Refresh the call history.',409);
 return Response.json({id:data});
}catch(error){return apiError(error)}}

