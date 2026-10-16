import {digest,inventorySafeguard,type InventoryPart} from './inventory';
import {generateRepairDraft,type RepairDraft} from './policy';
import {gsmwebLocalPlan} from './business-profile';
import {advertisingPartType,COPY_RULES_VERSION} from './copy-rules';
export const STOCK_MONITOR_INTERVAL_MS=300000;
export type StockEvent={id:string;productId:string;name:string;kind:'unavailable'|'restocked'|'changed';message:string;before:number|null;after:number|null};
export type StockSnapshot={version:1;copyRulesVersion?:string;sourceProject:string;observedAt:string;complete:true;parts:InventoryPart[];drafts:RepairDraft[];draftsOmitted:number;events:StockEvent[];summary:{products:number;parts:number;stockQualified:number;outOfStock:number;lowStock:number};};
export function stockSnapshotFresh(snapshot:StockSnapshot|null,now=Date.now()){
 const stamp=Date.parse(snapshot?.observedAt??'');return !!snapshot&&snapshot.complete===true&&Number.isFinite(stamp)&&stamp<=now+60000&&now-stamp<STOCK_MONITOR_INTERVAL_MS;
}
export function buildStockSnapshot(source:{sourceProject:string;complete:boolean;parts:InventoryPart[]},previous:StockSnapshot|null,now=Date.now()):StockSnapshot{
 if(source.complete!==true||source.parts.some(p=>p.sourceProject!==source.sourceProject)||new Set(source.parts.map(p=>p.id)).size!==source.parts.length)throw new Error('Incomplete or inconsistent stock source.');
 if(previous&&previous.sourceProject!==source.sourceProject)throw new Error('Cannot compare different inventory projects.');
 if(source.parts.some(p=>!Number.isFinite(Date.parse(p.observedAt))||Date.parse(p.observedAt)>now+60000||now-Date.parse(p.observedAt)>=STOCK_MONITOR_INTERVAL_MS))throw new Error('Stock read is stale.');
 const current=new Map(source.parts.map(p=>[p.id,p])),events:StockEvent[]=[];
 for(const old of previous?.parts??[]){
  if(old.category!=='PART'||!advertisingPartType(old.partType))continue;
  const part=current.get(old.id)??null;if(old.fingerprint===part?.fingerprint)continue;
  const check=inventorySafeguard(old,part),kind:StockEvent['kind']=old.eligible&&!part?.eligible?'unavailable':!old.eligible&&part?.eligible?'restocked':'changed';
  events.push({id:digest({product:old.id,before:old.fingerprint,after:part?.fingerprint??null}),productId:old.id,name:part?.name??old.name,kind,before:old.available,after:part?.available??null,message:kind==='restocked'?'Stock qualification restored. Review a new draft; no ad was re-enabled.':`${check.reason} No mapped Google ad or account change is confirmed.`});
 }
 const considered=source.parts.filter(p=>p.category==='PART'&&advertisingPartType(p.partType));
 const qualified=considered.filter(p=>p.eligible).sort((a,b)=>(b.available??0)-(a.available??0)||a.id.localeCompare(b.id));
 // Stock depth is a preparation order only, not a claim about demand or profit.
 const drafts=qualified.slice(0,50).map(p=>generateRepairDraft(p,gsmwebLocalPlan.website,now));
 const observedAt=source.parts.reduce((stamp,part)=>Math.min(stamp,Date.parse(part.observedAt)),now);
 return {version:1,copyRulesVersion:COPY_RULES_VERSION,sourceProject:source.sourceProject,observedAt:new Date(observedAt).toISOString(),complete:true,parts:source.parts,drafts,draftsOmitted:Math.max(0,qualified.length-drafts.length),events,
  summary:{products:source.parts.length,parts:considered.length,stockQualified:qualified.length,outOfStock:considered.filter(p=>p.reasons.includes('out_of_stock')).length,lowStock:considered.filter(p=>p.reasons.includes('below_minimum_stock')).length}};
}
export type StockMonitorRun={status:'complete'|'failed';snapshot:StockSnapshot|null;created_at:string;error_code:string|null};
export function stockMonitorState(latest:StockMonitorRun|null,successful:StockMonitorRun|null,now=Date.now()){
 const snapshot=successful?.snapshot??null,failed=latest?.status==='failed';
 return {snapshot,stale:!stockSnapshotFresh(snapshot,now),reliable:!failed&&stockSnapshotFresh(snapshot,now),lastAttemptFailed:!!failed,executionEnabled:false as const,mode:'MONITOR_AND_DRAFT' as const};
}
export function stockAdvisorEvidence(state:ReturnType<typeof stockMonitorState>){
 return {available:!!state.snapshot,reliable:state.reliable,stale:state.stale,lastAttemptFailed:state.lastAttemptFailed,observedAt:state.snapshot?.observedAt??null,publicationBlocked:true,
  summary:state.snapshot?.summary??null,
  stockQualifiedSamples:state.reliable?(state.snapshot?.parts??[]).filter(part=>part.eligible&&part.category==='PART'&&advertisingPartType(part.partType)).slice(0,20).map(part=>({partType:part.partType,models:part.models.slice(0,5),condition:part.quality,available:part.available,minimumStock:part.minimumStock})):[],
  limitations:['Samples are bounded, not the entire stock.','Stock is not demand, repair capacity, a repair quote or profit.','This stock snapshot alone does not establish a live-ad mapping or confirm an account change. Check Account control.','Third-party consumer repair publication is policy-blocked.']};
}
export function stockWorkStatus(state:ReturnType<typeof stockMonitorState>){
 return {state:state.reliable?'active' as const:state.snapshot?'stale' as const:'unavailable' as const,
  observedAt:state.snapshot?.observedAt??null,qualifiedParts:state.snapshot?state.snapshot.parts.filter(part=>part.eligible&&part.category==='PART'&&advertisingPartType(part.partType)).length:null,draftCount:state.snapshot?(state.snapshot.copyRulesVersion===COPY_RULES_VERSION?state.snapshot.drafts.length:0):null,
  notice:state.lastAttemptFailed?'The latest stock read failed. Current availability is unconfirmed.':state.stale?'A successful current stock read is required.':null};
}
