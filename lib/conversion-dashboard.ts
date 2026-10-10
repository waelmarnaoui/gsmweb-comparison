import 'server-only';
import {requireAdmin,service} from './server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getConnection} from './connections';
import {preparePaymentAttribution,type PaymentCandidate} from './payment-attribution';
import {IntegrationError} from './integration-error';
import {CALLS_VISIBLE_FROM_UTC} from './call-visibility';
import {parseTimestamp} from './timestamps';
import {readCrmComparison} from './crm-reader';
import {conversionBlocker,type Draft} from './conversion-readiness';
export function conversionDateRange(url:URL){
 const from=url.searchParams.get('from')||'2026-10-09',to=url.searchParams.get('to')||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw new IntegrationError('Select valid start and end dates.');
 let start:string,end:string;try{start=parseTimestamp(from+' 00:00:00');end=parseTimestamp(to+' 23:59:59.999');}catch{throw new IntegrationError('Select valid calendar dates.');}
 if(start>end)throw new IntegrationError('End date must be on or after start date.');
 return {from,to,start,end};
}
export async function conversionDashboard(url:URL,options:{prepare?:boolean;client?:SupabaseClient}={}){
 const client=options.client||(await requireAdmin()).client,range=conversionDateRange(url),name=process.env.GOOGLE_ADS_CONVERSION_NAME||'GSMWeb CRM - All records from GSMWeb CRM';
 async function rows(table:string,columns:string){const all:Record<string,unknown>[]=[];for(let offset=0;offset<10000;offset+=500){const {data,error}=await client.from(table).select(columns).order('id').range(offset,offset+499);if(error)throw new IntegrationError('Conversion records could not be read.',503);all.push(...(data||[]) as unknown as Record<string,unknown>[]);if((data||[]).length<500)return all;}throw new IntegrationError('Too many conversion records. No partial export was generated.',503);}
 const [matches,calls,clicks,drafts]=await Promise.all([rows('ga_matches','id,call_id,click_id'),rows('ga_calls','id,phone,started_at'),rows('ga_clicks','id,gclid,clicked_at,campaign'),rows('ga_conversion_drafts','id,match_id,payment_transaction_id,amount,currency,paid_at,gclid,status')]);
 const matchedCalls=calls.filter(c=>Date.parse(String(c.started_at))>=Date.parse(CALLS_VISIBLE_FROM_UTC)&&matches.some(m=>m.call_id===c.id)) as unknown as {id:string;phone:string;started_at:string}[];
 const comparison=matchedCalls.length?await readCrmComparison(matchedCalls):[];
 const crm=await getConnection('supabase_crm'),projectRef=crm?.metadata.project_ref||'';
 const candidates:PaymentCandidate[]=[];
  for(const match of matches){const c=comparison.find(c=>c.callId===match.call_id),click=clicks.find(k=>k.id===match.click_id);if(!c?.customer||!click?.gclid)continue;for(const payment of c.payments)candidates.push({matchId:String(match.id),callAt:c.calledAt,clientId:c.customer.id,paymentId:payment.id,amount:payment.amount,paidDate:payment.paidDate,visitAt:payment.visitAt,gclid:String(click.gclid)});}
 const expected=projectRef?preparePaymentAttribution(candidates,projectRef):[];
 if(options.prepare&&projectRef){
  const planned=expected.filter(p=>!drafts.some(d=>d.payment_transaction_id===p.payment_transaction_id));
  for(let i=0;i<planned.length;i+=200){const {data,error}=await service().from('ga_conversion_drafts').upsert(planned.slice(i,i+200),{onConflict:'payment_transaction_id',ignoreDuplicates:true}).select('*');if(error)throw new IntegrationError('Could not prepare conversion records.',503);drafts.push(...(data||[]));}
 }
 const items=[];const seen=new Set<string>();
 for(const match of matches){const c=comparison.find(c=>c.callId===match.call_id),click=clicks.find(k=>k.id===match.click_id);if(!c||!click||!c.customer)continue;
  const prepared=drafts.filter(d=>d.match_id===match.id&&d.status==='prepared') as unknown as Draft[];
  if(!prepared.length){if(Date.parse(c.calledAt)>=Date.parse(range.start)&&Date.parse(c.calledAt)<=Date.parse(range.end))items.push({id:String(match.id),customer:c.customer.name,phone:c.phone,callTime:c.calledAt,repair:c.repairs.map(r=>r.repairCode).join(', '),campaign:String(click.campaign||''),gclid:String(click.gclid||''),paymentId:'',conversionTime:'',amount:0,historyTotal:c.recordedTotal,ready:false,reason:c.payments.length?'Payment attribution and conversion time not prepared':'No active recorded CRM payment'});continue;}
  for(const draft of prepared){if(Date.parse(draft.paid_at)<Date.parse(range.start)||Date.parse(draft.paid_at)>Date.parse(range.end))continue;
   const payment=draft.payment_transaction_id.startsWith(projectRef+':')?c.payments.find(p=>projectRef+':'+p.id===draft.payment_transaction_id):undefined;
   let reason=conversionBlocker(draft,{gclid:String(click.gclid||''),clicked_at:String(click.clicked_at)},payment,name);
   const assignment=expected.find(p=>p.payment_transaction_id===draft.payment_transaction_id);
   if(!assignment||assignment.match_id!==draft.match_id||!Number.isFinite(Date.parse(draft.paid_at))||assignment.paid_at!==new Date(draft.paid_at).toISOString())reason='Payment does not satisfy the approved 14-day attribution rule';
   if(seen.has(draft.payment_transaction_id))reason='Duplicate payment attribution';seen.add(draft.payment_transaction_id);
   items.push({id:draft.id,customer:c.customer.name,phone:c.phone,callTime:c.calledAt,repair:c.repairs.map(r=>r.repairCode).join(', '),campaign:String(click.campaign||''),gclid:draft.gclid,paymentId:draft.payment_transaction_id,conversionTime:draft.paid_at,amount:Number(draft.amount),historyTotal:c.recordedTotal,ready:!reason,reason});
  }
 }
 return {items,range,conversionName:name};
}

