import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {service} from './server';
import {actionTools} from './agent-actions';
import {agentAccount} from './agent-context';
import {sourceContent} from './agent-source-policy';
import {isOllamaReadTool,type OllamaAction} from './ollama-actions';
import type {ToolActor} from './agent-tool-runtime';
import {IntegrationError} from './integration-error';

export function ollamaToolCatalog(message:string,who:ToolActor){
 const all=actionTools(who),names=['account_overview'];
 if(/ad|anun|reclam|draft/i.test(message))names.push('save_ad_drafts','advertising_status');
 if(/stock|inventory|stoc|pies/i.test(message))names.push('inventory');
 if(/payment|incas|încas|cash|receipts|plat/i.test(message))names.push('customer_payments','record_daily_payments');
 if(/click|website|site/i.test(message))names.push('website_clicks');
 if(/repair|repar|sale|vanz|vânz|client/i.test(message))names.push('business_records');
 if(/remember|preference|tine minte|ține minte/i.test(message))names.push('remember_business_preference');
 if(/code|source|cod|deploy|merge|modif|feature|implement/i.test(message))names.push('source_files','read_source_file','create_source_change','deploy_source_change');
 if(/automat|pause|resume|report|raport|control/i.test(message))names.push('automation_settings','run_control_cycle');
 if(/research|overnight|tonight|night|cercet|noapte/i.test(message))names.push('queue_research_task');
 const selected=[...new Set(names)].slice(-5);
 return selected.map(name=>{const tool=all[name as keyof typeof all];return {name,description:typeof tool.description==='string'?tool.description:'',inputSchema:z.toJSONSchema(tool.inputSchema as z.ZodType)};});
}
export async function handleOllamaActions(who:ToolActor,actions:OllamaAction[],dependencies?:{db:any;tools:ReturnType<typeof actionTools>}){
 const db=dependencies?.db??service(),tools=dependencies?.tools??actionTools(who),outcomes:string[]=[];
 for(const [index,action] of actions.entries()){
  try{
   const tool=tools[action.tool as keyof typeof tools];if(!tool)throw new Error('Unsupported tool.');
   const input=(tool.inputSchema as z.ZodType).parse(JSON.parse(action.inputJson));sourceContent(JSON.stringify(input));
   if(isOllamaReadTool(action.tool)){
    const result=await (tool.execute as Function)(input,{toolCallId:'ollama-read:'+index,messages:[]});
    outcomes.push(action.tool+' receipt (inspect status): '+JSON.stringify(result).slice(0,5000));
   }else if(who.readOnly){outcomes.push(action.tool+': not executed. Select Full Control and send the request again to prepare an approval.');}
   else{
    const external='ollama-proposal:'+index;
    const previous=await db.from('ga_agent_tool_runs').select('id').eq('exchange_id',who.exchangeId).eq('external_id',external).eq('actor',who.actor).maybeSingle();if(previous.error)throw new Error('History unavailable.');
    if(!previous.data){const saved=await db.from('ga_agent_tool_runs').insert({id:randomUUID(),exchange_id:who.exchangeId,account_id:who.account,actor:who.actor,external_id:external,tool:'proposal:'+action.tool,input,result:{reason:action.reason,status:'awaiting_approval'}});if(saved.error)throw new Error('Proposal unavailable.');}
    outcomes.push(action.tool+': awaiting your approval in Action approvals. No change executed.');
   }
  }catch{outcomes.push(action.tool+': not executed; input validation, access or storage checks failed.');}
 }
 return outcomes;
}
export async function readOllamaActions(actor:string){
 const r=await service().from('ga_agent_tool_runs').select('id,tool,input,state,result,created_at').eq('account_id',agentAccount()).eq('actor',actor).like('tool','proposal:%').order('created_at',{ascending:false}).limit(30);if(r.error)throw new IntegrationError('Action approvals unavailable.',503);
 const drafts=await service().from('ga_agent_tool_runs').select('id,result,created_at').eq('account_id',agentAccount()).eq('actor',actor).eq('tool','save_ad_drafts').eq('state','completed').order('created_at',{ascending:false}).limit(30);if(drafts.error)throw new IntegrationError('Saved drafts unavailable.',503);
 return {actions:r.data,drafts:(drafts.data??[]).flatMap(row=>Array.isArray(row.result?.drafts)?row.result.drafts:[])};
}
export async function decideOllamaAction(actor:string,id:string,approve:boolean,dependencies?:{db:any;account:string;tools?:ReturnType<typeof actionTools>}){
 const db=dependencies?.db??service(),account=dependencies?.account??agentAccount();
 const r=await db.from('ga_agent_tool_runs').select('*').eq('id',id).eq('account_id',account).eq('actor',actor).like('tool','proposal:%').single();
 if(r.error||!r.data||r.data.state!=='pending')throw new IntegrationError('This proposal is unavailable or already decided. It will not run again.',409);
 const row=r.data;if(approve&&Date.now()-Date.parse(row.created_at)>86400000)throw new IntegrationError('Proposal expired. Ask for a fresh proposal.',409);
 const parent=await db.from('ga_agent_exchanges').select('user_message').eq('id',row.exchange_id).eq('actor',actor).eq('account_id',account).single();if(parent.error)throw new IntegrationError('Original request unavailable.',503);
 const name=row.tool.slice('proposal:'.length),exchangeId=randomUUID(),who={actor,account,exchangeId,readOnly:false,userMessage:'Owner approved '+name+'. '+parent.data.user_message},tools=dependencies?.tools??actionTools(who),tool=tools[name as keyof typeof tools];
 if(!tool||isOllamaReadTool(name))throw new IntegrationError('Invalid proposed action.',400);
 const input=(tool.inputSchema as z.ZodType).parse(row.input);sourceContent(JSON.stringify(input));
 if(approve){const permission=await db.from('ga_ads_control').select('agent_chat_enabled,agent_chat_authorization').eq('account_id',account).single();if(permission.error||!permission.data.agent_chat_enabled||!permission.data.agent_chat_authorization)throw new IntegrationError('Enable supported chat actions in Agent access before approving.',403);}
 // Claim the exact saved payload before any external write. An interrupted claim is never replayed.
 const claim=await db.from('ga_agent_tool_runs').update({state:approve?'completed':'failed',result:{status:approve?'execution_claimed':'rejected',reason:row.result?.reason},finished_at:new Date().toISOString()}).eq('id',id).eq('actor',actor).eq('state','pending').select('id');
 if(claim.error||claim.data?.length!==1)throw new IntegrationError('Proposal was already claimed. Check history; do not retry it.',409);
 if(!approve)return {status:'rejected'};
 const claimed=await db.rpc('ga_claim_agent_exchange',{p_id:exchangeId,p_account:account,p_actor:actor,p_message:who.userMessage.slice(0,3900),p_observation_at:null});
 if(claimed.error||!claimed.data)throw new IntegrationError('Approval was recorded but execution could not start. Inspect history; it was not resent.',409);
 let result:unknown;
 try{result=await (tool.execute as Function)(input,{toolCallId:'approved:'+id,messages:[]});}catch{result={status:'unconfirmed',notice:'Execution did not return a confirmed receipt. Inspect activity before another request.'};}
 const saved=await db.from('ga_agent_tool_runs').update({result,finished_at:new Date().toISOString()}).eq('id',id).eq('actor',actor);
 await db.from('ga_agent_exchanges').update({state:'completed',assistant_reply:{reply:'Approved action result: '+JSON.stringify(result).slice(0,4000),evidence:[],recommendation:'Review the recorded receipt.',expectedImpact:'Only confirmed results count as completed.',risks:'No automatic retry.',confidence:'low',missingData:[]}}).eq('id',exchangeId).eq('actor',actor).eq('state','pending');
 if(saved.error)throw new IntegrationError('Execution receipt could not be saved. Do not resend the action.',503);
 return result;
}
