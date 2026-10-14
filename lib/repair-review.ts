import {firstInteractions,type InteractionCall} from './first-interaction';
import {safePhone,type CrmRepair} from './crm-comparison';
import {repairEligibility} from './repair-attribution';
type RepairRow={id:string;clientId:string;phone:string;entryDate:string;price:string|number|null;cost:string|number|null;customerRecords?:number};
export function reviewRepairContacts<T extends RepairRow>(repairs:T[],history:InteractionCall[],now=Date.now()){
 const groups=firstInteractions(history,now);
 return repairs.map(row=>{
  const phone=safePhone(row.phone),contact=groups.find(group=>group.phone===phone);
  const repair={id:row.id,clientId:row.clientId,entryDate:row.entryDate,customerPrice:row.price??undefined,repairCost:row.cost??undefined} as CrmRepair;
  const matchingReason=!phone?'Invalid client phone number':!row.clientId?'CRM client is unavailable':row.customerRecords!==undefined&&row.customerRecords!==1?'Multiple CRM client records share this phone number; customer identity needs review':!contact?'No recorded call or WhatsApp message for this CRM phone':!contact.eligible?'Only outgoing calls recorded; first incoming contact is missing':repairEligibility({callId:contact.primary.id,phone,calledAt:contact.primary.started_at,clientId:row.clientId,repair},'selected-crm',now);
  return {...row,contactId:contact?.primary.id||'',contactTime:contact?.primary.started_at||'',matchingReason};
 });
}
