import 'server-only';
import {tool} from 'ai';
import {z} from 'zod';
import {service} from './server';
import {agentAccount} from './agent-context';
import {advisorConfiguration} from './advisor-settings-server';
import {runActionAgent} from './action-agent-model';
import {readBusinessPayments,readBusinessClicks} from './agent-business-server';
import {businessDay} from './agent-policy';
const version='action-tools-v1';
// One real, bounded verification per account/release. No advertising mutations.
export async function checkActionRuntime(){
 const db=service(),account=agentAccount(),c=await db.from('ga_ads_control').select('agent_chat_enabled').eq('account_id',account).single();if(c.error||!c.data.agent_chat_enabled)return;
 const {key,model}=await advisorConfiguration();if(!key)return;
 const claim=await db.from('ga_agent_runtime_checks').upsert({account_id:account,version,status:'running'},{onConflict:'account_id,version',ignoreDuplicates:true}).select('version');if(claim.error||!claim.data?.length)return;
 let details:Record<string,unknown>={provider:'anthropic',model,sdkToolExecuted:false};
 try{
  await runActionAgent({key,model,message:'Run runtime_probe once to verify the connected data tools. Then give a brief factual completion reply. This is a read-only connection check; do not change anything.',history:[],context:{runtimeCheck:true},tools:{runtime_probe:tool({description:'Verify read-only CRM payments and tracked website event access.',inputSchema:z.object({}).strict(),execute:async()=>{
   const date=businessDay().date,[payments,clicks]=await Promise.allSettled([readBusinessPayments(date,date),readBusinessClicks(date,date)]);
   details={...details,sdkToolExecuted:true,date,crmPaymentsAvailable:payments.status==='fulfilled',websiteClicksAvailable:clicks.status==='fulfilled',...(payments.status==='fulfilled'?{paymentTotalBani:payments.value.totalNetBani}:{}),...(clicks.status==='fulfilled'?{trackedWebsiteEvents:clicks.value.trackedEvents}:{})};return details;
  }})}});
  await db.from('ga_agent_runtime_checks').update({status:details.sdkToolExecuted?'completed':'failed',details,finished_at:new Date().toISOString()}).eq('account_id',account).eq('version',version);
 }catch{await db.from('ga_agent_runtime_checks').update({status:'failed',details:{...details,error:'runtime_check_incomplete'},finished_at:new Date().toISOString()}).eq('account_id',account).eq('version',version);}
}
