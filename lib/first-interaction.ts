import {normalizeRomanianPhone} from './attribution';
import {CALLS_VISIBLE_FROM_UTC} from './call-visibility';

export type InteractionCall={id:string;phone:string;started_at:string;direction:string};
export function firstInteractions<T extends InteractionCall>(calls:T[],until=Date.now()){
 const groups=new Map<string,T[]>();
 for(const call of calls){
  const time=Date.parse(call.started_at);
  if(!Number.isFinite(time)||time<Date.parse(CALLS_VISIBLE_FROM_UTC)||time>until)continue;
  let phone:string;try{phone=normalizeRomanianPhone(call.phone);}catch{continue;}
  groups.set(phone,[...(groups.get(phone)||[]),call]);
 }
 return [...groups.entries()].map(([phone,history])=>{
  history.sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)||(a.id<b.id?-1:a.id>b.id?1:0));
  const primary=history.find(c=>c.direction==='incoming'||c.direction==='missed')||history[0];
  return {phone,primary,followUps:history.filter(c=>c.id!==primary.id),eligible:primary.direction==='incoming'||primary.direction==='missed'};
 });
}
