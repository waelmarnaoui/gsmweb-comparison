import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
export type ToolActor={exchangeId:string;account:string;actor:string;readOnly:boolean;userMessage:string};
export async function executeRecordedTool(db:SupabaseClient,who:ToolActor,callId:string,name:string,input:unknown,mutating:boolean,execute:(id:string)=>Promise<unknown>){
 if(!callId||callId.length>200)throw new Error('Invalid tool call identity.');
 const parent=await db.from('ga_agent_exchanges').select('id').eq('id',who.exchangeId).eq('actor',who.actor).eq('account_id',who.account).eq('state','pending').maybeSingle();
 const admin=await db.from('ga_admins').select('user_id').eq('user_id',who.actor).maybeSingle();
 if(parent.error||!parent.data||admin.error||!admin.data)throw new Error('Authenticated owner access is required.');
 const prior=await db.from('ga_agent_tool_runs').select('id,state,result,error_code').eq('exchange_id',who.exchangeId).eq('external_id',callId).eq('actor',who.actor).maybeSingle();if(prior.error)throw new Error('Action history is unavailable.');
 if(prior.data)return prior.data.state==='completed'?prior.data.result:{status:'unconfirmed',notice:'This call is already recorded. It will not be repeated. Check its action history.'};
 if(mutating){if(who.readOnly)return {status:'blocked',notice:'Read Only mode cannot change settings or create jobs. Select Full Control to request supported actions under your saved permissions.'};
  const p=await db.from('ga_ads_control').select('agent_chat_enabled,agent_chat_authorization').eq('account_id',who.account).single();if(p.error||!p.data.agent_chat_enabled||!p.data.agent_chat_authorization)return {status:'blocked',notice:'Chat action permissions are disabled.'};}
 const id=randomUUID(),saved=await db.from('ga_agent_tool_runs').insert({id,exchange_id:who.exchangeId,account_id:who.account,actor:who.actor,external_id:callId,tool:name,input});
 if(saved.error)return {status:'unconfirmed',notice:'The call could not be claimed. Refresh history before retrying.'};
 try{const result=await execute(id);if(JSON.stringify(result).length>150000)throw new Error('Tool result is too large.');
  const r=await db.from('ga_agent_tool_runs').update({state:'completed',result,finished_at:new Date().toISOString()}).eq('id',id).eq('state','pending').select('id');if(r.error||r.data?.length!==1)return {status:'unconfirmed',notice:'Execution may have finished but its receipt could not be stored. Inspect recorded job state; do not assume success.'};return result;
 }catch{const result={status:'failed',notice:'This tool did not return a confirmed result. Check the connection, permissions or job history.'};await db.from('ga_agent_tool_runs').update({state:'failed',error_code:'tool_execution_failed',finished_at:new Date().toISOString()}).eq('id',id).eq('state','pending');return result;}
}
