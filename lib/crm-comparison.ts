import {normalizeRomanianPhone} from './attribution';
export type CrmCustomer={id:string;name:string;phone:string;firstVisit:string;lastVisit:string};
export type CrmRepair={id:string;clientId:string;repairCode:string;phoneModel:string;entryDate:string;status:string};
export type CrmSale={id:string;clientId:string|null;productName:string;saleDate:string};
export type CrmSettlement={id:string;repairId?:string;saleId?:string};
export type CrmPayment={id:string;repairSettlementId:string|null;saleSettlementId:string|null;amount:string|number;paidDate:string;paymentMethod:string;active:boolean};
export type CrmData={customers:CrmCustomer[];repairs:CrmRepair[];sales:CrmSale[];repairSettlements:CrmSettlement[];saleSettlements:CrmSettlement[];payments:CrmPayment[]};
export function safePhone(phone:string){try{return normalizeRomanianPhone(phone);}catch{return null;}}
function cents(value:string|number){const text=String(value);if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(text))throw new Error('Invalid CRM payment amount');const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
export function compareCrmCall(call:{id:string;phone:string;started_at:string},data:CrmData){
 const phone=safePhone(call.phone),customers=phone?data.customers.filter(c=>safePhone(c.phone)===phone):[];
 if(customers.length!==1)return {callId:call.id,phone:call.phone,calledAt:call.started_at,status:customers.length?'ambiguous':'not_found',customer:null,repairs:[],payments:[],recordedTotal:0,candidateCustomers:customers.map(c=>({id:c.id,name:c.name}))};
 const customer=customers[0],repairs=data.repairs.filter(r=>r.clientId===customer.id),sales=data.sales.filter(s=>s.clientId===customer.id);
 const repairIds=new Set(repairs.map(r=>r.id)),saleIds=new Set(sales.map(s=>s.id));
 const repairSettlements=new Set(data.repairSettlements.filter(s=>s.repairId&&repairIds.has(s.repairId)).map(s=>s.id));
 const saleSettlements=new Set(data.saleSettlements.filter(s=>s.saleId&&saleIds.has(s.saleId)).map(s=>s.id));
 const seen=new Set<string>();
 const payments=data.payments.filter(p=>{
  if(!p.active||seen.has(p.id)||Boolean(p.repairSettlementId)===Boolean(p.saleSettlementId))return false;
  const linked=p.repairSettlementId?repairSettlements.has(p.repairSettlementId):saleSettlements.has(p.saleSettlementId!);
  if(linked)seen.add(p.id);return linked;
 }).map(p=>{const settlement=p.repairSettlementId?data.repairSettlements.find(s=>s.id===p.repairSettlementId):data.saleSettlements.find(s=>s.id===p.saleSettlementId);const visitAt=p.repairSettlementId?repairs.find(r=>r.id===settlement?.repairId)?.entryDate:sales.find(s=>s.id===settlement?.saleId)?.saleDate;return {id:p.id,amount:cents(p.amount)/100,paidDate:p.paidDate,paymentMethod:p.paymentMethod,kind:p.repairSettlementId?'repair':'sale',visitAt:visitAt||''};});
 return {callId:call.id,phone:call.phone,calledAt:call.started_at,status:'found',customer,repairs,payments,recordedTotal:payments.reduce((sum,p)=>sum+Math.round(p.amount*100),0)/100,candidateCustomers:[]};
}

