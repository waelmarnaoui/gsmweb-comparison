import {approvalValid,recoveryDue,validAction,type Action,type ActionState,type ControlSettings} from './rules';
import {ControlProviderError,type ControlGoogle} from './google';
export interface ControlStore{
 lock(account:string):Promise<string|null>;
 unlock(account:string,token:string):Promise<void>;
 fence(account:string,token:string):Promise<void>;
 settings(account:string):Promise<ControlSettings>;
 action(id:string):Promise<Action>;
 transition(action:Action,state:ActionState,patch?:Partial<Action>):Promise<Action>;
}
type Options={store:ControlStore;google:ControlGoogle;preflight:(a:Action)=>Promise<void>;recoveryHealthy:()=>Promise<boolean>;now?:()=>number};
// Mutations are absolute setters. There is no retry of a timed-out mutate request.
// A durable 'executing' record and recovery deadline precede any live request.
export function createControlEngine(o:Options){
 const now=o.now??Date.now;
 async function underLock(id:string,fn:(a:Action,token:string)=>Promise<Action>){
  const initial=await o.store.action(id),token=await o.store.lock(initial.account_id);
  if(!token)throw new Error('Another account action is running.');
  try{return await fn(await o.store.action(id),token);}finally{await o.store.unlock(initial.account_id,token);}
 }
 return {
  execute:(id:string)=>underLock(id,async(a,token)=>{
   validAction(a);
   if(!approvalValid(a,now())){
    if(a.state==='approved')return o.store.transition(a,'expired',{error_code:'approval_expired'});
    throw new Error('A current exact-action approval is required.');
   }
   let started=false,mutationAcknowledged=false;
   try{
    const settings=await o.store.settings(a.account_id);
    if(settings.protect_existing_ads!==false)throw new Error('existing_ads_protected');
    if(settings.global_paused)throw new Error('automation_paused');
    if(a.source==='stock'&&(!settings.stock_enabled||!settings.approved_by))throw new Error('stock_control_disabled');
    if(a.kind==='campaign_pause'&&!await o.recoveryHealthy())throw new Error('independent_recovery_unavailable');
    await o.preflight(a);
    const actual=await o.google.read(a.kind,a.resource_name);
    if(actual.value!==a.before_value)return o.store.transition(a,'conflict',{error_code:'google_state_changed'});
    if(a.kind==='budget_decrease'&&actual.budgetShared)throw new Error('shared_budget_not_supported');
    if(a.kind==='ad_status'&&a.after_value==='ENABLED'&&(actual.approvalStatus!=='APPROVED'||actual.reviewStatus!=='REVIEWED'||actual.topics!==0))throw new Error('google_policy_not_clear');
    if(a.kind==='ad_status'&&a.after_value==='ENABLED'&&(!a.google_fingerprint||actual.evidenceHash!==a.google_fingerprint))throw new Error('google_ad_changed');
    await o.google.mutate(a.kind,a.resource_name,a.after_value,true);
    // Recheck after validation: a slow provider or a new stock sale invalidates intent.
    await o.preflight(a);
    if(!approvalValid(a,now()))throw new Error('approval_expired');
    const latest=await o.store.settings(a.account_id);
    if(latest.protect_existing_ads!==false)throw new Error('existing_ads_protected');
    if(latest.global_paused||a.source==='stock'&&!latest.stock_enabled)throw new Error('automation_paused');
    const again=await o.google.read(a.kind,a.resource_name);
    if(again.value!==a.before_value)return o.store.transition(a,'conflict',{error_code:'google_state_changed'});
    if(a.kind==='campaign_pause'&&!await o.recoveryHealthy())throw new Error('independent_recovery_unavailable');
    if(a.kind==='budget_decrease'&&again.budgetShared)throw new Error('shared_budget_not_supported');
    if(a.kind==='ad_status'&&a.after_value==='ENABLED'&&(again.approvalStatus!=='APPROVED'||again.reviewStatus!=='REVIEWED'||again.topics!==0||again.evidenceHash!==a.google_fingerprint))throw new Error('google_ad_changed');
    const start=now();
    await o.store.fence(a.account_id,token);
    a=await o.store.transition(a,'executing',{started_at:new Date(start).toISOString(),recovery_due_at:a.kind==='campaign_pause'?new Date(start+8*60000).toISOString():null});started=true;
    const result=await o.google.mutate(a.kind,a.resource_name,a.after_value);
    mutationAcknowledged=true;
    const verified=await o.google.read(a.kind,a.resource_name);
    if(verified.value!==a.after_value)return o.store.transition(a,'uncertain',{request_id:result.requestId,error_code:'verification_mismatch'});
    return o.store.transition(a,'confirmed',{request_id:result.requestId,error_code:null});
   }catch(error){
    const uncertain=started&&(mutationAcknowledged||!(error instanceof ControlProviderError)||error.uncertain);
    // Provider text and response bodies never enter logs or browser responses.
    const allowed=['existing_ads_protected','automation_paused','stock_control_disabled','independent_recovery_unavailable','shared_budget_not_supported','google_policy_not_clear','google_ad_changed','approval_expired','inventory_changed','inventory_unavailable','mapping_missing','daily_allowance_unavailable','daily_allowance_reached','monitor_worker_unavailable'];
    const code=error instanceof ControlProviderError?error.code:error instanceof Error&&allowed.includes(error.message)?error.message:'preflight_or_storage_failed';
    return o.store.transition(a,uncertain?'uncertain':'failed',{error_code:code});
   }
  }),
  recover:(id:string)=>underLock(id,async(a,token)=>{
   validAction(a);if(!recoveryDue(a,now()))return a;
   // Recovery is independent of the automation pause switch and monitor availability.
   // It can only restore the recorded ENABLED state of this temporary campaign lease.
   try{
    const current=await o.google.read(a.kind,a.resource_name);
    if(current.value===a.before_value)return o.store.transition(a,'recovered',{error_code:null});
    if(current.value!==a.after_value)return o.store.transition(a,'conflict',{error_code:'recovery_state_changed'});
    await o.google.mutate(a.kind,a.resource_name,a.before_value,true);
    await o.store.fence(a.account_id,token);
    await o.google.mutate(a.kind,a.resource_name,a.before_value);
    if((await o.google.read(a.kind,a.resource_name)).value!==a.before_value)throw new Error('recovery_verification_failed');
    return o.store.transition(a,'recovered',{error_code:null});
   }catch{return o.store.transition(a,'uncertain',{error_code:'recovery_failed'});}
  }),
  reconcile:(id:string)=>underLock(id,async a=>{
   if(!['executing','uncertain'].includes(a.state)||a.kind==='campaign_pause')return a;
   try{
    const current=await o.google.read(a.kind,a.resource_name);
    if(current.value===a.after_value)return o.store.transition(a,'confirmed',{error_code:null});
    if(current.value===a.before_value&&now()-Date.parse(a.started_at??'')>120000)return o.store.transition(a,'failed',{error_code:'change_not_observed'});
    if(current.value!==a.before_value)return o.store.transition(a,'conflict',{error_code:'google_state_changed'});
   }catch{/* Retain uncertain intent; no mutate retry. */}
   return a;
  })
 };
}
