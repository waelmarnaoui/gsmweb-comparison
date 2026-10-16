import {createHash} from 'node:crypto';
export type ProductRow={id:string;name:string;sku:string;brand:string|null;partCode:string|null;partType:string|null;compatibleModels:string[];modelId:string|null;category:string;quality:string|null;active:boolean;minStock:number;recommendedPrice:string|number;updatedAt:string};
export type LotRow={id:string;productId:string;quantityAvailable:number;unitCost:string|number;costIncludesVat:boolean|null;updatedAt:string};
export type ModelRow={id:string;name:string;brand:string};
export type InventoryRules={minimumStock:Record<string,number>;netAvailabilityConfirmed:boolean;maxSnapshotAgeSeconds:number};
// Uploaded repair-stock.ts atomically deducts saved repair allocations from lots.
// Do not subtract RepairPart allocations a second time.
export const defaultInventoryRules:InventoryRules={minimumStock:{PART:1,ACCESSORY:1,CONSUMABLE:1,DEVICE:1,OTHER:1},netAvailabilityConfirmed:true,maxSnapshotAgeSeconds:300};
export type InventoryPart={sourceProject:string;id:string;name:string;sku:string;brand:string|null;partCode:string|null;partType:string|null;models:string[];category:string;quality:string|null;active:boolean;available:number|null;minimumStock:number;partPriceBani:number|null;weightedUnitCostBani:number|null;updatedAt:string;observedAt:string;fingerprint:string;eligible:boolean;reasons:string[];demand:null;repairPriceBani:null};
export function digest(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function moneyBani(value:unknown):number|null{
 const s=String(value??'');if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(s))return null;const [whole,fraction='']=s.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
const validText=(value:unknown,max=200):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
export function normalizeInventory(project:string,products:ProductRow[],lots:LotRow[],models:ModelRow[],rules:InventoryRules,now=Date.now()):InventoryPart[]{
 if(!/^[a-z0-9]{20}$/.test(project)||!Number.isFinite(now)||!Number.isSafeInteger(rules.maxSnapshotAgeSeconds)||rules.maxSnapshotAgeSeconds<30||rules.maxSnapshotAgeSeconds>3600)throw new Error('Invalid inventory configuration.');
 if(new Set(products.map(p=>p.id)).size!==products.length||new Set(lots.map(p=>p.id)).size!==lots.length||new Set(models.map(p=>p.id)).size!==models.length)throw new Error('Duplicate inventory identities; no partial stock totals are accepted.');
 const known=new Set(products.map(p=>p.id));if(lots.some(lot=>!known.has(lot.productId)))throw new Error('Inventory changed during collection or contains orphan lots. Refresh before making decisions.');
 const lotGroups=new Map<string,LotRow[]>();for(const lot of lots)lotGroups.set(lot.productId,[...(lotGroups.get(lot.productId)??[]),lot]);
 const modelMap=new Map(models.map(m=>[m.id,m]));
 return products.map(p=>{
  const reasons:string[]=[],categoryMinimum=rules.minimumStock[p.category];
  if(!Number.isSafeInteger(categoryMinimum)||categoryMinimum<0||!Number.isSafeInteger(p.minStock)||p.minStock<0)reasons.push('stock_threshold_missing_or_invalid');
  const minimum=Math.max(1,categoryMinimum??1,Number.isSafeInteger(p.minStock)?p.minStock:1),ownLots=lotGroups.get(p.id)??[];
  const validQuantity=ownLots.every(l=>Number.isSafeInteger(l.quantityAvailable)&&l.quantityAvailable>=0);
  const sum=ownLots.reduce((n,l)=>n+l.quantityAvailable,0),available=validQuantity&&Number.isSafeInteger(sum)?sum:null;
  if(available===null)reasons.push('stock_quantity_invalid');else if(available===0)reasons.push('out_of_stock');else if(available<minimum)reasons.push('below_minimum_stock');
  if(!rules.netAvailabilityConfirmed)reasons.push('reservation_semantics_unverified');
  if(p.active!==true)reasons.push('inventory_inactive');
  if(p.category!=='PART')reasons.push('outside_repair_parts_scope');
  if(!validText(p.id)||!validText(p.name)||!validText(p.sku)||!validText(p.partType))reasons.push('essential_part_information_missing');
  const model=modelMap.get(p.modelId??''),names=[...(Array.isArray(p.compatibleModels)?p.compatibleModels:[]),...(model&&validText(model.name)?[model.name]:[])];
  const verifiedModels=[...new Set(names.filter(s=>validText(s,100)).map(s=>s.trim()))].sort();
  if(!verifiedModels.length)reasons.push('compatible_model_missing');
  if(!Number.isFinite(Date.parse(p.updatedAt))||Date.parse(p.updatedAt)>now+60000||ownLots.some(l=>!Number.isFinite(Date.parse(l.updatedAt))||Date.parse(l.updatedAt)>now+60000))reasons.push('source_timestamp_invalid');
  // Preserve recorded costs; mixed or unknown VAT bases cannot support a reliable average.
  const positive=ownLots.filter(l=>l.quantityAvailable>0),costs=positive.map(l=>moneyBani(l.unitCost));
  const consistentCostBasis=positive.length>0&&positive.every(l=>typeof l.costIncludesVat==='boolean'&&l.costIncludesVat===positive[0].costIncludesVat);
  const numerator=positive.reduce((n,l,i)=>n+(costs[i]??0)*l.quantityAvailable,0);
  const weightedUnitCostBani=available&&consistentCostBasis&&costs.every(c=>c!==null)&&Number.isSafeInteger(numerator)?Math.ceil(numerator/available):null;
  const facts={sourceProject:project,id:p.id,name:p.name,sku:p.sku,brand:validText(p.brand)?p.brand:null,partCode:validText(p.partCode)?p.partCode:null,partType:validText(p.partType)?p.partType:null,models:verifiedModels,category:p.category,quality:validText(p.quality)?p.quality:null,active:p.active===true,available,minimumStock:minimum,partPriceBani:moneyBani(p.recommendedPrice),weightedUnitCostBani,updatedAt:p.updatedAt,
   lots:ownLots.map(l=>({id:l.id,quantity:l.quantityAvailable,cost:moneyBani(l.unitCost),costIncludesVat:l.costIncludesVat,updatedAt:l.updatedAt})).sort((a,b)=>a.id.localeCompare(b.id))};
  const {lots:unused,...display}=facts;void unused;
  return {...display,observedAt:new Date(now).toISOString(),fingerprint:digest(facts),eligible:reasons.length===0,reasons,demand:null,repairPriceBani:null};
 });
}
export function inventorySafeguard(old:InventoryPart,current:InventoryPart|null,maxPriceChangePct=10){
 if(!current)return {action:'REVIEW_PAUSE',reason:'Part disappeared from a complete inventory refresh.'};
 if(current.available===null||!current.eligible)return {action:'REVIEW_PAUSE',reason:current.reasons.join(', ')};
 if(old.fingerprint===current.fingerprint)return {action:'NONE',reason:'Inventory evidence is unchanged.'};
 const before=old.partPriceBani,after=current.partPriceBani;
 if(before===null||after===null||(before>0&&Math.abs(after-before)/before*100>=maxPriceChangePct))return {action:'REVIEW',reason:'Part price changed materially or became unknown. This is not the repair price.'};
 return {action:'RECHECK',reason:'Inventory facts changed; invalidate approvals and recheck the draft. Never automatically re-enable.'};
}
