import {ControlProviderError,isGoogleQuotaError} from '../ads-control/google';
import {googleCleared,type PublicationFeedback,type PublicationPlan} from './publishing';
import type {createPublishingGoogle} from './publishing-google';
import {policyOnlyFeedback} from './intervention-policy';
export type PublicationRow={id:string;account_id:string;plan:PublicationPlan;state:string;version:number;pending_operation:'create'|'group_enable'|'group_pause'|null;group_resource:string|null;ad_resource:string|null;google_feedback:PublicationFeedback|null;error_code:string|null;request_id:string|null;checked_at:string|null};
export type PublicationStore={save:(row:PublicationRow,patch:Partial<PublicationRow>)=>Promise<PublicationRow>;fence:()=>Promise<void>};
type Options={store:PublicationStore;google:ReturnType<typeof createPublishingGoogle>;authorized:()=>Promise<boolean>;guard:(plan:PublicationPlan,activation:boolean)=>Promise<string|null>;policyOnly?:()=>Promise<boolean>;now?:()=>number};
export function createPublicationEngine(o:Options){
 const now=o.now??Date.now,stamp=()=>new Date(now()).toISOString();
 const save=(r:PublicationRow,p:Partial<PublicationRow>)=>o.store.save(r,{...p,checked_at:stamp()});
 const inspect=async(p:PublicationPlan)=>{const f=await o.google.inspect(p);return f?{...f,observedAt:stamp()}:null;};
 const policyOnly=()=>o.policyOnly?.()??Promise.resolve(false);
 const bound=(r:PublicationRow,f:PublicationFeedback)=>{if(r.group_resource&&r.group_resource!==f.groupResource||r.ad_resource&&r.ad_resource!==f.adResource)throw new Error('publication_identity_changed');};
 const failure=(e:unknown)=>e instanceof ControlProviderError?e.code+(e.diagnostics.length?':'+e.diagnostics.join(','):''):'publication_operation_unconfirmed';
 return {
  async create(row:PublicationRow){
   let r=row,started=false;if(r.state!=='prepared')return r;
   try{
    if(await policyOnly()&&!r.plan.correction)return save(r,{error_code:'policy_only_new_publication_blocked'});
    if(!await o.authorized())return save(r,{error_code:'publishing_disabled'});
    const before=await o.guard(r.plan,false);if(before)return save(r,{error_code:before});
    if(await o.google.inspect(r.plan))return save(r,{state:'failed',error_code:'publication_group_already_exists'});
    await o.google.create(r.plan,true);
    if(!await o.authorized())return save(r,{error_code:'publishing_disabled'});
    const again=await o.guard(r.plan,false);if(again)return save(r,{error_code:again});
    if(await policyOnly()&&!r.plan.correction)return save(r,{error_code:'policy_only_new_publication_blocked'});
    await o.store.fence();r=await save(r,{state:'creating',pending_operation:'create',error_code:null});started=true;
    const request=await o.google.create(r.plan,false),f=await inspect(r.plan);if(!f||f.groupStatus!=='PAUSED'||f.adStatus!=='ENABLED')throw new Error('publication_unconfirmed');
    return await save(r,{state:'submitted',pending_operation:null,group_resource:f.groupResource,ad_resource:f.adResource,google_feedback:f,request_id:request,error_code:'google_review_pending'});
   }catch(e){const result=await save(r,{state:started&&(!(e instanceof ControlProviderError)||e.uncertain)?'uncertain':'failed',error_code:failure(e)});if(isGoogleQuotaError(e))throw e;return result;}
  },
  async monitor(row:PublicationRow){
   let r=row,started=false;
   try{
    const f=await inspect(r.plan);if(!f)return save(r,{error_code:r.state==='creating'||r.state==='uncertain'?'publication_unconfirmed':'publication_missing',state:r.state==='creating'?'uncertain':r.state});bound(r,f);
    if(['creating','uncertain'].includes(r.state)){
     const expected=r.pending_operation==='group_enable'?'ENABLED':'PAUSED';
     if(f.groupStatus!==expected)return save(r,{state:'uncertain',google_feedback:f,error_code:'publication_unconfirmed'});
     r=await save(r,{state:f.groupStatus==='ENABLED'?'active':'submitted',pending_operation:null,group_resource:f.groupResource,ad_resource:f.adResource,google_feedback:f,error_code:null});
    }
    if(r.state==='active'&&f.groupStatus==='PAUSED')return save(r,{state:'paused',google_feedback:f,error_code:'owner_paused_group'});
    if(r.state==='paused'&&r.error_code==='owner_paused_group')return save(r,{google_feedback:f});
    // Policy-only mode observes existing groups, including eligible paused ads,
    // but never changes their status, bids, budget, schedule, keywords or copy.
    if(await policyOnly())return save(r,{...policyOnlyFeedback(f),google_feedback:f});
    const problem=await o.guard(r.plan,true),clear=googleCleared(f),reason=problem??(!clear?(f.approval==='DISAPPROVED'?'google_disapproved':f.approval==='APPROVED_LIMITED'?'google_policy_limited':'google_review_pending'):null);
    const target=reason?'PAUSED':'ENABLED';
    if(f.groupStatus===target)return save(r,{state:target==='ENABLED'?'active':r.state==='submitted'?'submitted':'paused',google_feedback:f,error_code:reason});
    if(!await o.authorized())return save(r,{google_feedback:f,error_code:'publishing_disabled'});
    // Re-read the exact agent-owned group, ad copy, keywords and policy after validation.
    await o.google.groupStatus(f.groupResource,target,true);
    if(!await o.authorized())return save(r,{google_feedback:f,error_code:'publishing_disabled'});
    const current=await inspect(r.plan);if(!current)throw new Error('publication_unconfirmed');bound(r,current);
    if(await policyOnly())return save(r,{...policyOnlyFeedback(current),google_feedback:current});
    if(target==='ENABLED'){
     const again=await o.guard(r.plan,true);if(again||!googleCleared(current))return save(r,{google_feedback:current,error_code:again??'google_review_pending'});
    }
    await o.store.fence();r=await save(r,{pending_operation:target==='ENABLED'?'group_enable':'group_pause',error_code:reason,google_feedback:current});started=true;
    const request=await o.google.groupStatus(f.groupResource,target,false),after=await inspect(r.plan);if(!after||after.groupStatus!==target)throw new Error('publication_unconfirmed');bound(r,after);
    return await save(r,{state:target==='ENABLED'?'active':'paused',pending_operation:null,google_feedback:after,request_id:request,error_code:reason});
   }catch(e){const result=await save(r,{state:started?'uncertain':r.state,error_code:failure(e)});if(isGoogleQuotaError(e))throw e;return result;}
  }
 };
}
