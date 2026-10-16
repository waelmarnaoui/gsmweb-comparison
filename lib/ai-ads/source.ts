import 'server-only';
import {crmClient,getConnection} from '../connections';
import {normalizeInventory,defaultInventoryRules,type ProductRow,type LotRow,type ModelRow,type InventoryRules} from './inventory';
import {InventorySourceError,inventoryDiagnostic} from './source-diagnostic';
import {readReceivedInventory} from './inventory-reader';
// Explicit project supplied by the owner; project identifiers are not credentials.
export const inventoryProjectRef='dmjunqbncyrinykbbmfk';
export async function inventorySourceStatus(){
 const saved=await getConnection('supabase_crm');
 return {expectedProject:inventoryProjectRef,selectedProject:saved?.metadata.project_ref??null,connectionSaved:!!saved,projectMatches:saved?.metadata.project_ref===inventoryProjectRef};
}
export async function readRepairInventory(rules:InventoryRules=defaultInventoryRules){
 const readStartedAt=Date.now();
 let source,client;
 try{source=await inventorySourceStatus();if(!source.projectMatches)throw new Error('Project mismatch');client=await crmClient();if(!client)throw new Error('Connection unavailable');}
 catch{throw new InventorySourceError({code:'connection',table:null,action:'Reconnect the CRM integration to the owner-confirmed stock project dmjunqbncyrinykbbmfk and verify server-side project read access.'});}
 const deadline=AbortSignal.timeout(20000);
 const {products,lots,models,scope}=await readReceivedInventory(async(table,columns,offset,ids)=>{
  let query=client!.from(table).select(columns,{count:'exact'}).order('id').range(offset,offset+499);
  if(ids)query=query.in('id',ids);
  const {data,error,count}=await query.abortSignal(deadline);
  if(error)throw new InventorySourceError(inventoryDiagnostic(error.code,table,deadline.aborted));
  return {rows:(data??[]) as unknown as Record<string,unknown>[],total:count};
 });
 const parts=normalizeInventory(inventoryProjectRef,products as unknown as ProductRow[],lots as unknown as LotRow[],models as unknown as ModelRow[],rules,readStartedAt);
 return {sourceProject:inventoryProjectRef,scope,parts,complete:true,consistency:'complete receipt-backed scope; multi-query; no stock reservation or transactional locking',counts:{products:products.length,lots:lots.length,models:models.length}};
}
