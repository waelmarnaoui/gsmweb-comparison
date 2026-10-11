import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin,getConnection} from '@/lib/connections';
import {readCrmComparison} from '@/lib/crm-reader';
import {readClientConsents} from '@/lib/consent-store';
import {validateConsentInput,CONSENT_SCRIPT_VERSION} from '@/lib/client-consent';
import {IntegrationError} from '@/lib/integration-error';
async function subject(client:Awaited<ReturnType<typeof requireAdmin>>['client'],callId:string){
 const {data,error}=await client.from('ga_calls').select('id,phone,started_at').eq('id',callId).maybeSingle();
 if(error||!data)throw new IntegrationError('Saved call not found.');
 const [comparison]=await readCrmComparison([data]);
 const connection=await getConnection('supabase_crm'),project=connection?.metadata.project_ref;
 if(!project||comparison.status!=='found'||!comparison.customer)throw new IntegrationError('Consent requires one uniquely linked CRM client.');
 return {comparison,project};
}
export async function GET(request:Request){try{
 const {client}=await requireAdmin(),callId=new URL(request.url).searchParams.get('callId')||'';
 const {comparison,project}=await subject(client,callId),customer=comparison.customer!;
 const state=await readClientConsents(client,project,[customer.id]);
 const {data:history,error}=await client.from('ga_client_consents').select('*').eq('crm_project_ref',project).eq('client_id',customer.id).order('id',{ascending:false}).limit(20);
 if(error&&state.configured)throw new IntegrationError('Consent history unavailable.',503);
 return Response.json({customer:customer.name,phone:comparison.phone,configured:state.configured,current:state.latest.get(customer.id)||null,history:history||[]},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}}
export async function POST(request:Request){try{
 sameOrigin(request);const {client}=await requireAdmin();
 let input;try{input=validateConsentInput(await request.json());}catch(e){throw new IntegrationError(e instanceof Error?e.message:'Invalid consent choices.');}
 const {comparison,project}=await subject(client,input.callId);
 const {error}=await client.rpc('ga_record_client_consent',{p_project:project,p_client:comparison.customer!.id,p_phone:comparison.phone,p_measurement:input.adUserData,p_personalization:input.adPersonalization,p_obtained:input.obtainedAt,p_version:CONSENT_SCRIPT_VERSION});
 if(error)throw new IntegrationError(['PGRST202','42883'].includes(error.code)?'Consent storage needs the approved database setup.':'Consent could not be saved. Refresh and retry.',503);
 return Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}}
