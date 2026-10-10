import {normalizeRomanianPhone} from './attribution';
import {allocatePaymentCosts,moneyCents} from './payment-profit';
export type CrmCustomer={id:string;name:string;phone:string;firstVisit:string;lastVisit:string};
export type CrmRepair={id:string;clientId:string;repairCode:string;phoneModel:string;entryDate:string;status:string;customerPrice?:string|number;repairCost?:string|number};
export type CrmSale={id:string;clientId:string|null;productName:string;saleDate:string;salePrice?:string|number;productCost?:string|number;quantity?:number};
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
 }).map(p=>{const settlement=p.repairSettlementId?data.repairSettlements.find(s=>s.id===p.repairSettlementId):data.saleSettlements.find(s=>s.id===p.saleSettlementId);const repair=p.repairSettlementId?repairs.find(r=>r.id===settlement?.repairId):undefined,sale=p.saleSettlementId?sales.find(s=>s.id===settlement?.saleId):undefined;
  const unitCost=moneyCents(repair?repair.repairCost:sale?.productCost),unitPrice=moneyCents(repair?repair.customerPrice:sale?.salePrice),quantity=repair?1:sale?.quantity;
  const validQuantity=Number.isSafeInteger(quantity)&&Number(quantity)>0;
  return {id:p.id,amount:cents(p.amount)/100,paidDate:p.paidDate,paymentMethod:p.paymentMethod,kind:p.repairSettlementId?'repair':'sale',visitAt:repair?.entryDate||sale?.saleDate||'',settlementKey:(p.repairSettlementId?'repair:':'sale:')+(p.repairSettlementId||p.saleSettlementId),totalCost:unitCost!==null&&validQuantity?unitCost*Number(quantity)/100:null,chargedAmount:unitPrice!==null&&validQuantity?unitPrice*Number(quantity)/100:null,profit:null as number|null,allocatedCost:null as number|null};});
 const groups=new Map<string,typeof payments>();
 for(const p of payments)groups.set(p.settlementKey,[...(groups.get(p.settlementKey)||[]),p]);
 for(const group of groups.values()){
  if(group[0].totalCost===null||group.some(p=>p.amount<=0))continue;
  const allocation=allocatePaymentCosts(group,group[0].totalCost);
  for(const p of group)Object.assign(p,allocation.get(p.id));
 }
 return {callId:call.id,phone:call.phone,calledAt:call.started_at,status:'found',customer,repairs,payments,recordedTotal:payments.reduce((sum,p)=>sum+Math.round(p.amount*100),0)/100,candidateCustomers:[]};
}

