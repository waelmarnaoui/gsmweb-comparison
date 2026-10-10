import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {crmClient} from './connections';
import {IntegrationError} from './integration-error';
import {compareCrmCall,safePhone,type CrmData} from './crm-comparison';
export const CRM_TABLES=['Client','Repair','AccessorySale','PaymentTransaction','RepairSettlement','SaleSettlement'];
async function readRows(client:SupabaseClient,table:string,columns:string,field?:string,ids?:string[]){
 const result:Record<string,unknown>[]=[];
 for(const batch of field?Array.from({length:Math.ceil((ids?.length||0)/100)},(_,i)=>ids!.slice(i*100,i*100+100)):[null]){
  for(let offset=0;offset<20000;offset+=500){
   let query=client.from(table).select(columns).order('id').range(offset,offset+499);
   if(field&&batch)query=query.in(field,batch);
   const {data,error}=await query;if(error)throw new IntegrationError(`Cannot read CRM ${table}. Check project selection, schema and server API access.`,503);
   result.push(...(data||[]) as unknown as Record<string,unknown>[]);
   if((data||[]).length<500)break;
   if(offset===19500)throw new IntegrationError('CRM comparison limit reached. No partial totals were returned.',503);
  }
 }
 return result;
}
export async function readCrmComparison(calls:{id:string;phone:string;started_at:string}[]){
 const remote=await crmClient();if(!remote)throw new IntegrationError('Choose the separate CRM database in Connections first.',503);
 const wanted=new Set(calls.map(c=>safePhone(c.phone)).filter(Boolean));
 const customers=(await readRows(remote,'Client','id,name,phone,firstVisit,lastVisit')).filter(c=>wanted.has(safePhone(String(c.phone))));
 const clientIds=customers.map(c=>String(c.id));
 const repairs=await readRows(remote,'Repair','id,clientId,repairCode,phoneModel,entryDate,status,customerPrice,repairCost','clientId',clientIds);
 const sales=await readRows(remote,'AccessorySale','id,clientId,productName,saleDate,salePrice,productCost,quantity','clientId',clientIds);
 const repairSettlements=await readRows(remote,'RepairSettlement','id,repairId','repairId',repairs.map(r=>String(r.id)));
 const saleSettlements=await readRows(remote,'SaleSettlement','id,saleId','saleId',sales.map(s=>String(s.id)));
 const columns='id,repairSettlementId,saleSettlementId,amount,paidDate,paymentMethod,active';
 const payments=[...await readRows(remote,'PaymentTransaction',columns,'repairSettlementId',repairSettlements.map(s=>String(s.id))),...await readRows(remote,'PaymentTransaction',columns,'saleSettlementId',saleSettlements.map(s=>String(s.id)))];
 const data={customers,repairs,sales,repairSettlements,saleSettlements,payments} as unknown as CrmData;
 return calls.map(c=>compareCrmCall(c,data));
}

