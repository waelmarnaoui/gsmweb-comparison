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
import {safePhone} from './crm-comparison';
import {firstInteractions,type InteractionCall} from './first-interaction';
import {matchingHealth,matchReviews,MATCHING_PENDING} from './matching-state';
import {clickSheetSource} from './sheets';
import {readClickSyncState} from './sync-click-sheet';
import {clickSyncReason} from './click-sync-state';
import {extractBraidIdentifiers} from './ad-click-identifiers';
export function conversionDateRange(url:URL){
 const from=url.searchParams.get('from')||'2026-09-24',to=url.searchParams.get('to')||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw new IntegrationError('Select valid start and end dates.');
 let start:string,end:string;try{start=parseTimestamp(from+' 00:00:00');end=parseTimestamp(to+' 23:59:59.999');}catch{throw new IntegrationError('Select valid calendar dates.');}
 if(start>end)throw new IntegrationError('End date must be on or after start date.');
 return {from,to,start,end};
}
export async function conversionDashboard(url:URL,options:{prepare?:boolean;client?:SupabaseClient}={}){
 const client=options.client||(await requireAdmin()).client,range=conversionDateRange(url),name=process.env.GOOGLE_ADS_CONVERSION_NAME||'GSMWeb CRM - All records from GSMWeb CRM';
 async function rows(table:string,columns:string){const all:Record<string,unknown>[]=[];for(let offset=0;offset<10000;offset+=500){const {data,error}=await client.from(table).select(columns).order('id').range(offset,offset+499);if(error)throw new IntegrationError('Conversion records could not be read.',503);all.push(...(data||[]) as unknown as Record<string,unknown>[]);if((data||[]).length<500)return all;}throw new IntegrationError('Too many conversion records. No partial export was generated.',503);}
 const [matches,calls,clicks,drafts]=await Promise.all([rows('ga_matches','id,call_id,click_id'),rows('ga_calls','id,phone,started_at,direction'),rows('ga_clicks','id,gclid,clicked_at,campaign,page_url'),rows('ga_conversion_drafts','id,match_id,payment_transaction_id,amount,currency,paid_at,gclid,status')]);
 const health=await matchingHealth(client),reviews=health.configured?await matchReviews(client):[];
 const source=health.configured?await clickSheetSource():null;
 const sourceReason=source?clickSyncReason(await readClickSyncState(client,source.id),source.id):MATCHING_PENDING;
 const approved=new Set(reviews.filter(r=>!r.reason&&!sourceReason).map(r=>r.match_id));
 const matchedCalls=firstInteractions(calls as unknown as InteractionCall[]).filter(g=>g.eligible).map(g=>g.primary);
 const comparison=matchedCalls.length?await readCrmComparison(matchedCalls):[];
 const crm=await getConnection('supabase_crm'),projectRef=crm?.metadata.project_ref||'';
 const candidates:PaymentCandidate[]=[];
  for(const match of matches){const c=comparison.find(c=>c.callId===match.call_id),click=clicks.find(k=>k.id===match.click_id);if(!approved.has(String(match.id))||!c?.customer||!click?.gclid)continue;for(const payment of c.payments)candidates.push({matchId:String(match.id),callAt:c.calledAt,clientId:c.customer.id,paymentId:payment.id,amount:payment.amount,paidDate:payment.paidDate,visitAt:payment.visitAt,gclid:String(click.gclid)});}
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
   if(!approved.has(String(match.id)))reason=health.configured?(reviews.find(r=>r.match_id===match.id)?.reason||'Saved match could not be verified'):MATCHING_PENDING;
   if(seen.has(draft.payment_transaction_id))reason='Duplicate payment attribution';seen.add(draft.payment_transaction_id);
   items.push({id:draft.id,customer:c.customer.name,phone:c.phone,callTime:c.calledAt,repair:c.repairs.map(r=>r.repairCode).join(', '),campaign:String(click.campaign||''),gclid:draft.gclid,paymentId:draft.payment_transaction_id,conversionTime:draft.paid_at,amount:Number(draft.amount),historyTotal:c.recordedTotal,ready:!reason,reason});
  }
 }
 // Reserve every existing draft and eligible click-linked payment before phone-only attribution.
 const reserved=new Set([...drafts.map(d=>String(d.payment_transaction_id)),...expected.map(d=>d.payment_transaction_id)]);
 const phoneCandidates:PaymentCandidate[]=[];
 for(const c of comparison){if(!c.customer||!safePhone(c.phone)||matches.some(m=>m.call_id===c.callId))continue;
  for(const p of c.payments)phoneCandidates.push({matchId:c.callId,callAt:c.calledAt,clientId:c.customer.id,paymentId:p.id,amount:p.amount,paidDate:p.paidDate,visitAt:p.visitAt,gclid:''});
 }
 const phoneConversions=projectRef?preparePaymentAttribution(phoneCandidates,projectRef,Date.now(),true).filter(p=>!reserved.has(p.payment_transaction_id)&&Date.parse(p.paid_at)>=Date.parse(range.start)&&Date.parse(p.paid_at)<=Date.parse(range.end)&&Date.now()-Date.parse(p.paid_at)<63*86400000):[];
 for(const p of phoneConversions){const c=comparison.find(c=>c.callId===p.match_id)!;
  items.push({id:'phone:'+p.payment_transaction_id,customer:c.customer!.name,phone:safePhone(c.phone)!,callTime:c.calledAt,repair:c.repairs.map(r=>r.repairCode).join(', '),campaign:'Phone-based; Google attribution pending',gclid:'',paymentId:p.payment_transaction_id,conversionTime:p.paid_at,amount:p.amount,historyTotal:c.recordedTotal,ready:true,reason:''});
 }
 if(sourceReason)for(const item of items){item.ready=false;item.reason=sourceReason;}
 const enriched=items.map(item=>{
  const draft=drafts.find(d=>d.id===item.id),match=matches.find(m=>m.id===(draft?.match_id||item.id));
  const click=match?clicks.find(k=>k.id===match.click_id):undefined;
  return {...item,...extractBraidIdentifiers(click?.page_url,item.gclid)};
 });
 return {items:enriched,range,conversionName:name};
}

