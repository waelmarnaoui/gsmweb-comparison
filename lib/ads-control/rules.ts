import {createHash} from 'node:crypto';
export const CONTROL_VERSION='stock-control-v1';
export type Kind='ad_status'|'campaign_pause'|'budget_decrease';
export type ActionState='proposed'|'approved'|'executing'|'confirmed'|'uncertain'|'failed'|'conflict'|'expired'|'recovered'|'cancelled';
export type Action={id:string;account_id:string;kind:Kind;resource_name:string;before_value:string;after_value:string;source:'owner'|'stock';product_id:string|null;inventory_fingerprint:string|null;google_fingerprint:string|null;reason:string;state:ActionState;created_by:string|null;approved_by:string|null;created_at:string;expires_at:string;started_at:string|null;recovery_due_at:string|null;request_id:string|null;error_code:string|null;idempotency_key:string};
export type Mapping={account_id:string;resource_name:string;campaign_id:string;product_id:string;fingerprint:string;active:boolean;evidence:{partPriceBani:number|null;quality:string|null;models:string[];partType:string|null}};
export type ControlSettings={account_id:string;stock_enabled:boolean;global_paused:boolean;version:string;approved_by:string|null;approved_at:string|null;recovery_deployment_id?:string|null;protect_existing_ads?:boolean};
export type Heartbeat={role:'monitor'|'recovery';deployment_id:string;version:string;checked_at:string;ok:boolean};
export function validAccount(account:string){if(!/^\d{10}$/.test(account))throw new Error('Invalid account.');return account;}
export function resourceFor(kind:Kind,account:string,resource:string){
 validAccount(account);const segment=kind==='ad_status'?'adGroupAds/\\d{1,20}~\\d{1,20}':kind==='campaign_pause'?'campaigns/\\d{1,20}':'campaignBudgets/\\d{1,20}';
 if(!new RegExp(`^customers/${account}/${segment}$`).test(resource))throw new Error('Resource is outside this account or action type.');return resource;
}
export function validAction(a:Pick<Action,'kind'|'account_id'|'resource_name'|'before_value'|'after_value'|'source'>){
 if(!['ad_status','campaign_pause','budget_decrease'].includes(a.kind)||!['stock','owner'].includes(a.source))throw new Error('Unsupported control action.');
 resourceFor(a.kind,a.account_id,a.resource_name);
 if(a.kind==='budget_decrease'){
  if(!/^[1-9]\d{0,14}$/.test(a.before_value)||!/^[1-9]\d{0,14}$/.test(a.after_value)||BigInt(a.after_value)>=BigInt(a.before_value))throw new Error('Only a positive budget reduction is supported.');
 }else if(!['ENABLED','PAUSED'].includes(a.before_value)||!['ENABLED','PAUSED'].includes(a.after_value)||a.before_value===a.after_value)throw new Error('Invalid status transition.');
 if(a.kind==='campaign_pause'&&(a.before_value!=='ENABLED'||a.after_value!=='PAUSED'))throw new Error('Campaign control only supports a temporary pause.');
 if(a.source==='stock'&&(a.kind!=='ad_status'||a.after_value!=='PAUSED'))throw new Error('Automatic stock control can only pause an ad.');
}
export function actionKey(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function recent(stamp:string|null|undefined,maxAge=180000,now=Date.now()){const n=Date.parse(stamp??'');return Number.isFinite(n)&&n<=now+10000&&now-n<maxAge;}
export function recoveryReady(beats:Heartbeat[],expected:string|undefined,now=Date.now()){
 return !!expected&&beats.some(b=>b.role==='recovery'&&b.deployment_id===expected&&b.version===CONTROL_VERSION&&b.ok&&recent(b.checked_at,90000,now));
}
export function stockControlReady(settings:ControlSettings,beats:Heartbeat[],expectedMonitor:string|undefined,stockReliable:boolean,now=Date.now()){
 const blockers:string[]=[];
 if(settings.version!==CONTROL_VERSION)blockers.push('Control settings need review for this release.');
 if(!stockReliable)blockers.push('A complete current inventory read is required.');
 if(!expectedMonitor||!beats.some(b=>b.role==='monitor'&&b.deployment_id===expectedMonitor&&b.version===CONTROL_VERSION&&b.ok&&recent(b.checked_at,180000,now)))blockers.push('The authenticated stock worker has not passed a recent deployment check.');
 return blockers;
}
export function approvalValid(a:Action,now=Date.now()){
 return a.state==='approved'&&recent(a.created_at,3600000,now)&&Date.parse(a.expires_at)>now&&(a.source==='stock'||!!a.approved_by);
}
export function recoveryDue(a:Action,now=Date.now()){
 return a.kind==='campaign_pause'&&['executing','uncertain','confirmed'].includes(a.state)&&!!a.recovery_due_at&&Date.parse(a.recovery_due_at)<=now;
}
export function stockNeedsPause(mapping:Mapping,part:{eligible:boolean;partPriceBani:number|null;quality:string|null;models:string[];partType:string|null}|null|undefined){
 if(!part?.eligible)return true;
 const old=mapping.evidence;
 if(!old||old.quality!==part.quality||old.partType!==part.partType||JSON.stringify(old.models)!==JSON.stringify(part.models))return true;
 if(old.partPriceBani===null||part.partPriceBani===null)return old.partPriceBani!==part.partPriceBani;
 return old.partPriceBani!==part.partPriceBani&&(old.partPriceBani<=0||Math.abs(part.partPriceBani-old.partPriceBani)/old.partPriceBani>=0.1);
}
