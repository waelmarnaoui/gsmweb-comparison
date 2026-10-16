import type {AdsObservation} from './ads-monitor';
export const DAILY_RECEIPTS_TARGET_BANI=400000;
export const MAX_AGENT_PAUSE_MS=600000;
export function previousBusinessDate(date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid business date.');
 return new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
}
// Confirmed prior-day receipts set today's allowance. Never borrow against future sales.
export function earnedAdAllowance(previousDayPaymentsBani:number|null){
 if(previousDayPaymentsBani===null)return {allowanceBani:null,ready:false,reason:'Yesterday’s customer payments have not been confirmed.'};
 if(!Number.isSafeInteger(previousDayPaymentsBani)||previousDayPaymentsBani<0)throw new Error('Invalid previous-day payments.');
 return {allowanceBani:Math.min(40000,Math.floor(previousDayPaymentsBani/10)),ready:true,reason:'10% of confirmed previous-day customer payments, capped at 400 lei.'};
}
export function businessDay(now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(name:string)=>parts.find(p=>p.type===name)!.value;
 return {date:`${part('year')}-${part('month')}-${part('day')}`,checkinDue:Number(part('hour'))>=19};
}
export function receiptsSummary(amountBani:number){
 if(!Number.isSafeInteger(amountBani)||amountBani<0)throw new Error('Invalid customer payments.');
 return {amountBani,targetBani:DAILY_RECEIPTS_TARGET_BANI,
 rating:amountBani<50000?'very_bad':amountBani<100000?'bad':amountBani<200000?'good':'very_good',
 targetReached:amountBani>=DAILY_RECEIPTS_TARGET_BANI,gapBani:Math.max(0,DAILY_RECEIPTS_TARGET_BANI-amountBani)};
}
export type AgentAlert={key:string;level:'warning'|'critical';message:string};
export function monitoringAlerts(current:AdsObservation|null,previous:AdsObservation|null,dailySpendRon:number|null,now=Date.now()):AgentAlert[]{
 if(!current||!Number.isFinite(Date.parse(current.fetchedAt))||now-Date.parse(current.fetchedAt)>15*60000||Date.parse(current.fetchedAt)>now+60000)
  return [{key:'stale',level:'warning',message:'Campaign monitoring is unavailable or stale. I cannot confirm the current account state.'}];
 const alerts:AgentAlert[]=[];
 if(current.currency!=='RON')alerts.push({key:'currency',level:'warning',message:'A valid daily Google exchange rate is unavailable for this account currency. Lei comparisons and spend-limit warnings are unavailable until it loads.'});
 if(current.currency==='RON'&&current.today&&dailySpendRon!==null&&Number.isFinite(dailySpendRon)&&dailySpendRon>=0){
  const spend=Number(current.today.costMicros)/1e6;
  if((dailySpendRon===0&&spend>0)||(dailySpendRon>0&&spend>=dailySpendRon))alerts.push({key:`spend:${current.today.date}`,level:'critical',message:`Reported ad spend today is ${spend.toFixed(2)} lei, reaching your ${dailySpendRon.toFixed(2)} lei daily limit. Reporting can be delayed. Review spending now.`});
  if(previous?.accountId===current.accountId&&previous.currency===current.currency&&previous.today?.date===current.today.date){
   const minutes=(Date.parse(current.fetchedAt)-Date.parse(previous.fetchedAt))/60000;
   const difference=spend-Number(previous.today.costMicros)/1e6;
   if(dailySpendRon>0&&minutes>=3&&minutes<=30&&difference>0&&difference/minutes*60>=dailySpendRon*0.5)
    alerts.push({key:`pace:${current.today.date}`,level:'critical',message:'Newly reported spending is arriving quickly: at this rate, half of your daily ad limit could be used within an hour. This may include delayed reporting; check the account before acting.'});
  }
 }
 return alerts;
}
export function controlReadiness(dailySpendRon:number|null){
 const blockers=['Open Account control to review stock-control permissions, approved actions and deployed recovery-worker health. Unrestricted account optimization is not enabled.','Paid-customer CPA requires verified attribution; visibility safeguards need a data-backed proposal and your approval.','New consumer repair ads require policy clearance; approval cannot override a policy restriction.'];
 if(dailySpendRon===null||!Number.isFinite(dailySpendRon)||dailySpendRon<=0)blockers.unshift('Confirm positive customer payments for yesterday before granting account control.');
 return {mode:'ADVISE' as const,canEnable:false as const,maxPauseSeconds:600,blockers};
}
export function pauseDeadline(pausedAt:number,now:number){
 if(!Number.isFinite(pausedAt)||!Number.isFinite(now)||pausedAt>now)throw new Error('Invalid pause timing.');
 const deadline=pausedAt+MAX_AGENT_PAUSE_MS;
 return {deadline,remainingMs:Math.max(0,deadline-now),recoveryDue:now>=deadline};
}
