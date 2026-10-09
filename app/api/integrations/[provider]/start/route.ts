import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin,startAuthorization,ConnectionId} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){try{
 const {user}=await requireAdmin();sameOrigin(request);const {provider}=await params;
 if(!['google','supabase_calls','supabase_crm'].includes(provider))throw new IntegrationError('Unknown connection.');
 return Response.json({url:await startAuthorization(provider as ConnectionId,user.id)});
 }catch(error){return apiError(error);}}
