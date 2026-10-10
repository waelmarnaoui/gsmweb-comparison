import {parseTimestamp} from './timestamps';
export type PaymentCandidate={matchId:string;callAt:string;clientId:string;paymentId:string;amount:number;paidDate:string;visitAt:string;gclid:string};
export function preparePaymentAttribution(candidates:PaymentCandidate[],projectRef:string,now=Date.now(),allowPhoneOnly=false){
 const groups=new Map<string,PaymentCandidate[]>();
 for(const c of candidates){
  const call=Date.parse(c.callAt),visit=Date.parse(c.visitAt.endsWith('Z')||/[+-]\d\d:\d\d$/.test(c.visitAt)?c.visitAt:c.visitAt+'Z');
  if((!c.gclid&&!allowPhoneOnly)||!Number.isFinite(call)||!Number.isFinite(visit)||visit<call||visit-call>14*86400000||c.amount<=0||!Number.isFinite(c.amount))continue;
  const key=projectRef+':'+c.paymentId;groups.set(key,[...(groups.get(key)||[]),c]);
 }
 const drafts=[];
 for(const [id,group] of groups){
  group.sort((a,b)=>Date.parse(b.callAt)-Date.parse(a.callAt));
  if(new Set(group.map(c=>c.clientId)).size!==1)continue;
  if(group.length>1&&Date.parse(group[0].callAt)===Date.parse(group[1].callAt)&&group[0].matchId!==group[1].matchId)continue;
  const c=group[0];let paidAt:string;try{paidAt=parseTimestamp(c.paidDate.slice(0,10)+' 23:59:59');}catch{continue;}
  const visit=Date.parse(c.visitAt.endsWith('Z')||/[+-]\d\d:\d\d$/.test(c.visitAt)?c.visitAt:c.visitAt+'Z');
  if(Date.parse(paidAt)>now||Date.parse(paidAt)<=Date.parse(c.callAt)||Date.parse(paidAt)<visit)continue;
  drafts.push({match_id:c.matchId,payment_transaction_id:id,amount:c.amount,currency:'RON',paid_at:paidAt,gclid:c.gclid,status:'prepared'});
 }
 return drafts;
}

