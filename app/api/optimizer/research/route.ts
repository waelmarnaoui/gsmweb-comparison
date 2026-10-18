import {randomBytes,createHash} from 'node:crypto';
import {requireAdmin,service,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {agentAccount} from '@/lib/agent-context';
import {queueResearchTask} from '@/lib/research-server';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=60;
export async function GET(){try{
 const {user}=await requireAdmin(),db=service(),account=agentAccount();
 const tasks=await db.from('ga_research_tasks').select('id,title,state,checkpoint_version,report,created_at,updated_at,deadline_at,error_code').eq('account_id',account).eq('actor',user.id).order('created_at',{ascending:false}).limit(30);
 const workers=await db.from('ga_research_workers').select('id,label,active,last_seen_at').eq('account_id',account).eq('actor',user.id).order('created_at',{ascending:false});
 if(tasks.error||workers.error)throw new IntegrationError('Research queue unavailable. Install the approved research migration.',503);
 return Response.json({tasks:tasks.data,workers:workers.data,webSearchConfigured:false},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);const raw=await request.text();if(raw.length>16000)throw new IntegrationError('Research request too large.',413);const input=JSON.parse(raw),db=service(),account=agentAccount();
 if(input.operation==='pair'){
  const token='gsresearch_'+randomBytes(32).toString('hex'),token_hash=createHash('sha256').update(token).digest('hex');
  const r=await db.from('ga_research_workers').insert({account_id:account,actor:user.id,label:'Owner research computer',token_hash}).select('id').single();if(r.error)throw new Error('Research pairing unavailable.');
  return Response.json({token,workerId:r.data.id},{headers:{'Cache-Control':'no-store'}});
 }
 if(input.operation==='create'){
  return Response.json(await queueResearchTask(user.id,{title:input.title,instructions:input.instructions,hours:input.hours}),{status:202,headers:{'Cache-Control':'no-store'}});
 }
 if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id))throw new Error('Invalid research identity.');
 if(input.operation==='revoke'){
  const r=await db.from('ga_research_workers').update({active:false}).eq('id',input.id).eq('actor',user.id).eq('account_id',account).select('id');if(r.error||!r.data?.length)throw new Error('Worker unavailable.');
 }else if(['pause','resume','cancel'].includes(input.operation)){
  const r=await db.from('ga_research_tasks').update({state:input.operation==='pause'?'paused':input.operation==='resume'?'queued':'cancelled',lease_until:null,lease_token:null,updated_at:new Date().toISOString()}).eq('id',input.id).eq('actor',user.id).eq('account_id',account).in('state',input.operation==='resume'?['paused']:['queued','running','paused']).gt('deadline_at',new Date().toISOString()).select('id');if(r.error||!r.data?.length)throw new IntegrationError('Task is finished, expired or unavailable.',409);
 }else throw new Error('Unsupported research operation.');
 return Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
