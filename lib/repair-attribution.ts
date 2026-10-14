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
export function repairEligibility(candidate:Candidate,projectRef:string,now=Date.now()){
 const call=Date.parse(candidate.calledAt),visit=crmVisitTime(candidate.repair.entryDate);
 if(!projectRef)return 'CRM project is not selected';
 if(!safePhone(candidate.phone))return 'Invalid client phone number';
 if(!Number.isFinite(call))return 'Invalid first-contact timestamp';
 if(!Number.isFinite(visit))return 'Invalid CRM repair entry timestamp';
 if(visit>now)return 'CRM repair entry is in the future';
 if(call>visit)return 'Repair was created before the first recorded call or WhatsApp message';
 if(visit-call>14*86400000)return 'Repair was created more than 14 days after first contact';
 if(repairProfit(candidate.repair)===null)return 'Customer price or repair cost is missing or invalid';
 return '';
}
export function attributeRepairs(candidates:Candidate[],projectRef:string,now=Date.now()){
 const groups=new Map<string,Candidate[]>();
 for(const candidate of candidates){
  if(repairEligibility(candidate,projectRef,now))continue;
  const key=projectRef+':repair:'+candidate.repair.id;
  groups.set(key,[...(groups.get(key)||[]),candidate]);
 }
 return [...groups].flatMap(([id,group])=>{
  group.sort((a,b)=>Date.parse(b.calledAt)-Date.parse(a.calledAt));
  if(new Set(group.map(c=>c.clientId)).size!==1||group.some(c=>c.callId!==group[0].callId&&Date.parse(c.calledAt)===Date.parse(group[0].calledAt)))return [];
  return [{...group[0],id,profit:repairProfit(group[0].repair)!}];
 });
}
