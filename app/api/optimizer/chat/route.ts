import {requireAdmin,service,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readAgentContext,agentAccount} from '@/lib/agent-context';
import {askAdvisor,type AdvisoryReply} from '@/lib/agent-model';
import {IntegrationError} from '@/lib/integration-error';
import {readStockMonitor} from '@/lib/ai-ads/monitor-server';
import {stockAdvisorEvidence} from '@/lib/ai-ads/monitor';
export async function GET(){try{
 const {user}=await requireAdmin();const account=agentAccount();
 const {data,error}=await service().from('ga_agent_exchanges').select('id,user_message,assistant_reply,state,created_at,observation_at').eq('account_id',account).eq('actor',user.id).order('created_at',{ascending:false}).limit(20);
 if(error)throw new Error('Chat history unavailable.');
 return Response.json({exchanges:(data??[]).reverse()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);
 const body=await request.json();
 if(typeof body.message!=='string'||!body.message.trim()||body.message.length>4000||typeof body.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id))throw new Error('Invalid chat request.');
 const key=process.env.OPENAI_API_KEY,model=process.env.OPENAI_ADVISOR_MODEL;
 if(!key||!model)throw new IntegrationError('Configure the server AI key and advisor model to enable chat.',503);
 const context=await readAgentContext(),db=service();
 const {data:claimed,error:claimError}=await db.rpc('ga_claim_agent_exchange',{p_id:body.id,p_account:context.accountId,p_actor:user.id,p_message:body.message.trim(),p_observation_at:context.observation?.fetchedAt??null});
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
  const modelContext={...context,stock,accountId:undefined,observation:redact(observation),ronObservation:redact(context.ronObservation)};
  const reply=await askAdvisor({key,model,message:body.message.trim(),context:modelContext,history:(history??[]).reverse().flatMap(row=>[{role:'user' as const,content:row.user_message},{role:'assistant' as const,content:JSON.stringify(row.assistant_reply as AdvisoryReply)}])});
  const saved=await db.from('ga_agent_exchanges').update({assistant_reply:reply,state:'completed'}).eq('id',body.id).eq('actor',user.id).eq('state','pending').select('id');
  if(saved.error||saved.data?.length!==1)throw new Error('Could not save the AI reply.');
  return Response.json({id:body.id,reply},{headers:{'Cache-Control':'no-store'}});
 }catch(error){await db.from('ga_agent_exchanges').update({state:'failed'}).eq('id',body.id).eq('actor',user.id).eq('state','pending');throw error;}
 }catch(error){return apiError(error);}}
