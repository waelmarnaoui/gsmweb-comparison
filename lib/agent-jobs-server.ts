import 'server-only';
import {service} from './server';
import {agentAccount} from './agent-context';
import {createSourcePullRequest,sourceReady,sourceReview,mergeSourceChange} from './agent-github';
import {IntegrationError} from './integration-error';
import {readPublishing} from './ai-ads/publishing-server';
export async function queueAgentJob(id:string,actor:string,kind:'control_cycle'|'source_change',payload:unknown){
 const r=await service().from('ga_agent_jobs').insert({id,account_id:agentAccount(),actor,kind,payload});if(r.error)throw new Error('Job could not be queued.');return {status:'queued',jobId:id,kind,notice:'Queued for the paired laptop worker. No external action is confirmed yet.'};
}
async function jobAccess(id:string,actor:string){const r=await service().from('ga_agent_jobs').select('*').eq('id',id).eq('actor',actor).eq('account_id',agentAccount()).single();if(r.error||!r.data)throw new Error('Job not found.');return r.data;}
export async function reviewAgentCode(id:string,actor:string){const job=await jobAccess(id,actor);if(job.kind!=='source_change'||job.state!=='awaiting_review'||!job.result?.head)throw new Error('No confirmed source review is available.');return sourceReview(job.result);}
export async function approveAgentCode(id:string,actor:string,expectedHead:string){
 const db=service(),job=await jobAccess(id,actor);const permissions=await db.from('ga_ads_control').select('agent_chat_enabled,agent_chat_authorization,global_paused').eq('account_id',agentAccount()).single();if(permissions.error||!permissions.data.agent_chat_enabled||!permissions.data.agent_chat_authorization||permissions.data.global_paused)throw new Error('Chat actions are disabled or automation is globally paused.');if(job.kind!=='source_change'||job.state!=='awaiting_review'||job.result?.head!==expectedHead)throw new Error('Review the current source revision before deploying.');
 const claimed=await db.from('ga_agent_jobs').update({state:'running',updated_at:new Date().toISOString()}).eq('id',id).eq('state','awaiting_review').select('id');if(claimed.error||claimed.data?.length!==1)throw new Error('Source action already claimed.');
 try{const result=await mergeSourceChange(job.result);const r=await db.from('ga_agent_jobs').update({state:'completed',result:{...job.result,...result},updated_at:new Date().toISOString()}).eq('id',id).eq('state','running');if(r.error)throw new Error('Receipt unavailable.');return result;}
 catch(e){if(e instanceof IntegrationError&&e.status===409){await db.from('ga_agent_jobs').update({state:'awaiting_review',updated_at:new Date().toISOString()}).eq('id',id).eq('state','running');throw e;}await db.from('ga_agent_jobs').update({state:'uncertain',error_code:'source_merge_unconfirmed',updated_at:new Date().toISOString()}).eq('id',id).eq('state','running');throw new Error('Merge not confirmed. Inspect the pull request and checks before another deployment attempt.');}
}
export async function readAgentAccess(actor:string){
 const db=service(),account=agentAccount(),[permissions,jobs,runs,preferences,github,runtime]=await Promise.all([
  db.from('ga_ads_control').select('agent_chat_enabled,global_paused').eq('account_id',account).single(),
  db.from('ga_agent_jobs').select('id,kind,state,result,error_code,created_at,updated_at').eq('account_id',account).eq('actor',actor).order('created_at',{ascending:false}).limit(30),
  db.from('ga_agent_tool_runs').select('id,tool,state,error_code,created_at').eq('account_id',account).eq('actor',actor).order('created_at',{ascending:false}).limit(30),
  db.from('ga_agent_preferences').select('name,value,updated_at').eq('account_id',account).order('name').limit(30),sourceReady(),db.from('ga_agent_runtime_checks').select('version,status,details,finished_at').eq('account_id',account).order('created_at',{ascending:false}).limit(1).maybeSingle()
 ]);if(permissions.error||jobs.error||runs.error||preferences.error)throw new Error('Agent tools storage is unavailable. Install the reviewed tool migrations.');
 return {runtime:runtime.error?null:runtime.data,enabled:permissions.data.agent_chat_enabled,globallyPaused:permissions.data.global_paused,github,jobs:jobs.data,runs:runs.data,preferences:preferences.data,capabilities:['CRM daily customer payments','Stored website click events and import health','Inventory, Ads reports and publication history','Publishing/correction permissions and global automation pause','Durable control-cycle requests','Persistent business preferences','Source reading and source-change pull requests after connecting GitHub'],limitations:['Raw credentials never enter the model.','Tracked click events are not complete website analytics.','Code deployment requires review and approval inside this app plus successful checks.','Changes beyond the existing Google Ads execution tools require a source upgrade first.']};
}
export async function claimControlRequests(){
 const db=service(),account=agentAccount(),r=await db.from('ga_agent_jobs').select('id,actor').eq('account_id',account).eq('kind','control_cycle').eq('state','queued').order('created_at').limit(5);if(r.error)throw new Error('Job queue unavailable.');
 const ids:string[]=[];for(const j of r.data){const admin=await db.from('ga_admins').select('user_id').eq('user_id',j.actor).maybeSingle();if(admin.error||!admin.data)continue;const c=await db.from('ga_agent_jobs').update({state:'running',updated_at:new Date().toISOString()}).eq('id',j.id).eq('state','queued').select('id');if(c.error)throw new Error('Job claim unavailable.');if(c.data?.length)ids.push(j.id);}return ids;
}
export async function finishControlRequests(ids:string[],ok:boolean){
 if(!ids.length)return;let result:unknown={status:ok?'cycle_completed':'unconfirmed'};if(ok){const p=await readPublishing();result={status:'cycle_completed',enabled:p.enabled,globallyPaused:p.globallyPaused,lastCheckedAt:p.lastCheckedAt,error:p.error,publications:p.publications.map(r=>({model:r.model,state:r.state,error:r.error,google:r.google}))};}
 const r=await service().from('ga_agent_jobs').update({state:ok?'completed':'uncertain',result,error_code:ok?null:'control_cycle_unconfirmed',updated_at:new Date().toISOString()}).in('id',ids).eq('state','running');if(r.error)throw new Error('Job receipt unavailable.');
}
export async function runSourceJob(){
 const db=service(),account=agentAccount(),config=await db.from('ga_ads_control').select('agent_chat_enabled,agent_chat_authorization,global_paused').eq('account_id',account).single();if(config.error||!config.data.agent_chat_enabled||!config.data.agent_chat_authorization||config.data.global_paused)return;
 const r=await db.from('ga_agent_jobs').select('*').eq('account_id',account).eq('kind','source_change').eq('state','queued').order('created_at').limit(1).maybeSingle();if(r.error)throw new Error('Code queue unavailable.');const job=r.data;if(!job)return;
 const admin=await db.from('ga_admins').select('user_id').eq('user_id',job.actor).maybeSingle();if(admin.error||!admin.data)return;
 const claimed=await db.from('ga_agent_jobs').update({state:'running',updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','queued').select('id');if(claimed.error||!claimed.data?.length)return;
 try{const result=await createSourcePullRequest(job.id,job.payload);const saved=await db.from('ga_agent_jobs').update({state:'awaiting_review',result,updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','running');if(saved.error)throw new Error('Code receipt unavailable.');}
 catch{await db.from('ga_agent_jobs').update({state:'uncertain',error_code:'source_creation_unconfirmed',result:{branch:'gsmweb-agent/'+job.id,notice:'Inspect this branch and open pull requests before retrying. A remote write may have completed.'},updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','running');}
}
