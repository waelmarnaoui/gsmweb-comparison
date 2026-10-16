import 'server-only';
import {crmClient,getConnection} from '../connections';
import {normalizeInventory,defaultInventoryRules,type ProductRow,type LotRow,type ModelRow,type InventoryRules} from './inventory';
import {IntegrationError} from '../integration-error';
// Explicit project supplied by the owner; project identifiers are not credentials.
export const inventoryProjectRef='dmjunqbncyrinykbbmfk';
export async function inventorySourceStatus(){
 const saved=await getConnection('supabase_crm');
 return {expectedProject:inventoryProjectRef,selectedProject:saved?.metadata.project_ref??null,connectionSaved:!!saved,projectMatches:saved?.metadata.project_ref===inventoryProjectRef};
}
export async function readRepairInventory(rules:InventoryRules=defaultInventoryRules){
 const readStartedAt=Date.now();
 const source=await inventorySourceStatus();if(!source.projectMatches)throw new IntegrationError('Select the owner-confirmed inventory project in the existing CRM connection first.',503);
 const client=await crmClient();if(!client)throw new IntegrationError('The saved server-side inventory connection is unavailable.',503);
 const deadline=AbortSignal.timeout(20000);
 async function rows(table:string,columns:string){
  const result:Record<string,unknown>[]=[];
  for(let offset=0;offset<20000;offset+=500){
   const {data,error}=await client!.from(table).select(columns).order('id').range(offset,offset+499).abortSignal(deadline);
   if(error)throw new IntegrationError(`Cannot read the expected inventory fields in ${table}. The live schema and source permissions need verification. No partial inventory was accepted.`,503);
   result.push(...(data??[]) as unknown as Record<string,unknown>[]);if((data??[]).length<500)return result;
  }
  throw new IntegrationError('Inventory pagination limit reached. No partial stock totals were accepted.',503);
 }
 const [products,lots,models]=await Promise.all([
  rows('InventoryProduct','id,name,sku,brand,partCode,partType,compatibleModels,modelId,category,quality,active,minStock,recommendedPrice,updatedAt'),
  rows('InventoryLot','id,productId,quantityAvailable,unitCost,costIncludesVat,updatedAt'),
  rows('DeviceModel','id,name,brand')
 ]);
 const parts=normalizeInventory(inventoryProjectRef,products as unknown as ProductRow[],lots as unknown as LotRow[],models as unknown as ModelRow[],rules,readStartedAt);
 return {sourceProject:inventoryProjectRef,parts,complete:true,consistency:'multi-query; no stock reservation or transactional locking',counts:{products:products.length,lots:lots.length,models:models.length}};
}
