import 'server-only';
import {randomUUID} from 'node:crypto';
import {service} from '../server';
import {connectionToken} from '../connections';
import {agentAccount,readAgentContext} from '../agent-context';
import {collectStockMonitor,readStockMonitor} from '../ai-ads/monitor-server';
import {advertisingPartType} from '../ai-ads/copy-rules';
import {createAdPolicyReader} from '../ads-policy-reader';
import {createControlGoogle} from './google';
import {createControlEngine} from './engine';
import {controlStore,controlHeartbeats,controlStorageMessage} from './store';
import {CONTROL_VERSION,actionKey,validAction,recent,recoveryReady,stockControlReady,stockNeedsPause,type Action,type Kind,type Mapping} from './rules';
import {IntegrationError} from '../integration-error';
import {readRepairInventory} from '../ai-ads/source';
import type {AgentAlert} from '../agent-policy';
const safeError=(message:string)=>new IntegrationError(message,503);
export function controlGoogle(){return createControlGoogle({accountId:agentAccount(),developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN??'',loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,token:async()=>(await connectionToken('google_ads_management')).token});}
export async function setupControl(){
 const db=service(),account=agentAccount();
 const result=await db.from('ga_ads_control').upsert({account_id:account},{onConflict:'account_id',ignoreDuplicates:true});
 if(result.error)throw safeError(controlStorageMessage);
 return {db,account,store:controlStore(db)};
}
export async function readControl(){
 const {db,account,store}=await setupControl();
 const [settings,heartbeats,stock,actions,mappings,events]=await Promise.all([
  store.settings(account),controlHeartbeats(db,account),readStockMonitor(),
  db.from('ga_ads_actions').select('*').eq('account_id',account).order('created_at',{ascending:false}).limit(50),
  db.from('ga_ads_product_ads').select('*').eq('account_id',account).eq('active',true).limit(1001),
  db.from('ga_ads_action_events').select('id,action_id,event,created_at').eq('account_id',account).order('id',{ascending:false}).limit(50)
 ]);
 if(actions.error||mappings.error||events.error)throw safeError(controlStorageMessage);
 if((mappings.data?.length??0)>1000)throw safeError('Product mapping limit reached. Review the control scope.');
 const blockers=stockControlReady(settings,heartbeats,process.env.ADS_CONTROL_MONITOR_DEPLOYMENT_ID??'dashboard',stock.reliable);
 if(!mappings.data?.length)blockers.push('Link a live ad to its verified inventory product.');
 const {lock_token:unusedToken,lock_until:unusedUntil,...publicSettings}=settings as typeof settings&{lock_token?:string;lock_until?:string};void unusedToken;void unusedUntil;
 return {settings:publicSettings,heartbeats,blockers,checkMode:process.env.ADS_CONTROL_MONITOR_DEPLOYMENT_ID?'scheduled':'dashboard',recoveryReady:recoveryReady(heartbeats,settings.recovery_deployment_id??process.env.ADS_CONTROL_RECOVERY_DEPLOYMENT_ID),
  mode:settings.stock_enabled&&!settings.global_paused&&blockers.length===0?'STOCK_CONTROL':'ADVISE',actions:actions.data as Action[],mappings:mappings.data,events:events.data,
  products:stock.reliable?(stock.snapshot?.parts??[]).filter(p=>p.category==='PART'&&advertisingPartType(p.partType)).map(p=>({id:p.id,name:p.name,available:p.available,eligible:p.eligible,fingerprint:p.fingerprint})):[],
  limitations:['Automatic control only pauses individually mapped ads for unavailable or materially changed stock. It never re-enables ads automatically.','Temporary campaign pauses recover after eight minutes, leaving a two-minute margin. Provider or infrastructure outages can still delay recovery.','New ad publication remains policy-blocked. Bid optimization, new campaigns, budget increases and targeting changes are outside this release.','Google reporting can lag. Daily allowances are monitoring safeguards, not a guaranteed billing cap.']};
}
export async function controlResources(){
 const accountId=agentAccount();
 const report=await createAdPolicyReader({accountId,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,token:async()=>(await connectionToken('google_ads_management')).token}).collect();
 return {ads:report.ads,campaigns:await controlGoogle().campaigns(),fetchedAt:report.fetchedAt};
}
export async function setControl(actor:string,input:{enabled?:boolean;paused?:boolean}){
 const {db,account}=await setupControl();
 if(input.enabled===true){const current=await readControl();if(current.blockers.length)throw new IntegrationError(current.blockers.join(' '),409);}
 const patch={...(input.enabled!==undefined?{stock_enabled:input.enabled,approved_by:actor,approved_at:new Date().toISOString(),version:CONTROL_VERSION}:{}),...(input.paused!==undefined?{global_paused:input.paused}:{})};
 if(!Object.keys(patch).length)throw new Error('Choose a control setting.');
 const r=await db.from('ga_ads_control').update(patch).eq('account_id',account);if(r.error)throw safeError(controlStorageMessage);
}
export async function linkProduct(actor:string,resource:string,productId:string){
 const {db,account,store}=await setupControl(),token=await store.lock(account);if(!token)throw new IntegrationError('Another account action is running.',409);
 try{
  const stock=await collectStockMonitor(actor),part=stock.snapshot?.parts.find(p=>p.id===productId);
  if(!stock.reliable||!part||part.category!=='PART'||!advertisingPartType(part.partType))throw new Error('Select a verified display, battery or charging-port product.');
  const live=await controlGoogle().read('ad_status',resource);
  if(!/^\d{1,20}$/.test(live.campaignId))throw new Error('Campaign identity is unavailable.');
  const r=await db.from('ga_ads_product_ads').upsert({account_id:account,resource_name:resource,campaign_id:live.campaignId,product_id:part.id,fingerprint:part.fingerprint,evidence:{partPriceBani:part.partPriceBani,quality:part.quality,models:part.models,partType:part.partType},created_by:actor,active:true});
  if(r.error)throw safeError(controlStorageMessage);
 }finally{await store.unlock(account,token);}
}
export async function unlinkProduct(resource:string){
 const {db,account,store}=await setupControl(),token=await store.lock(account);if(!token)throw new IntegrationError('Another account action is running.',409);
 try{const r=await db.from('ga_ads_product_ads').update({active:false}).eq('account_id',account).eq('resource_name',resource);if(r.error)throw safeError(controlStorageMessage);}
 finally{await store.unlock(account,token);}
}
export async function proposeAction(actor:string,input:{kind:Kind;resource:string;value:string;requestId:string}){
 if(!/^[a-f0-9-]{36}$/i.test(input.requestId))throw new Error('Invalid request identity.');
 const {db,account}=await setupControl(),actual=await controlGoogle().read(input.kind,input.resource);
 const stock=await collectStockMonitor(actor);
 const mapping=await db.from('ga_ads_product_ads').select('*').eq('account_id',account).eq('resource_name',input.resource).eq('active',true).maybeSingle();if(mapping.error)throw safeError(controlStorageMessage);
 const part=mapping.data&&stock.reliable?stock.snapshot?.parts.find(p=>p.id===mapping.data.product_id):null;
 const action={account_id:account,kind:input.kind,resource_name:input.resource,before_value:actual.value,after_value:input.value,source:'owner' as const,created_by:actor,product_id:part?.id??null,inventory_fingerprint:part?.fingerprint??null,google_fingerprint:actual.evidenceHash??null,reason:input.kind==='campaign_pause'?'Owner-reviewed temporary campaign pause; recovery starts at eight minutes.':input.kind==='budget_decrease'?'Owner-reviewed reduction of an unshared campaign average daily budget.':'Owner-reviewed mapped-ad status change.',idempotency_key:actionKey({account,request:input.requestId})};
 validAction(action);
 if(input.kind==='ad_status'&&input.value==='ENABLED'&&(!mapping.data||!part?.eligible))throw new IntegrationError('Re-enabling requires a current eligible inventory product and an approved live ad.',409);
 if(input.kind==='budget_decrease'&&actual.budgetShared)throw new IntegrationError('Shared budgets are outside this control scope.',409);
 const r=await db.from('ga_ads_actions').upsert(action,{onConflict:'account_id,idempotency_key',ignoreDuplicates:true}).select('id');if(r.error)throw safeError(controlStorageMessage);
 return r.data?.[0]?.id??null;
}
export async function approveAction(actor:string,id:string){
 const {db,account}=await setupControl();
 const r=await db.from('ga_ads_actions').update({state:'approved',approved_by:actor,updated_at:new Date().toISOString()}).eq('id',id).eq('account_id',account).eq('state','proposed').gt('expires_at',new Date().toISOString()).select('id');
 if(r.error)throw safeError(controlStorageMessage);if(!r.data?.length)throw new IntegrationError('Proposal expired or was already reviewed.',409);
}
export async function cancelAction(actor:string,id:string){
 const {db,account}=await setupControl();
 const r=await db.from('ga_ads_actions').update({state:'cancelled',cancelled_by:actor,error_code:'owner_cancelled',updated_at:new Date().toISOString()}).eq('id',id).eq('account_id',account).in('state',['proposed','approved']).select('id');
 if(r.error)throw safeError(controlStorageMessage);if(!r.data?.length)throw new IntegrationError('Only a pending proposal can be cancelled. An in-flight action must be verified or rolled back.',409);
}
async function preflight(a:Action){
 if(a.account_id!==agentAccount())throw new Error('Account changed.');
 if(a.kind!=='ad_status')return;
 if(a.source==='owner'&&a.after_value==='PAUSED')return;
 const db=service(),mapping=await db.from('ga_ads_product_ads').select('*').eq('account_id',a.account_id).eq('resource_name',a.resource_name).eq('active',true).maybeSingle();
 if(mapping.error||!mapping.data||mapping.data.product_id!==a.product_id)throw new Error('mapping_missing');
 // Restoring traffic always reads the inventory source again; it never relies on
 // a previously successful five-minute dashboard snapshot.
 const stock=a.after_value==='ENABLED'?null:await collectStockMonitor();
 const live=a.after_value==='ENABLED'?await readRepairInventory():null;
 const part=live?.parts.find(p=>p.id===a.product_id)??stock?.snapshot?.parts.find(p=>p.id===a.product_id);
 if(live?live.complete!==true:!stock?.reliable)throw new Error('inventory_unavailable');
 if(a.after_value==='ENABLED'){
  if(!part?.eligible||part.fingerprint!==a.inventory_fingerprint)throw new Error('inventory_changed');
  const context=await readAgentContext();
  if(!context.allowance.ready||!context.allowance.allowanceBani)throw new Error('daily_allowance_unavailable');
  if(!context.ronObservation?.today||context.ronObservation.today.date!==context.businessDate||!recent(context.ronObservation.fetchedAt,900000))throw new Error('daily_allowance_unavailable');
  if(Number(context.ronObservation.today.costMicros)/10000>=context.allowance.allowanceBani)throw new Error('daily_allowance_reached');
 }else{
  if(part?.fingerprint!==a.inventory_fingerprint&&!(part===undefined&&a.inventory_fingerprint===actionKey({missing:a.product_id})))throw new Error('inventory_changed');
  if(!stockNeedsPause(mapping.data as Mapping,part))throw new Error('inventory_changed');
  const beats=await controlHeartbeats(db,a.account_id),settings=await controlStore(db).settings(a.account_id);
  if(stockControlReady(settings,beats,process.env.ADS_CONTROL_MONITOR_DEPLOYMENT_ID??'dashboard',true).length)throw new Error('monitor_worker_unavailable');
 }
}
export function serverControlEngine(){const db=service(),store=controlStore(db);return createControlEngine({store,google:controlGoogle(),preflight,recoveryHealthy:async()=>{const settings=await store.settings(agentAccount());return recoveryReady(await controlHeartbeats(db,agentAccount()),settings.recovery_deployment_id??process.env.ADS_CONTROL_RECOVERY_DEPLOYMENT_ID);}});}
export async function executeAction(id:string){
 const store=controlStore(service()),a=await store.action(id);if(a.account_id!==agentAccount())throw new Error('Account mismatch.');
 return serverControlEngine().execute(id);
}
export async function reconcileAction(id:string){
 const a=await controlStore(service()).action(id);if(a.account_id!==agentAccount())throw new Error('Account mismatch.');
 return serverControlEngine().reconcile(id);
}
export async function proposeRollback(actor:string,id:string,requestId:string){
 const a=await controlStore(service()).action(id);if(a.account_id!==agentAccount()||a.state!=='confirmed')throw new Error('Choose a confirmed action.');
 if(a.kind!=='ad_status')throw new IntegrationError('Campaign pauses use automatic recovery. Reversing a budget reduction would increase spending and requires a separately implemented spending approval.',409);
 return proposeAction(actor,{kind:a.kind,resource:a.resource_name,value:a.before_value,requestId});
}
export async function runStockControlTick(interactive=false){
 const {db,account,store}=await setupControl(),deployment=interactive?'dashboard':process.env.ADS_CONTROL_MONITOR_DEPLOYMENT_ID;
 if(!deployment||deployment.length>100)throw safeError('Configure the stock worker deployment identity.');
 const stock=await collectStockMonitor();
 const r=await db.from('ga_ads_control_workers').upsert({account_id:account,role:'monitor',deployment_id:deployment,version:CONTROL_VERSION,checked_at:new Date().toISOString(),ok:stock.reliable});if(r.error)throw safeError(controlStorageMessage);
 const settings=await store.settings(account);if(settings.global_paused||!settings.stock_enabled||!stock.reliable)return {checked:true,changed:0,reliable:stock.reliable};
 const expired=await db.from('ga_ads_actions').update({state:'expired',error_code:'approval_expired',updated_at:new Date().toISOString()}).eq('account_id',account).in('state',['proposed','approved']).lte('expires_at',new Date().toISOString());if(expired.error)throw safeError(controlStorageMessage);
 const unresolved=await db.from('ga_ads_actions').select('id').eq('account_id',account).neq('kind','campaign_pause').in('state',['executing','uncertain']).order('created_at').limit(3);if(unresolved.error)throw safeError(controlStorageMessage);
 for(const a of unresolved.data??[])await serverControlEngine().reconcile(a.id);
 const mappings=await db.from('ga_ads_product_ads').select('*').eq('account_id',account).eq('active',true).limit(1001);if(mappings.error||(mappings.data?.length??0)>1000)throw safeError('Stock mapping read failed or exceeded its limit.');
 let changed=0;const google=controlGoogle(),engine=serverControlEngine();
 // Bound each invocation; unprocessed mappings remain eligible on the next tick.
 const live=await controlResources(),enabled=new Set(live.ads.filter(a=>a.status==='ENABLED').map(a=>a.resourceName));
 const candidates=(mappings.data as Mapping[]).filter(m=>enabled.has(m.resource_name)&&stockNeedsPause(m,stock.snapshot?.parts.find(p=>p.id===m.product_id)));
 for(const m of candidates.slice(0,5)){
  const part=stock.snapshot!.parts.find(p=>p.id===m.product_id),fingerprint=part?.fingerprint??actionKey({missing:m.product_id});
  const actual=await google.read('ad_status',m.resource_name);if(actual.value!=='ENABLED')continue;
  const key=actionKey({account,resource:m.resource_name,fingerprint,source:'stock',version:CONTROL_VERSION,slot:Math.floor(Date.now()/300000)});
  const created=await db.from('ga_ads_actions').upsert({id:randomUUID(),account_id:account,kind:'ad_status',resource_name:m.resource_name,before_value:'ENABLED',after_value:'PAUSED',source:'stock',product_id:m.product_id,inventory_fingerprint:fingerprint,reason:part?.eligible?'Mapped inventory changed since approval. Pause for a new product review.':'Mapped inventory is unavailable or below its stock threshold.',state:'approved',idempotency_key:key},{onConflict:'account_id,idempotency_key',ignoreDuplicates:true}).select('id');
  if(created.error)throw safeError(controlStorageMessage);
  // An expired/failed action is not silently approved again. Owner review is required.
  if(created.data?.[0]){const result=await engine.execute(created.data[0].id);if(result.state==='confirmed')changed++;}
 }
 // Survive a crash after inserting approval but before claiming it.
 const pending=await db.from('ga_ads_actions').select('id').eq('account_id',account).eq('source','stock').eq('state','approved').gt('expires_at',new Date().toISOString()).order('created_at').limit(5);
 if(pending.error)throw safeError(controlStorageMessage);
 for(const a of pending.data??[]){const result=await engine.execute(a.id);if(result.state==='confirmed')changed++;}
 return {checked:true,changed,reliable:true};
}
export async function markControlWorkerFailed(interactive=false){
 const deployment=interactive?'dashboard':process.env.ADS_CONTROL_MONITOR_DEPLOYMENT_ID;if(!deployment)return;
 const r=await service().from('ga_ads_control_workers').upsert({account_id:agentAccount(),role:'monitor',deployment_id:deployment,version:CONTROL_VERSION,checked_at:new Date().toISOString(),ok:false});
 if(r.error)throw safeError(controlStorageMessage);
}
export async function readControlAlerts():Promise<AgentAlert[]>{
 try{
  const db=service(),account=agentAccount(),settings=await controlStore(db).settings(account),beats=await controlHeartbeats(db,account);
  const alerts:AgentAlert[]=[];
  if(settings.stock_enabled&&!settings.global_paused&&stockControlReady(settings,beats,process.env.ADS_CONTROL_MONITOR_DEPLOYMENT_ID??'dashboard',true).length)alerts.push({key:'stock-control-worker-stale',level:'critical',message:'Automatic stock control has lost its worker health check. Current inventory-to-ad synchronization is unconfirmed. Open Account control and restart checks.'});
  const actions=await db.from('ga_ads_actions').select('id,kind,state,recovery_due_at,error_code').eq('account_id',account).in('state',['executing','uncertain','failed','confirmed']).order('created_at',{ascending:false}).limit(100);
  if(actions.error)throw new Error('Storage unavailable.');
  for(const a of actions.data??[]){
   if(a.kind==='campaign_pause'&&a.recovery_due_at&&Date.parse(a.recovery_due_at)<Date.now()&&['confirmed','executing','uncertain'].includes(a.state))alerts.push({key:'campaign-recovery:'+a.id,level:'critical',message:'A temporary campaign pause is due for recovery and restoration is not confirmed. Check Account control and the live Google Ads campaign immediately.'});
   else if(a.state==='uncertain')alerts.push({key:'ads-action-uncertain:'+a.id,level:'warning',message:'Google Ads could not confirm an account change. The agent has not retried the change. Review Account control.'});
  }
  return alerts;
 }catch{return [{key:'control-health-unavailable',level:'warning',message:'Account-control health could not be checked. Review worker status and the live account before relying on automation.'}];}
}
