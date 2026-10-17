import 'server-only';
import {crmClient} from './connections';
import {service} from './server';
import {businessRange,paymentTotals,websiteTotals} from './agent-business';
import {reviewRange} from './review-day';
import {clickSheetSource} from './sheets';
import {readClickSyncState} from './sync-click-sheet';
import {clickSyncReason} from './click-sync-state';
export async function readBusinessPayments(from:string,to:string){
 businessRange(from,to);const remote=await crmClient();if(!remote)throw new Error('CRM connection is unavailable.');
 const rows:any[]=[],started=Date.now();
 for(let offset=0;offset<20000;offset+=500){if(Date.now()-started>35000)throw new Error('Business data read timed out; partial totals are unavailable.');const r=await remote.from('PaymentTransaction').select('id,amount,paidDate,paymentMethod,active').eq('active',true).gte('paidDate',from).lte('paidDate',to).order('id').range(offset,offset+499).abortSignal(AbortSignal.timeout(12000));if(r.error)throw new Error('CRM payment records could not be read. Check the saved CRM permissions.');rows.push(...r.data);if(r.data.length<500)return {...paymentTotals(rows,from,to),fetchedAt:new Date().toISOString()};}
 throw new Error('Payment read limit reached; partial totals were not returned. Narrow the date range.');
}
export async function readBusinessClicks(from:string,to:string){
 businessRange(from,to);const range=reviewRange(from,to),db=service(),rows:any[]=[],started=Date.now();
 const source=await clickSheetSource(),state=await readClickSyncState(db,source.id);
 for(let offset=0;offset<20000;offset+=500){if(Date.now()-started>35000)throw new Error('Business data read timed out; partial totals are unavailable.');const r=await db.from('ga_clicks').select('id,clicked_at,gclid,page_url,session_id').gte('clicked_at',range.start).lte('clicked_at',range.end).order('id').range(offset,offset+499).abortSignal(AbortSignal.timeout(12000));if(r.error)throw new Error('Website events could not be read.');rows.push(...r.data);if(r.data.length<500)return {...websiteTotals(rows,from,to),syncNotice:clickSyncReason(state,source.id)||null,lastImportedAt:state?.synced_at??null,scope:'All stored website event sources; historical imports may include earlier connected sheets.'};}
 throw new Error('Website event limit reached; partial totals were not returned. Narrow the date range.');
}
export async function readBusinessRecords(kind:'repairs'|'sales',from:string,to:string,offset:number){
 businessRange(from,to);const remote=await crmClient();if(!remote)throw new Error('CRM connection unavailable.');
 const repairs=kind==='repairs',table=repairs?'Repair':'AccessorySale',field=repairs?'entryDate':'saleDate',columns=repairs?'id,repairCode,phoneModel,entryDate,status,customerPrice,repairCost':'id,productName,saleDate,salePrice,productCost,quantity';
 const range=reviewRange(from,to),r=await remote.from(table).select(columns).gte(field,range.start).lte(field,range.end).order('id').range(offset,offset+49).abortSignal(AbortSignal.timeout(12000));if(r.error)throw new Error('CRM business records unavailable.');
 return {kind,from,to,offset,records:r.data,nextOffset:r.data.length===50?offset+50:null,notice:'Recorded work orders or sales, not payment totals. Device unlock credentials, customer contact information and private notes are excluded. Recorded price less cost is not necessarily realized profit.'};
}
