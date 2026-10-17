import 'server-only';
import {service} from '../server';
import {agentAccount} from '../agent-context';
import {connectionToken} from '../connections';
import {collectStockMonitor} from './monitor-server';
import {createSearchReader} from './search-reader';
import {prepareSearchOpportunities,campaignOpen,type SearchReport} from './search-growth';
import {COPY_RULES_VERSION} from './copy-rules';
import {digest} from './inventory';
import {IntegrationError} from '../integration-error';
import {resourceReadError} from '../ads-control/resource-loader';
const storage=()=>new IntegrationError('Search monitoring storage is unavailable. Install the reviewed SEARCH-GROWTH-PROPOSED.sql in the attribution database.',503);
export async function readGrowthMonitor(){
 const db=service(),account=agentAccount();
 const [latest,good,notifications]=await Promise.all([
  db.from('ga_ads_search_runs').select('id,status,report,error_code,created_at').eq('account_id',account).order('id',{ascending:false}).limit(1).maybeSingle(),
  db.from('ga_ads_search_runs').select('id,status,report,error_code,created_at').eq('account_id',account).eq('status','complete').order('id',{ascending:false}).limit(1).maybeSingle(),
  db.from('ga_ads_growth_notifications').select('notification_key,kind,details,created_at').eq('account_id',account).order('created_at',{ascending:false}).limit(30)
 ]);
 if(latest.error||good.error||notifications.error)throw storage();
 const report=good.data?.report??null,stamp=Date.parse(report?.search?.fetchedAt??'');
 const reliable=latest.data?.status==='complete'&&Number.isFinite(stamp)&&stamp<=Date.now()+60000&&Date.now()-stamp<900000;
 return {report,reliable,lastAttemptFailed:latest.data?.status==='failed',error:latest.data?.error_code??null,notifications:notifications.data??[],protectExistingAds:true,publicationSettingsRoute:'/api/ai-ads/publishing'};
}
let active:Promise<Awaited<ReturnType<typeof readGrowthMonitor>>>|null=null,retryAfter=0;
export async function collectGrowthMonitor(){
 if(active)return active;
 active=(async()=>{
  const previous=await readGrowthMonitor(),stamp=Date.parse(previous.report?.search?.fetchedAt??'');
  if(previous.reliable&&previous.report?.copyRulesVersion===COPY_RULES_VERSION&&Date.now()-stamp<300000||Date.now()<retryAfter)return previous;
  const account=agentAccount(),db=service(),slot=new Date(Math.floor(Date.now()/300000)*300000).toISOString();
  let search:SearchReport,opportunities:ReturnType<typeof prepareSearchOpportunities>;
  try{
   search=await createSearchReader({accountId:account,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,token:async()=>(await connectionToken('google_ads_management')).token}).collect();
   const stock=await collectStockMonitor();if(!stock.reliable||!stock.snapshot)throw new IntegrationError('Current stock could not be verified. Search-driven drafts were not generated.',503);
   opportunities=prepareSearchOpportunities(search,stock.snapshot.parts);
  }catch(error){
   retryAfter=Date.now()+60000;const saved=await db.from('ga_ads_search_runs').upsert({account_id:account,slot,status:'failed',report:null,error_code:resourceReadError(error)},{onConflict:'account_id,slot,status',ignoreDuplicates:true});if(saved.error)throw storage();return readGrowthMonitor();
  }
  const report={copyRulesVersion:COPY_RULES_VERSION,search,opportunities,activeCampaigns:search.campaigns.filter(c=>campaignOpen(c,search.timeZone)).map(c=>c.id),publicationBlockedReason:'Restricted-service risk requires Google review of the exact truthful offer. New groups remain paused until the exact ad is cleared. Existing ads, keywords, budgets and campaigns are protected.'};
  if(Buffer.byteLength(JSON.stringify(report))>4000000)throw new IntegrationError('Search monitoring report exceeds its safe storage limit.',503);
  for(const o of opportunities){
   const key=digest({account,id:o.id,headlines:o.draft.headlines,descriptions:o.draft.descriptions,pinnedHeadlines:o.draft.pinnedHeadlines,pinnedDescriptions:o.draft.pinnedDescriptions,keywords:o.draft.keywords});
   const notification=await db.from('ga_ads_growth_notifications').upsert({notification_key:key,account_id:account,opportunity_id:o.id,kind:'new_draft_prepared',details:{model:o.model,partType:o.partType,productId:o.productId,campaignId:o.campaignId,observedTerms:o.observedTerms.slice(0,3),message:`New ${o.model} ${o.partType} draft prepared from reported search terms and verified stock. Prepared with an installation disclosure. Check automatic publication history for the actual Google submission and review state.`}},{onConflict:'notification_key',ignoreDuplicates:true});if(notification.error)throw storage();
  }
  const saved=await db.from('ga_ads_search_runs').upsert({account_id:account,slot,status:'complete',report,error_code:null},{onConflict:'account_id,slot,status',ignoreDuplicates:true});if(saved.error)throw storage();
  retryAfter=0;return readGrowthMonitor();
 })();try{return await active;}finally{active=null;}
}
