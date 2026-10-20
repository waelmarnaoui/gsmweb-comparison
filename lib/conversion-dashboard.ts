import 'server-only';
import {requireAdmin,service} from './server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getConnection} from './connections';
import {preparePaymentAttribution,type PaymentCandidate} from './payment-attribution';
import {IntegrationError} from './integration-error';
import {parseTimestamp} from './timestamps';
import {readCrmComparison} from './crm-reader';
import {conversionBlocker,preparedTimestampChange,type Draft} from './conversion-readiness';
import {safePhone} from './crm-comparison';
import {firstInteractions,type InteractionCall} from './first-interaction';
import {matchingHealth,matchReviews,MATCHING_PENDING} from './matching-state';
import {clickSheetSource} from './sheets';
import {readClickSyncState} from './sync-click-sheet';
import {clickSyncReason} from './click-sync-state';
import {extractBraidIdentifiers} from './ad-click-identifiers';
import {conversionObservations} from './conversion-observations';
import {readClientConsents} from './consent-store';
import {consentAllowsUserData} from './client-consent';
import {uploadHistory} from './ads-ledger';
import {attributeRepairs,crmVisitTime} from './repair-attribution';
import {websiteClickDetails} from './website-click-details';
type ConversionItem={id:string;customer:string;phone:string;callTime:string;repair:string;campaign:string;gclid:string;paymentId:string;conversionTime:string;amount:number;paymentAmount:number;chargedAmount:number|null;allocatedCost:number|null;historyTotal:number;ready:boolean;reason:string;timeBasis:'website_click'|'first_paid_match'|'first_crm_match';recordBasis?:'repair_record';activityTime?:string};
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
 const [matches,calls,clicks,drafts]=await Promise.all([rows('ga_matches','id,call_id,click_id'),rows('ga_calls','id,phone,started_at,direction,external_id'),rows('ga_clicks','id,gclid,clicked_at,campaign,page_url,session_id,source_key'),rows('ga_conversion_drafts','id,match_id,payment_transaction_id,amount,currency,paid_at,gclid,status')]);
 const health=await matchingHealth(client),reviews=health.configured?await matchReviews(client):[];
 const source=health.configured?await clickSheetSource():null;
 const sourceReason=source?clickSyncReason(await readClickSyncState(client,source.id),source.id):MATCHING_PENDING;
 const approved=new Set(reviews.filter(r=>!r.reason&&!sourceReason).map(r=>r.match_id));
 const matchedCalls=firstInteractions(calls as unknown as InteractionCall[]).filter(g=>g.eligible).map(g=>g.primary);
 const comparison=matchedCalls.length?await readCrmComparison(matchedCalls):[];
 const crm=await getConnection('supabase_crm'),projectRef=crm?.metadata.project_ref||'';
 const candidates:PaymentCandidate[]=[];
  for(const match of matches){const c=comparison.find(c=>c.callId===match.call_id),click=clicks.find(k=>k.id===match.click_id);if(!approved.has(String(match.id))||!c?.customer||!click?.gclid)continue;for(const payment of c.payments.filter(p=>p.kind==='sale'))candidates.push({matchId:String(match.id),callAt:c.calledAt,clientId:c.customer.id,paymentId:payment.id,amount:payment.amount,paidDate:payment.paidDate,visitAt:payment.visitAt,gclid:String(click.gclid),conversionTime:String(click.clicked_at)});}
 const expected=projectRef?preparePaymentAttribution(candidates,projectRef):[];
 if(options.prepare&&projectRef){
  const planned=expected.filter(p=>!drafts.some(d=>d.payment_transaction_id===p.payment_transaction_id));
  for(let i=0;i<planned.length;i+=200){const {data,error}=await service().from('ga_conversion_drafts').upsert(planned.slice(i,i+200),{onConflict:'payment_transaction_id',ignoreDuplicates:true}).select('*');if(error)throw new IntegrationError('Could not prepare conversion records.',503);drafts.push(...(data||[]));}
  for(const draft of drafts){
   const assignment=expected.find(p=>p.payment_transaction_id===draft.payment_transaction_id&&p.match_id===draft.match_id&&p.gclid===draft.gclid&&p.amount===Number(draft.amount));
   if(!assignment||!preparedTimestampChange(draft as unknown as Draft,assignment))continue;
   const {data,error}=await service().from('ga_conversion_drafts').update({paid_at:assignment.paid_at}).eq('id',String(draft.id)).eq('status','prepared').eq('amount',assignment.amount).eq('gclid',assignment.gclid).eq('match_id',assignment.match_id).select('paid_at');
   if(error)throw new IntegrationError('Could not update the prepared conversion timestamp.',503);
   if(data?.length)draft.paid_at=data[0].paid_at;
  }
 }
 const items:ConversionItem[]=[];const seen=new Set<string>();
 for(const match of matches){const c=comparison.find(c=>c.callId===match.call_id),click=clicks.find(k=>k.id===match.click_id);if(!c||!click||!c.customer)continue;
  const prepared=drafts.filter(d=>d.match_id===match.id&&d.status==='prepared') as unknown as Draft[];
  if(!prepared.length)continue;
  for(const draft of prepared){if(Date.parse(draft.paid_at)<Date.parse(range.start)||Date.parse(draft.paid_at)>Date.parse(range.end))continue;
   const payment=draft.payment_transaction_id.startsWith(projectRef+':')?c.payments.find(p=>projectRef+':'+p.id===draft.payment_transaction_id):undefined;
   if(payment?.kind==='repair')continue;
   let reason=conversionBlocker(draft,{gclid:String(click.gclid||''),clicked_at:String(click.clicked_at)},payment,name);
   const assignment=expected.find(p=>p.payment_transaction_id===draft.payment_transaction_id);
   if(!assignment||assignment.match_id!==draft.match_id||!Number.isFinite(Date.parse(draft.paid_at))||assignment.paid_at!==new Date(draft.paid_at).toISOString())reason='Payment does not satisfy the approved 14-day attribution rule';
   if(!approved.has(String(match.id)))reason=health.configured?(reviews.find(r=>r.match_id===match.id)?.reason||'Saved match could not be verified'):MATCHING_PENDING;
   if(!reason&&(payment?.profit===null||payment?.profit===undefined))reason='Recorded repair or product cost is missing';
   if(!reason&&payment!.profit!<=0)reason='No positive recorded profit';
   if(seen.has(draft.payment_transaction_id))reason='Duplicate payment attribution';seen.add(draft.payment_transaction_id);
   items.push({id:draft.id,customer:c.customer.name,phone:c.phone,callTime:c.calledAt,repair:c.repairs.map(r=>r.repairCode).join(', '),campaign:String(click.campaign||''),gclid:draft.gclid,paymentId:draft.payment_transaction_id,conversionTime:draft.paid_at,amount:payment?.profit??0,paymentAmount:payment?.amount??Number(draft.amount),chargedAmount:payment?.chargedAmount??null,allocatedCost:payment?.allocatedCost??null,timeBasis:'website_click',historyTotal:c.recordedTotal,ready:!reason,reason});
  }
 }
 // Reserve every existing draft and eligible click-linked payment before phone-only attribution.
 const reserved=new Set([...drafts.map(d=>String(d.payment_transaction_id)),...expected.map(d=>d.payment_transaction_id)]);
 const phoneCandidates:PaymentCandidate[]=[];
 for(const c of comparison){if(!c.customer||!safePhone(c.phone)||matches.some(m=>m.call_id===c.callId))continue;
  for(const p of c.payments.filter(p=>p.kind==='sale'))phoneCandidates.push({matchId:c.callId,callAt:c.calledAt,clientId:c.customer.id,paymentId:p.id,amount:p.amount,paidDate:p.paidDate,visitAt:p.visitAt,gclid:'',conversionTime:new Date().toISOString()});
 }
 const eligiblePhone=projectRef?preparePaymentAttribution(phoneCandidates,projectRef,Date.now(),true).filter(p=>!reserved.has(p.payment_transaction_id)):[];
 const seeds=eligiblePhone.map(p=>({payment_transaction_id:p.payment_transaction_id,call_id:p.match_id,crm_paid_date:phoneCandidates.find(c=>projectRef+':'+c.paymentId===p.payment_transaction_id)!.paidDate.slice(0,10)}));
 const observations=await conversionObservations(client,seeds,Boolean(options.prepare&&!sourceReason));
 for(const p of eligiblePhone){const c=comparison.find(c=>c.callId===p.match_id)!,payment=c.payments.find(payment=>projectRef+':'+payment.id===p.payment_transaction_id)!;
  const observation=observations.rows.find(o=>o.payment_transaction_id===p.payment_transaction_id),time=observation?.first_matched_at||'';
  let reason=!observations.configured?'First-match timestamp storage needs the approved database setup':!observation?'First paid-customer match time not saved':observation.call_id!==c.callId?'Payment was first matched to a different call':observation.crm_paid_date!==payment.paidDate.slice(0,10)?'CRM payment date changed':'';
  const candidate=phoneCandidates.find(candidate=>candidate.matchId===p.match_id&&projectRef+':'+candidate.paymentId===p.payment_transaction_id)!;
  if(!reason&&!preparePaymentAttribution([{...candidate,conversionTime:time}],projectRef,Date.now(),true).length)reason='Saved first-match time does not satisfy attribution rules';
  if(!reason&&(payment.profit===null||payment.profit<=0))reason=payment.profit===null?'Recorded repair or product cost is missing':'No positive recorded profit';
  const paidDay=Date.parse(parseTimestamp(payment.paidDate.slice(0,10)+' 00:00:00'));
  if(!reason&&Date.now()-paidDay>=63*86400000)reason='CRM payment is outside the phone import age limit';
  if(time?(Date.parse(time)<Date.parse(range.start)||Date.parse(time)>Date.parse(range.end)):(Date.parse(c.calledAt)<Date.parse(range.start)||Date.parse(c.calledAt)>Date.parse(range.end)))continue;
  items.push({id:'phone:'+p.payment_transaction_id,customer:c.customer!.name,phone:safePhone(c.phone)!,callTime:c.calledAt,repair:c.repairs.map(r=>r.repairCode).join(', '),campaign:'Phone-based; Google attribution pending',gclid:'',paymentId:p.payment_transaction_id,conversionTime:time,amount:payment.profit??0,paymentAmount:payment.amount,chargedAmount:payment.chargedAmount,allocatedCost:payment.allocatedCost,timeBasis:'first_paid_match',historyTotal:c.recordedTotal,ready:!reason,reason});
 }
 const repairs=attributeRepairs(comparison.flatMap(c=>c.customer?c.repairs.map(repair=>({callId:c.callId,phone:c.phone,calledAt:c.calledAt,clientId:c.customer!.id,repair})):[]),projectRef);
 const repairObservations=await conversionObservations(client,repairs.filter(r=>!matches.some(m=>m.call_id===r.callId)).map(r=>({payment_transaction_id:r.id,call_id:r.callId,crm_paid_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(crmVisitTime(r.repair.entryDate)))})),Boolean(options.prepare&&!sourceReason));
 for(const record of repairs){
  const c=comparison.find(c=>c.callId===record.callId)!,savedMatches=matches.filter(m=>m.call_id===record.callId);
  const match=savedMatches.length===1?savedMatches[0]:undefined,click=match?clicks.find(k=>k.id===match.click_id):undefined;
  const observation=repairObservations.rows.find(o=>o.payment_transaction_id===record.id);
  const time=click?String(click.clicked_at):observation?.first_matched_at||'';
  let reason=savedMatches.length>1?'Multiple saved website matches':match&&!approved.has(String(match.id))?'Website match needs verification':match&&!click?'Website click is unavailable':!match&&!observation?'First CRM match time not saved':!match&&observation?.call_id!==record.callId?'Repair was first matched to a different call':'';
  if(!reason&&!click&&Date.parse(time)<crmVisitTime(record.repair.entryDate))reason='CRM repair entry is later than its saved first-match time';
  if(!reason&&(!Number.isFinite(Date.parse(time))||Date.parse(time)>Date.now()||(click&&Date.parse(time)>Date.parse(c.calledAt))))reason='Invalid conversion timestamp';
  const activity=crmVisitTime(record.repair.entryDate),filterTime=url.searchParams.get('activityDay')?activity:Date.parse(time||c.calledAt);
  if(filterTime<Date.parse(range.start)||filterTime>Date.parse(range.end))continue;
  items.push({id:'repair:'+record.id,customer:c.customer!.name,phone:c.phone,callTime:c.calledAt,repair:record.repair.repairCode,campaign:String(click?.campaign||'Phone-based; Google attribution pending'),gclid:String(click?.gclid||''),paymentId:record.id,conversionTime:time,amount:record.profit,paymentAmount:c.payments.filter(p=>p.repairId===record.repair.id).reduce((sum,p)=>sum+p.amount,0),chargedAmount:Number(record.repair.customerPrice),allocatedCost:Number(record.repair.repairCost),historyTotal:c.recordedTotal,ready:!reason,reason,timeBasis:click?'website_click':'first_crm_match',recordBasis:'repair_record',activityTime:record.repair.entryDate});
 }
 if(sourceReason)for(const item of items){item.ready=false;item.reason=sourceReason;}
 const consentState=await readClientConsents(client,projectRef,comparison.flatMap(c=>c.customer?[c.customer.id]:[]));
 const uploads=await uploadHistory(client),uploadedPayments=new Map(uploads.records.map(record=>[record.payment_id,record]));
 const enriched=items.map(item=>{
  const draft=drafts.find(d=>d.id===item.id),itemCalls=comparison.filter(c=>safePhone(c.phone)===safePhone(item.phone)&&c.calledAt===item.callTime&&c.customer),itemCall=itemCalls.length===1?itemCalls[0]:undefined;
  const savedMatches=matches.filter(m=>m.call_id===itemCall?.callId);
  const match=item.recordBasis?(savedMatches.length===1?savedMatches[0]:undefined):matches.find(m=>m.id===draft?.match_id&&m.call_id===itemCall?.callId);
  const click=match?clicks.find(k=>k.id===match.click_id):undefined;
  const customer=itemCall?.customer;
  const consent=customer?consentState.latest.get(customer.id):undefined;
  const userDataAllowed=consentAllowsUserData(consent,item.phone);
  const consentReason=!consentState.configured?'Consent storage needs database setup':!userDataAllowed?'Advertising measurement consent is not granted':'';
  const legacyPaymentIds=item.recordBasis?(itemCall?.repairPaymentIds[item.paymentId.slice((projectRef+':repair:').length)]||[]).map(id=>projectRef+':'+id):[];
  const uploaded=uploadedPayments.get(item.paymentId)||legacyPaymentIds.map(id=>uploadedPayments.get(id)).find(Boolean);
  const legacyExported=drafts.some(d=>d.status==='exported'&&legacyPaymentIds.includes(String(d.payment_transaction_id)));
  const callId=itemCall?.callId||'',interactionChannel=String(calls.find(call=>call.id===callId)?.external_id||'').startsWith('whatsapp-manual:')?'whatsapp' as const:'call' as const;
  return {...item,...extractBraidIdentifiers(click?.page_url,item.gclid),websiteClick:websiteClickDetails(click,item.callTime),callId,interactionChannel,consent:consent||null,financialReady:item.ready,userDataAllowed,ready:item.ready&&userDataAllowed&&!uploaded&&!legacyExported,reason:item.reason||consentReason||(uploaded?'Google upload: '+uploaded.state:legacyExported?'Repair payment already exported':'')};
 });
 return {items:enriched,range,conversionName:name,notice:observations.configured?'':'Phone-only conversions need first-match timestamp storage. Website-click conversions remain available.'};
}
