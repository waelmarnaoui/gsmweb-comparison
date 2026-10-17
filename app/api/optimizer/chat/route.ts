import {requireAdmin,service,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readAgentContext,agentAccount} from '@/lib/agent-context';
import {type AdvisoryReply} from '@/lib/agent-model';
import {runActionAgent} from '@/lib/action-agent-model';
import {sourceContent} from '@/lib/agent-source-policy';
import {actionTools} from '@/lib/agent-actions';
export const maxDuration=300;
import {IntegrationError} from '@/lib/integration-error';
import {readStockMonitor} from '@/lib/ai-ads/monitor-server';
import {advisorConfiguration} from '@/lib/advisor-settings-server';
import {readPublishing} from '@/lib/ai-ads/publishing-server';
import {stockAdvisorEvidence} from '@/lib/ai-ads/monitor';
import {parseChatAttachments} from '@/lib/chat-attachments';
import {CHAT_MESSAGE_LIMIT,savedChatMessage} from '@/lib/chat-policy';
import {chatFailureMessage,chatFailureReply} from '@/lib/agent-failure';
export async function GET(){try{
 const {user}=await requireAdmin();const account=agentAccount();
 const {data,error}=await service().from('ga_agent_exchanges').select('id,user_message,assistant_reply,state,created_at,observation_at').eq('account_id',account).eq('actor',user.id).order('created_at',{ascending:false}).limit(20);
 if(error)throw new Error('Chat history unavailable.');
 return Response.json({exchanges:(data??[]).reverse()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error instanceof Error&&error.name==='AdvisorProviderError'?new IntegrationError(error.message,503):error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);
 const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>3_700_000)throw new IntegrationError('Message and attachments are too large.',413);
 let body;try{body=JSON.parse(raw);}catch{throw new IntegrationError('Invalid chat request.',400);}
 let attachments;try{attachments=parseChatAttachments(body.attachments);}catch(error){throw new IntegrationError(error instanceof Error?error.message:'Invalid attachments.',400);}
 if(typeof body.message!=='string'||!body.message.trim()||typeof body.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id))throw new Error('Invalid chat request.');
 if(body.message.length>CHAT_MESSAGE_LIMIT)throw new IntegrationError('Message exceeds 4,000 characters. Attach the full text for a read-only review instead. Nothing was sent to the AI.',400);
 if(body.readOnly!==undefined&&typeof body.readOnly!=='boolean')throw new IntegrationError('Invalid review mode.',400);
 try{sourceContent(body.message);}catch{throw new IntegrationError('Keep credentials out of chat. Use the secure connection form.',400);}
 const {key,model}=await advisorConfiguration();
 if(!key||!model)throw new IntegrationError('Add your Gemini API key in AI settings on this dashboard to enable chat.',503);
 const context=await readAgentContext(),db=service();
 let savedMessage;try{savedMessage=savedChatMessage(body.message,attachments.map(file=>file.name));}catch(error){throw new IntegrationError(error instanceof Error?error.message:'Message is too long.',400);}
 const {data:claimed,error:claimError}=await db.rpc('ga_claim_agent_exchange',{p_id:body.id,p_account:context.accountId,p_actor:user.id,p_message:savedMessage,p_observation_at:context.observation?.fetchedAt??null});
 if(claimError)throw new IntegrationError('Chat is busy or its hourly limit was reached. Wait, then retry.',429);
 if(!claimed)throw new IntegrationError('This request was already submitted. Refresh chat history.',409);
 try{
  const {data:history,error}=await db.from('ga_agent_exchanges').select('user_message,assistant_reply').eq('account_id',context.accountId).eq('actor',user.id).eq('state','completed').order('created_at',{ascending:false}).limit(6);
  if(error)throw new Error('Chat history unavailable.');
  // Never send campaign names, arbitrary metadata, account IDs or request IDs to the model.
  const observation=context.observation;
  const redact=(data:typeof observation)=>data?{...data,accountId:undefined,requestIds:undefined,campaigns:data.campaigns.map(c=>({...c,name:undefined}))}:null;
  let stock:unknown={available:false,reliable:false,publicationBlocked:true,notice:'Stock monitoring has not been verified.'};
  try{stock=stockAdvisorEvidence(await readStockMonitor());}catch{/* Missing stock setup must remain unknown without disabling account chat. */}
  let automaticPublication:unknown={available:false};
  try{const p=await readPublishing();automaticPublication={available:true,correctionsEnabled:p.correctionsEnabled,correctionScope:'One factual editorial replacement of agent-created disapproved ads; eligible, limited and business-policy cases unchanged.',enabled:p.enabled,globallyPaused:p.globallyPaused,lastCheckedAt:p.lastCheckedAt,error:p.error,publications:p.publications.slice(0,20).map(r=>({model:r.model,partType:r.partType,state:r.state,error:r.error,google:r.google?{groupStatus:r.google.groupStatus,adStatus:r.google.adStatus,approval:r.google.approval,review:r.google.review,topics:r.google.topics}:null,checkedAt:r.checkedAt})),limitations:p.limitations};}catch{/* Missing publishing setup is unknown, never fabricated success. */}
  const preferences=await db.from('ga_agent_preferences').select('name,value,updated_at').eq('account_id',context.accountId).order('name').limit(30);
  const modelContext={...context,businessPreferences:preferences.error?{available:false}:preferences.data,stock,automaticPublication,accountId:undefined,observation:redact(observation),ronObservation:redact(context.ronObservation)};
  const reply=await runActionAgent({key,model,attachments,tools:actionTools({exchangeId:body.id,account:context.accountId,actor:user.id,userMessage:body.message.trim(),readOnly:body.readOnly===true||body.message.trim()==='Analyze the latest account report. Explain what you observed, the highest priority improvement, expected impact, risks and missing information. Do not change the account.'}),message:body.message.trim(),context:modelContext,history:(history??[]).reverse().flatMap(row=>[{role:'user' as const,content:(()=>{try{return sourceContent(row.user_message);}catch{return '[Credential-like message excluded.]';}})()},{role:'assistant' as const,content:JSON.stringify(row.assistant_reply as AdvisoryReply)}])});
  const saved=await db.from('ga_agent_exchanges').update({assistant_reply:reply,state:'completed'}).eq('id',body.id).eq('actor',user.id).eq('state','pending').select('id');
  if(saved.error||saved.data?.length!==1)throw new Error('Could not save the AI reply.');
  return Response.json({id:body.id,reply},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  let receipts:{tool:string;state:string}[]|null=null;try{const result=await db.from('ga_agent_tool_runs').select('tool,state').eq('exchange_id',body.id).eq('actor',user.id).eq('account_id',context.accountId).order('created_at').limit(50);if(!result.error)receipts=result.data;}catch{/* Unknown execution status must remain explicit. */}
  await db.from('ga_agent_exchanges').update({state:'failed',assistant_reply:chatFailureReply(error,receipts)}).eq('id',body.id).eq('actor',user.id).eq('state','pending');
  throw new IntegrationError(chatFailureMessage(error)+' Check Settings & activity for recorded actions or jobs before retrying. Nothing was automatically resent.',503);
 }
 }catch(error){return apiError(error instanceof Error&&error.name==='AdvisorProviderError'?new IntegrationError(error.message,503):error);}}
