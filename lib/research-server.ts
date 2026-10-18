import 'server-only';
import {service} from './server';
import {agentAccount,readAgentContext} from './agent-context';
import {readGrowthMonitor} from './ai-ads/growth-server';
import {researchRequestSchema,researchSourceBlock} from './research-task';
import {sourceContent} from './agent-source-policy';
import {IntegrationError} from './integration-error';
export async function queueResearchTask(actor:string,input:unknown){
 const parsed=researchRequestSchema.parse(input);sourceContent(parsed.instructions);
 const blocked=researchSourceBlock(parsed.instructions);if(blocked)throw new IntegrationError(blocked,409);
 const db=service(),account=agentAccount();
 const count=await db.from('ga_research_tasks').select('id').eq('account_id',account).eq('actor',actor).in('state',['queued','running','paused']).limit(11);if(count.error||count.data.length>=10)throw new IntegrationError('Finish or cancel existing research tasks first.',409);
 const context=await readAgentContext();let search:unknown={available:false};
 try{const saved=await readGrowthMonitor();const data=saved.report?.search;search=data?{available:true,from:data.start,to:data.end,fetchedAt:data.fetchedAt,currency:data.currency,terms:data.terms.slice(0,200),notice:'Saved search-term data only. Not a complete keyword report. Use the actual recorded date range, never claim 30 days if coverage is shorter.'}:{available:false};}catch{/* Missing reporting is unknown. */}
 const facts={businessDate:context.businessDate,search,notice:'No live web research or Google API refresh is performed. Missing data must be reported as missing.'};
 const created=await db.from('ga_research_tasks').insert({account_id:account,actor,kind:'general',title:parsed.title,instructions:parsed.instructions,input:facts,deadline_at:new Date(Date.now()+parsed.hours*3600000).toISOString()}).select('id').single();if(created.error)throw new Error('Research task could not be queued.');
 return {id:created.data.id,state:'queued',notice:'Saved-data research only. The paired research computer must be running. No account changes will be made.'};
}
