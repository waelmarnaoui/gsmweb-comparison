import {createClient} from '@supabase/supabase-js';
import {requireAdmin,apiError} from '@/lib/server';
import {ConnectionId,getConnection,managementGet,sameOrigin,saveConnection} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){try{
 const {user}=await requireAdmin();sameOrigin(request);const {provider}=await params;
 if(!['supabase_calls','supabase_crm'].includes(provider))throw new IntegrationError('Unknown connection.');
 const id=provider as ConnectionId,{project_ref}=await request.json();if(typeof project_ref!=='string'||!/^[a-z0-9]{20}$/.test(project_ref))throw new IntegrationError('Select a valid project.');
 const projects=await managementGet(id,'projects'),project=projects.find((p:{id:string})=>p.id===project_ref);if(!project)throw new IntegrationError('Project is not available to this account.',403);
 if(id==='supabase_calls'&&project_ref!==new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0])throw new IntegrationError('The calls connection must use the current app database. Moving app authentication and attribution to another project requires a separate migration.');
 const saved=await getConnection(id);if(!saved)throw new IntegrationError('Connect Supabase first.');
 let projectKey='';
 if(id==='supabase_crm'){
  const keys=await managementGet(id,'projects/'+project_ref+'/api-keys?reveal=true');
  projectKey=keys.find((k:{name:string;type?:string})=>k.type==='secret'||k.name==='service_role')?.api_key;
  if(!projectKey)throw new IntegrationError('No server API key is available. Approve Secrets Read in the Supabase OAuth registration.');
  const client=createClient('https://'+project_ref+'.supabase.co',projectKey,{auth:{persistSession:false,autoRefreshToken:false}});
  for(const table of ['Client','Repair','GoogleAdsLeads','PaymentTransaction','RepairSettlement','SaleSettlement']){
   const {error}=await client.from(table).select('*',{head:true,count:'exact'}).limit(1);
   if(error)throw new IntegrationError(`CRM table ${table} could not be read in the selected project. Verify its schema and API access.`);
  }
 }
 await saveConnection(id,{...saved.credentials,...(projectKey?{project_key:projectKey}:{})},{project_ref,name:project.name},user.id);
 return Response.json({name:project.name,project_ref});
 }catch(error){return apiError(error);}}
