import {requireAdmin,apiError} from '@/lib/server';
import {ConnectionId,managementGet} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
export async function GET(_request:Request,{params}:{params:Promise<{provider:string}>}){try{
 await requireAdmin();const {provider}=await params;if(!['supabase_calls','supabase_crm'].includes(provider))throw new IntegrationError('Unknown Supabase connection.');
 const projects=await managementGet(provider as ConnectionId,'projects');
 return Response.json({projects:projects.map((p:{id:string;name:string;region:string;organization_id:string;status:string})=>({id:p.id,name:p.name,region:p.region,organization:p.organization_id,status:p.status}))},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
