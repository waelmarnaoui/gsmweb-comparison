import {moneyCents} from './payment-profit';
import {parseTimestamp} from './timestamps';
import {safePhone,type CrmRepair} from './crm-comparison';

export function repairProfit(repair:CrmRepair){
 const price=moneyCents(repair.customerPrice),cost=moneyCents(repair.repairCost);
 return price===null||cost===null?null:(price-cost)/100;
}
export function crmVisitTime(value:string){
 // Prisma stores UTC in timestamp-without-time-zone columns; preserve that contract.
 const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)?value+'Z':value;
 try{return Date.parse(parseTimestamp(timestamp));}catch{return NaN;}
}
type Candidate={callId:string;phone:string;calledAt:string;clientId:string;repair:CrmRepair};
export function attributeRepairs(candidates:Candidate[],projectRef:string,now=Date.now()){
 const groups=new Map<string,Candidate[]>();
 for(const candidate of candidates){
  const call=Date.parse(candidate.calledAt),visit=crmVisitTime(candidate.repair.entryDate);
  if(!projectRef||!safePhone(candidate.phone)||!Number.isFinite(call)||!Number.isFinite(visit)||call>visit||visit-call>14*86400000||visit>now||repairProfit(candidate.repair)===null)continue;
  const key=projectRef+':repair:'+candidate.repair.id;
  groups.set(key,[...(groups.get(key)||[]),candidate]);
 }
 return [...groups].flatMap(([id,group])=>{
  group.sort((a,b)=>Date.parse(b.calledAt)-Date.parse(a.calledAt));
  if(new Set(group.map(c=>c.clientId)).size!==1||group.some(c=>c.callId!==group[0].callId&&Date.parse(c.calledAt)===Date.parse(group[0].calledAt)))return [];
  return [{...group[0],id,profit:repairProfit(group[0].repair)!}];
 });
}
