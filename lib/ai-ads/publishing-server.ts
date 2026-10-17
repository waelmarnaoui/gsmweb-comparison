import 'server-only';
import {service} from '../server';
import {agentAccount,readAgentContext} from '../agent-context';
import {connectionToken} from '../connections';
import {controlStore} from '../ads-control/store';
import {IntegrationError} from '../integration-error';
import {readGrowthMonitor} from './growth-server';
import {readRepairInventory} from './source';
import {COPY_RULES_VERSION} from './copy-rules';
import {campaignOpen} from './search-growth';
import {createPublishingGoogle} from './publishing-google';
import {makePublicationPlan,publicationSpendProblem,publicationStockProblem,type PublicationPlan} from './publishing';
import {createPublicationEngine,type PublicationRow} from './publishing-engine';
const storage=()=>new IntegrationError('Automatic publishing storage is unavailable. Install the reviewed AUTO-PUBLISH-PROPOSED.sql in the attribution database.',503);
export async function readPublishing(){
 const db=service(),account=agentAccount();
 const [config,rows,events]=await Promise.all([
  db.from('ga_ads_control').select('auto_publish_enabled,auto_publish_authorization,auto_publish_checked_at,auto_publish_error,global_paused').eq('account_id',account).single(),
  db.from('ga_ads_publications').select('id,state,error_code,group_resource,ad_resource,google_feedback,checked_at,created_at,plan').eq('account_id',account).order('created_at',{ascending:false}).limit(100),
  db.from('ga_ads_publication_events').select('id,publication_id,event,details,created_at').eq('account_id',account).order('id',{ascending:false}).limit(50)
 ]);if(config.error||rows.error||events.error)throw storage();
 return {enabled:config.data.auto_publish_enabled,globallyPaused:config.data.global_paused,authorized:!!config.data.auto_publish_authorization,lastCheckedAt:config.data.auto_publish_checked_at,error:config.data.auto_publish_error,
  publications:(rows.data??[]).map(r=>({id:r.id,state:r.state,error:r.error_code,groupResource:r.group_resource,adResource:r.ad_resource,google:r.google_feedback,checkedAt:r.checked_at,createdAt:r.created_at,model:r.plan.model,partType:r.plan.partType,groupName:r.plan.groupName})),events:events.data??[],limitations:['Ads are created Enabled inside new paused model-specific groups. Groups open automatically only after the exact ad is approved without policy restrictions.','Only newly created agent-owned groups can be enabled or paused. Existing ads, groups, campaign settings and budgets are protected.','Google reporting can lag; the allowance is not a guaranteed billing cap. Existing ads may continue spending.','The paired laptop must remain powered, online and running its worker.']};
}
export async function setPublishing(actor:string,enabled:boolean){
 const db=service(),account=agentAccount();const r=await db.from('ga_ads_control').update({auto_publish_enabled:enabled,...(enabled?{auto_publish_authorization:`Dashboard approval by ${actor}: truthful installation-only stock/search ads; Enabled ads held in paused new groups pending Google review.`,global_paused:false}:{})}).eq('account_id',account);if(r.error)throw storage();
 const audit=await db.from('ga_audit').insert({actor,action:enabled?'enabled':'disabled',entity:'automatic_stock_search_publication',record_id:account,details:{enabled,scope:'new_agent_owned_model_groups',initialAdStatus:'ENABLED',initialGroupStatus:'PAUSED'}});if(audit.error)throw storage();
}
let active:Promise<{checked:boolean;busy?:boolean}>|null=null;
export async function runPublishingTick(){
 if(active)return active;
 active=(async()=>{
  const db=service(),account=agentAccount(),store=controlStore(db),token=await store.lock(account);if(!token)return {checked:false,busy:true};
  const google=createPublishingGoogle({accountId:account,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,token:async()=>(await connectionToken('google_ads_management')).token,signal:AbortSignal.timeout(170000)});
  async function authorized(){const r=await db.from('ga_ads_control').select('auto_publish_enabled,auto_publish_authorization,global_paused').eq('account_id',account).single();if(r.error)throw storage();return r.data.auto_publish_enabled===true&&!!r.data.auto_publish_authorization&&!r.data.global_paused;}
  async function guard(plan:PublicationPlan,activation:boolean){
   if(plan.copyRulesVersion!==COPY_RULES_VERSION)return 'draft_copy_rules_changed';
   const growth=await readGrowthMonitor();if(!growth.reliable||growth.report?.copyRulesVersion!==COPY_RULES_VERSION)return 'search_monitoring_stale';
   const report=growth.report.search,campaign=report.campaigns.find((c:{id:string})=>c.id===plan.campaignId);if(!campaign||!campaignOpen(campaign,report.timeZone))return 'outside_campaign_schedule';
   try{await google.campaign(plan.campaignId);const inventory=await readRepairInventory();if(!inventory.complete)return 'stock_unverified';const problem=publicationStockProblem(plan,inventory.parts.find(p=>p.id===plan.productId)??null);if(problem)return problem;}catch{return 'stock_or_campaign_unverified';}
   if(activation){if(!await google.localTargeting(plan.campaignId))return 'local_targeting_unverified';return publicationSpendProblem(await readAgentContext(),account);}return null;
  }
  const engine=createPublicationEngine({google,authorized,guard,store:{fence:()=>store.fence(account,token),save:async(row,patch)=>{const r=await db.from('ga_ads_publications').update({...patch,version:row.version+1,updated_at:new Date().toISOString()}).eq('id',row.id).eq('account_id',account).eq('version',row.version).select('*').single();if(r.error||!r.data)throw storage();return r.data as PublicationRow;}}});
  try{
   // Monitoring continues even when new publication is disabled. Only authorized
   // agent-owned resources can ever be changed; ambiguous creation is never retried.
   const current=await db.from('ga_ads_publications').select('*').eq('account_id',account).neq('state','prepared').neq('state','failed').order('checked_at',{ascending:true,nullsFirst:true}).limit(1);if(current.error)throw storage();
   for(const row of current.data??[])await engine.monitor(row as PublicationRow);
   if(await authorized()){
    const growth=await readGrowthMonitor();
    if(growth.reliable&&growth.report?.copyRulesVersion===COPY_RULES_VERSION){
     const known=await db.from('ga_ads_publications').select('id').eq('account_id',account).limit(1001);if(known.error)throw storage();if((known.data?.length??0)>=1000)throw new IntegrationError('Review publication history before creating more model groups.',409);
     const keys=new Set((known.data??[]).map(r=>r.id));
     const inventory=await readRepairInventory();if(!inventory.complete)throw new IntegrationError('Current inventory could not be verified.',503);
     for(const opportunity of growth.report.opportunities){
      const part=inventory.parts.find(p=>p.id===opportunity.productId);if(!part)continue;
      const strategy=await google.campaign(opportunity.campaignId);let plan:PublicationPlan;try{plan=makePublicationPlan(opportunity,part,growth.report.search,strategy);}catch{continue;}
      if(keys.has(plan.key))continue;
      const r=await db.from('ga_ads_publications').upsert({id:plan.key,account_id:account,plan},{onConflict:'id',ignoreDuplicates:true});if(r.error)throw storage();break;
     }
     const prepared=await db.from('ga_ads_publications').select('*').eq('account_id',account).eq('state','prepared').order('checked_at',{ascending:true,nullsFirst:true}).limit(1);if(prepared.error)throw storage();
     for(const row of prepared.data??[])await engine.create(row as PublicationRow);
    }
   }
   const r=await db.from('ga_ads_control').update({auto_publish_checked_at:new Date().toISOString(),auto_publish_error:null}).eq('account_id',account);if(r.error)throw storage();return {checked:true};
  }catch(error){await db.from('ga_ads_control').update({auto_publish_checked_at:new Date().toISOString(),auto_publish_error:'publication_tick_incomplete'}).eq('account_id',account);throw error;}
  finally{await store.unlock(account,token);}
 })();try{return await active;}finally{active=null;}
}
