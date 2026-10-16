import {InventorySourceError} from './source-diagnostic';
export type SourceRow=Record<string,unknown>;
export type InventoryPageReader=(table:'InventoryLot'|'InventoryProduct'|'DeviceModel',columns:string,offset:number,ids?:string[])=>Promise<{rows:SourceRow[];total:number|null}>;
export async function readReceivedInventory(page:InventoryPageReader){
 async function rows(table:Parameters<InventoryPageReader>[0],columns:string,ids?:string[]){
  const all:SourceRow[]=[],batches=ids?Array.from({length:Math.ceil(ids.length/100)},(_,i)=>ids.slice(i*100,i*100+100)):[undefined];
  for(const batch of batches){
   let offset=0,expected:number|null=null;
   do{
    const result=await page(table,columns,offset,batch);
    if(typeof result.total!=='number'||!Number.isSafeInteger(result.total)||result.total<0||result.total>20000)throw new InventorySourceError({code:'source_limit',table,action:'The inventory source count is missing or exceeds the 20,000-row read limit. No partial stock was accepted.'});
    if(expected!==null&&expected!==result.total)throw new InventorySourceError({code:'source_changed',table,action:'The inventory row count changed during collection. Retry a complete read.'});
    expected=result.total;
    if(!Array.isArray(result.rows)||result.rows.length>500||offset+result.rows.length>expected||(result.rows.length===0&&offset<expected))throw new InventorySourceError({code:'invalid_data',table,action:'The inventory page was empty, oversized or inconsistent with its exact count. No partial stock was accepted.'});
    if(result.rows.some(row=>!row||typeof row.id!=='string'||!row.id||row.id.length>200))throw new InventorySourceError({code:'invalid_data',table,action:'The inventory page contains an invalid row identity. No partial stock was accepted.'});
    all.push(...result.rows);offset+=result.rows.length;
   }while(offset<expected!);
  }
  if(new Set(all.map(row=>row.id)).size!==all.length)throw new InventorySourceError({code:'duplicate_identity',table,action:'Duplicate rows were returned by the stock source. Retry a complete read.'});
  return all;
 }
 // Receipts define physical inventory. Keep depleted lots; never subtract repair allocations again.
 const lots=await rows('InventoryLot','id,productId,quantityAvailable,unitCost,costIncludesVat,updatedAt');
 const productIds=[...new Set(lots.map(lot=>lot.productId))];
 if(productIds.some(id=>typeof id!=='string'||!id||id.length>200))throw new InventorySourceError({code:'invalid_data',table:'InventoryLot',action:'Stock lots contain invalid product references.'});
 const products=await rows('InventoryProduct','id,name,sku,brand,partCode,partType,compatibleModels,modelId,category,quality,active,minStock,recommendedPrice,updatedAt',productIds as string[]);
 const productSet=new Set(productIds);
 if(products.length!==productIds.length||products.some(product=>!productSet.has(product.id)))throw new InventorySourceError({code:'orphan_lots',table:'InventoryProduct',action:'Not all received-stock products are readable. Verify product permissions and references; no partial stock was accepted.'});
 const modelIds=[...new Set(products.map(product=>product.modelId).filter(id=>typeof id==='string'&&id))] as string[];
 const models=await rows('DeviceModel','id,name,brand',modelIds);
 const modelSet=new Set(modelIds);
 if(models.length!==modelIds.length||models.some(model=>!modelSet.has(model.id as string)))throw new InventorySourceError({code:'invalid_data',table:'DeviceModel',action:'A referenced device model could not be read. Verify model permissions and references.'});
 return {lots,products,models,scope:'received_stock_including_depleted_lots' as const};
}
