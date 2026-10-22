import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {manualWhatsAppInput} from '@/lib/manual-whatsapp';
import {IntegrationError} from '@/lib/integration-error';
import {firstInteractions} from '@/lib/first-interaction';
import {readCallHistory} from '@/lib/call-history';
export async function GET(){try{
 const {client}=await requireAdmin();const entries:Record<string,unknown>[]=[];
 for(let offset=0;offset<10000;offset+=500){const {data,error}=await client.from('ga_whatsapp_entries').select('call_id,phone,time_precision,created_at,ga_calls(started_at)').order('created_at',{ascending:false}).range(offset,offset+499);if(error){if(['42P01','PGRST205','PGRST200'].includes(error.code))return Response.json({configured:false,entries:[]},{headers:{'Cache-Control':'no-store'}});throw new IntegrationError('WhatsApp entries could not be read.',503);}entries.push(...(data||[]));if((data||[]).length<500)break;if(offset===9500)throw new IntegrationError('WhatsApp entry limit reached. No partial review returned.',503);}
 const history=await readCallHistory(client,new Date().toISOString()),primary=new Set(firstInteractions(history).filter(g=>g.eligible).map(g=>g.primary.id));
 return Response.json({configured:true,serverNow:new Date().toISOString(),entries:entries.map(entry=>({...entry,firstInteraction:primary.has(String(entry.call_id))}))},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const {client}=await requireAdmin();sameOrigin(request);const text=await request.text();if(text.length>2048)throw new IntegrationError('Entry is too large.');
 let input;try{input=manualWhatsAppInput(JSON.parse(text));}catch(error){throw new IntegrationError(error instanceof Error?error.message:'Invalid WhatsApp entry.');}
 const {data,error}=await client.rpc('ga_record_manual_whatsapp',{p_phone:input.phone,p_started:input.startedAt,p_precision:input.precision});
 if(error)throw new IntegrationError(['PGRST202','42883'].includes(error.code)?'Install the approved manual WhatsApp database setup first.':'WhatsApp entry could not be saved. Refresh before retrying.',503);
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
