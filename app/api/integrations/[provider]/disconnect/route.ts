import {requireAdmin,apiError,service} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){try{
 const {user}=await requireAdmin();sameOrigin(request);const {provider}=await params;
 if(!['google','supabase_calls','supabase_crm'].includes(provider))throw new IntegrationError('Unknown connection.');
 const {error}=await service().rpc('ga_disconnect_connection',{p_id:provider,p_actor:user.id});
 if(error)throw new IntegrationError('Could not disconnect. Verify connection storage migration is installed.',503);
 return Response.json({disconnected:true});
 }catch(error){return apiError(error);}}
