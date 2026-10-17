import 'server-only';
import {correctionAllowed,makeEditorialCorrection,correctionParentMatches} from './corrections';
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
import {makePublicationPlan,publicationSpendProblem,publicationStockProblem,type PublicationPlan,type PublicationFeedback} from './publishing';
import {createPublicationEngine,type PublicationRow} from './publishing-engine';
import {policyOnlyIntervention} from './intervention-server';
import {feedbackFresh} from './intervention-policy';
import {isGoogleQuotaError} from '../ads-control/google';
import {quotaWait} from './quota-policy';
import {ADS_WEB_ONLY} from '../ads-web-mode';
import {webAdsResources} from '../ads-web-server';
const storage=()=>new IntegrationError('Automatic publishing storage is unavailable. Install the reviewed AUTO-PUBLISH-PROPOSED.sql in the attribution database.',503);
export async function publishingQuotaWait(){
 const r=await service().from('ga_ads_control').select('auto_publish_error,auto_publish_checked_at').eq('account_id',agentAccount()).single();
 if(r.error)throw storage();return quotaWait(r.data.auto_publish_error,r.data.auto_publish_checked_at);
}
export async function recordPublishingQuota(){
 const r=await service().from('ga_ads_control').update({auto_publish_checked_at:new Date().toISOString(),auto_publish_error:'google_ads_quota_cooldown'}).eq('account_id',agentAccount());if(r.error)throw storage();
}
export async function readPublishing(){
 const db=service(),account=agentAccount();
 const [config,rows,events]=await Promise.all([
  db.from('ga_ads_control').select('auto_publish_enabled,auto_publish_authorization,auto_publish_checked_at,auto_publish_error,global_paused,auto_correction_enabled,auto_correction_authorization').eq('account_id',account).single(),
  db.from('ga_ads_publications').select('id,state,error_code,group_resource,ad_resource,google_feedback,checked_at,created_at,plan').eq('account_id',account).order('created_at',{ascending:false}).limit(100),
  db.from('ga_ads_publication_events').select('id,publication_id,event,details,created_at').eq('account_id',account).order('id',{ascending:false}).limit(50)
 ]);if(config.error||rows.error||events.error)throw storage();
 const policyOnly=await policyOnlyIntervention(),web=ADS_WEB_ONLY?await webAdsResources():null;
 const feedback=(r:Pick<PublicationRow,'ad_resource'|'group_resource'|'google_feedback'>):PublicationFeedback|null=>{const ad=web?.ads.find(a=>a.resourceName===r.ad_resource);return ad?{groupResource:r.group_resource??'UNKNOWN',adResource:ad.resourceName,groupStatus:'UNKNOWN',adStatus:ad.status,approval:ad.approvalStatus,review:ad.reviewStatus,topics:ad.topics,observedAt:web?.fetchedAt??undefined}:r.google_feedback;};
 return {executionMode:ADS_WEB_ONLY?'web_only':'worker',interventionScope:policyOnly?'ineligible_only':'authorized_stock_publication',correctionsEnabled:!ADS_WEB_ONLY&&config.data.auto_correction_enabled,correctionsAuthorized:!!config.data.auto_correction_authorization,enabled:!ADS_WEB_ONLY&&config.data.auto_publish_enabled,globallyPaused:config.data.global_paused,authorized:!!config.data.auto_publish_authorization,lastCheckedAt:ADS_WEB_ONLY?web?.fetchedAt??null:config.data.auto_publish_checked_at,error:ADS_WEB_ONLY?null:config.data.auto_publish_error,
  publications:(rows.data??[]).map(r=>({id:r.id,state:r.state,error:r.error_code,groupResource:r.group_resource,adResource:r.ad_resource,google:feedback(r),googleFeedbackFresh:feedbackFresh(feedback(r)),feedbackObservedAt:feedback(r)?.observedAt??null,eligibility:feedbackFresh(feedback(r))?feedback(r)?.approval??'UNKNOWN':'UNKNOWN',checkedAt:r.checked_at,createdAt:r.created_at,model:r.plan.model,partType:r.plan.partType,groupName:r.plan.groupName,correctionOf:r.plan.correction?.parentId??null})),events:events.data??[],limitations:[...(policyOnly&&!ADS_WEB_ONLY?['Policy-only restriction is enforced. Existing groups are read-only, even when eligible but paused. No new unrelated ads are published. Only separately authorized, one-time factual editorial correction drafts for confirmed disapprovals may be submitted in paused new groups.']:[]),'Policy feedback is a saved snapshot, not a live lookup. googleFeedbackFresh=false means current eligibility is UNKNOWN; a failed read must never refresh old policy evidence.','Business-policy restrictions require owner review or Google appeal; never disguise the advertised service or retry policy evasion.','Ads are created Enabled inside new paused model-specific groups. Groups open automatically only after the exact ad is approved without policy restrictions.','Only newly created agent-owned groups can be enabled or paused. Existing ads, groups, campaign settings and budgets are protected.','Google reporting can lag; the allowance is not a guaranteed billing cap. Existing ads may continue spending.',ADS_WEB_ONLY?'Web-only mode: no laptop or background Ads control is used. Existing ads are left unchanged.':'The paired laptop must remain powered, online and running its worker.']};
}
export async function setPublishing(actor:string,enabled:boolean){
 if(ADS_WEB_ONLY&&enabled)throw new IntegrationError('Automatic Ads publishing is paused in web-only mode. Existing ads remain untouched.',409);
 const db=service(),account=agentAccount();const r=await db.from('ga_ads_control').update({auto_publish_enabled:enabled,...(enabled?{auto_publish_authorization:`Dashboard approval by ${actor}: truthful installation-only stock/search ads; Enabled ads held in paused new groups pending Google review.`,global_paused:false}:{})}).eq('account_id',account);if(r.error)throw storage();
 const audit=await db.from('ga_audit').insert({actor,action:enabled?'enabled':'disabled',entity:'automatic_stock_search_publication',record_id:account,details:{enabled,scope:'new_agent_owned_model_groups',initialAdStatus:'ENABLED',initialGroupStatus:'PAUSED'}});if(audit.error)throw storage();
}
export async function setCorrections(actor:string,enabled:boolean){
 if(ADS_WEB_ONLY&&enabled)throw new IntegrationError('Automatic ad edits are paused in web-only mode. Review policy results without changing eligible ads.',409);
 const r=await service().from('ga_ads_control').update({auto_correction_enabled:enabled,...(enabled?{auto_correction_authorization:`Dashboard approval by ${actor}: one factual editorial correction of agent-created disapproved ads only; originals, eligible and limited ads protected.`}:{})}).eq('account_id',agentAccount());if(r.error)throw storage();
}
let active:Promise<{checked:boolean;busy?:boolean}>|null=null;
export async function runPublishingTick(options:{readOnly?:boolean}={}){
 if(ADS_WEB_ONLY){if(options.readOnly){await webAdsResources(true);return {checked:true,mode:'web_only'};}return {checked:false,mode:'web_only'};}
 if(active)return options.readOnly?{checked:false,busy:true}:active;
 active=(async()=>{
  const db=service(),account=agentAccount(),store=controlStore(db),token=await store.lock(account);if(!token)return {checked:false,busy:true};
  const google=createPublishingGoogle({accountId:account,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,token:async()=>(await connectionToken('google_ads_management')).token,signal:AbortSignal.timeout(170000)});
  async function authorized(){if(options.readOnly)return false;const r=await db.from('ga_ads_control').select('auto_publish_enabled,auto_publish_authorization,global_paused').eq('account_id',account).single();if(r.error)throw storage();return r.data.auto_publish_enabled===true&&!!r.data.auto_publish_authorization&&!r.data.global_paused;}
  async function guard(plan:PublicationPlan,activation:boolean){
   if(plan.copyRulesVersion!==COPY_RULES_VERSION)return 'draft_copy_rules_changed';
   if(plan.correction){
    if(!activation){const c=await db.from('ga_ads_control').select('auto_correction_enabled,auto_correction_authorization').eq('account_id',account).single();if(c.error||!c.data.auto_correction_enabled||!c.data.auto_correction_authorization)return 'automatic_corrections_disabled';}
    const p=await db.from('ga_ads_publications').select('*').eq('id',plan.correction.parentId).eq('account_id',account).single();
    if(p.error||!p.data||p.data.plan.correction||!p.data.group_resource||!p.data.ad_resource||p.data.pending_operation||!['submitted','paused'].includes(p.data.state)||p.data.error_code==='owner_paused_group')return 'correction_parent_unverified';
    const f=await google.inspect(p.data.plan);if(!correctionParentMatches(plan,p.data,f))return 'correction_feedback_changed';
   }else if(activation){const child=await db.from('ga_ads_publications').select('id').eq('account_id',account).contains('plan',{correction:{parentId:plan.key}}).limit(1);if(child.error)throw storage();if(child.data?.length)return 'replaced_by_editorial_correction';}

   const growth=await readGrowthMonitor();if(!growth.reliable||growth.report?.copyRulesVersion!==COPY_RULES_VERSION)return 'search_monitoring_stale';
   const report=growth.report.search,campaign=report.campaigns.find((c:{id:string})=>c.id===plan.campaignId);if(!campaign||!campaignOpen(campaign,report.timeZone))return 'outside_campaign_schedule';
   try{await google.campaign(plan.campaignId);const inventory=await readRepairInventory();if(!inventory.complete)return 'stock_unverified';const problem=publicationStockProblem(plan,inventory.parts.find(p=>p.id===plan.productId)??null);if(problem)return problem;}catch{return 'stock_or_campaign_unverified';}
   if(activation){if(!await google.localTargeting(plan.campaignId))return 'local_targeting_unverified';return publicationSpendProblem(await readAgentContext(),account);}return null;
  }
  const engine=createPublicationEngine({google,authorized,guard,policyOnly:()=>options.readOnly?Promise.resolve(true):policyOnlyIntervention(),store:{fence:()=>store.fence(account,token),save:async(row,patch)=>{const r=await db.from('ga_ads_publications').update({...patch,version:row.version+1,updated_at:new Date().toISOString()}).eq('id',row.id).eq('account_id',account).eq('version',row.version).select('*').single();if(r.error||!r.data)throw storage();return r.data as PublicationRow;}}});
  try{
   const wait=await publishingQuotaWait();if(wait)return {checked:false,quotaPaused:true,retryAfter:wait};
   // Monitoring continues even when new publication is disabled. Only authorized
   // agent-owned resources can ever be changed; ambiguous creation is never retried.
   const current=await db.from('ga_ads_publications').select('*').eq('account_id',account).neq('state','prepared').neq('state','failed').order('checked_at',{ascending:true,nullsFirst:true}).limit(options.readOnly?6:1);if(current.error)throw storage();
   for(const row of current.data??[]){
    const monitored=await engine.monitor(row as PublicationRow);
    if(/^(google_publication_|publication_operation_unconfirmed|publication_unconfirmed|publication_missing)/.test(monitored.error_code??''))throw new IntegrationError('Google policy inspection did not complete. Saved policy feedback is historical, not a fresh result.',503);
    if(await authorized()&&!monitored.plan.correction&&!monitored.pending_operation&&['submitted','paused'].includes(monitored.state)&&monitored.error_code!=='owner_paused_group'){
     const c=await db.from('ga_ads_control').select('auto_correction_enabled,auto_correction_authorization').eq('account_id',account).single();if(c.error)throw storage();
     if(c.data.auto_correction_enabled&&c.data.auto_correction_authorization){
      const existing=await db.from('ga_ads_publications').select('id').eq('account_id',account).contains('plan',{correction:{parentId:monitored.id}}).limit(1);if(existing.error)throw storage();
      if(!existing.data?.length){const f=await google.inspect(monitored.plan);
       if(f&&f.groupResource===monitored.group_resource&&f.adResource===monitored.ad_resource&&correctionAllowed(f)){
        const inventory=await readRepairInventory(),part=inventory.parts.find(p=>p.id===monitored.plan.productId);
        const plan=inventory.complete&&part?makeEditorialCorrection(monitored.plan,f,part):null;
        if(plan){const saved=await db.from('ga_ads_publications').upsert({id:plan.key,account_id:account,plan},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw storage();}
       }
      }
     }
    }
   }
   if(await authorized()){
    const growth=await readGrowthMonitor();
    if(growth.reliable&&growth.report?.copyRulesVersion===COPY_RULES_VERSION){
     const policyOnly=await policyOnlyIntervention();
     const known=await db.from('ga_ads_publications').select('id').eq('account_id',account).limit(1001);if(known.error)throw storage();if((known.data?.length??0)>=1000)throw new IntegrationError('Review publication history before creating more model groups.',409);
     const keys=new Set((known.data??[]).map(r=>r.id));
     const inventory=await readRepairInventory();if(!inventory.complete)throw new IntegrationError('Current inventory could not be verified.',503);
     for(const opportunity of policyOnly?[]:growth.report.opportunities){
      const part=inventory.parts.find(p=>p.id===opportunity.productId);if(!part)continue;
      const strategy=await google.campaign(opportunity.campaignId);let plan:PublicationPlan;try{plan=makePublicationPlan(opportunity,part,growth.report.search,strategy);}catch{continue;}
      if(keys.has(plan.key))continue;
      const r=await db.from('ga_ads_publications').upsert({id:plan.key,account_id:account,plan},{onConflict:'id',ignoreDuplicates:true});if(r.error)throw storage();break;
     }
     let pending=db.from('ga_ads_publications').select('*').eq('account_id',account).eq('state','prepared');if(policyOnly)pending=pending.contains('plan',{correction:{attempt:1}});
     const prepared=await pending.order('checked_at',{ascending:true,nullsFirst:true}).limit(1);if(prepared.error)throw storage();
     for(const row of prepared.data??[])if(!policyOnly||row.plan.correction)await engine.create(row as PublicationRow);
    }
   }
   const r=await db.from('ga_ads_control').update({auto_publish_checked_at:new Date().toISOString(),auto_publish_error:null}).eq('account_id',account);if(r.error)throw storage();return {checked:true};
  }catch(error){await db.from('ga_ads_control').update({auto_publish_checked_at:new Date().toISOString(),auto_publish_error:isGoogleQuotaError(error)?'google_ads_quota_cooldown':'publication_tick_incomplete'}).eq('account_id',account);throw error;}
  finally{await store.unlock(account,token);}
 })();try{return await active;}finally{active=null;}
}
